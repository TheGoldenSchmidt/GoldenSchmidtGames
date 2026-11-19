import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { io, type Socket } from "socket.io-client";
import { createClient } from "@libsql/client";
import { createSpielraumServer } from "../server/index";
import { RoomStore, type SavedRoom } from "../server/roomStore";
import { hashToken } from "../server/accountStore";
import { resultStatements } from "../server/gameStatistics";
import { createQwixxGame } from "../shared/qwixx";
import { createDurakGame } from "../shared/durak";
import { createPartyGame } from "../shared/party";
import type { Account } from "../shared/accounts";
import type { Ack, RoomState } from "../shared/types";

const bootstrap = randomUUID();
const directory = await mkdtemp(path.join(tmpdir(), "gsg-accounts-"));
const config = { url: pathToFileURL(path.join(directory, "accounts.db")).href };
const store = new RoomStore(config);
const inspect = createClient(config);
await store.accounts.initialize(bootstrap);
const server = createSpielraumServer(store);
const port = await server.listen(0), origin = `http://127.0.0.1:${port}`;
const sockets: Socket[] = [];
async function request(path: string, method = "GET", body?: unknown, cookie?: string, headers?: Record<string, string>) {
  const response = await fetch(origin + "/api/account" + path, { method,
    headers: { ...(method !== "GET" ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, headers: response.headers, data: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function register(username: string, invitation: string) {
  const result = await request("/register", "POST", { username, invitation, password: "a strong test password" });
  assert.equal(result.status, 200, result.data.error);
  assert.match(result.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(result.headers.get("set-cookie")!, /SameSite=Strict/i);
  assert.equal(result.headers.get("cache-control"), "no-store");
  return { account: result.data.account as Account, cookie: result.cookie! };
}
async function connect(cookie?: string) {
  const socket = io(origin, { transports: ["websocket"], reconnection: false, autoConnect: false,
    extraHeaders: cookie ? { Cookie: cookie } : {} });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); socket.connect(); });
  return socket;
}
async function emit(socket: Socket, event: string, ...args: unknown[]) {
  const response = await socket.timeout(5000).emitWithAck(event, ...args) as Ack<RoomState>;
  assert.ok(response.ok, response.error);
  return response.data!;
}

try {
  assert.equal((await request("/developer")).status, 401);
  assert.equal((await request("/register", "POST", { username: "owner", password: "short", invitation: bootstrap })).status, 400);
  const owner = await register("Owner", bootstrap);
  assert.equal(owner.account.role, "admin");
  assert.equal((await request("/register", "POST", { username: "reuse", password: "a strong test password", invitation: bootstrap })).status, 400);
  const devInvite = (await request("/invitations", "POST", { role: "developer" }, owner.cookie)).data.invitation;
  const playerInvite = (await request("/invitations", "POST", { role: "player" }, owner.cookie)).data.invitation;
  const developer = await register("Developer", devInvite), player = await register("Player", playerInvite);
  assert.equal((await request("/developer", "GET", undefined, developer.cookie)).status, 200);
  assert.equal((await request("/developer", "GET", undefined, player.cookie)).status, 403);
  assert.equal((await request("/users", "GET", undefined, player.cookie)).status, 403);
  assert.equal((await request("/invitations", "POST", { role: "admin" }, owner.cookie)).status, 400);
  assert.equal((await request("/invitations", "POST", { role: "player" }, player.cookie)).status, 403);
  assert.equal((await request("/invitations", "POST", { role: "player" }, owner.cookie, { Origin: "https://evil.invalid" })).status, 403);
  assert.equal((await request("/login", "POST", { username: "Owner", password: "wrong" })).status, 401);
  assert.equal((await request("/login", "POST", { username: "does-not-exist", password: "wrong" })).status, 401);
  const login = await request("/login", "POST", { username: "oWnEr", password: "a strong test password" });
  assert.equal(login.data.account.id, owner.account.id);
  const settings = { displayName: "Die Entwicklerin", sound: false, characterId: "alpha_korvo" };
  assert.equal((await request("/settings", "PUT", settings, developer.cookie)).status, 200);
  assert.deepEqual((await request("/me", "GET", undefined, developer.cookie)).data.account.settings, settings);
  assert.equal((await request("/settings", "PUT", { ...settings, characterId: "invalid" }, developer.cookie)).status, 400);
  assert.equal((await request("/settings", "PUT", { ...settings, role: "admin" }, developer.cookie)).data.account.role, "developer");
  assert.equal((await request(`/users/${developer.account.id}/role`, "PUT", { role: "player" }, owner.cookie)).status, 200);
  assert.equal((await request("/developer", "GET", undefined, developer.cookie)).status, 403, "Rollen werden aus der Datenbank gelesen");
  assert.equal((await request(`/users/${owner.account.id}/role`, "PUT", { role: "player" }, owner.cookie)).status, 400);
  const expired = await store.accounts.invite("player");
  await inspect.execute({ sql: "UPDATE gsg_invitations SET expires=0 WHERE token=?", args: [hashToken(expired)] });
  assert.equal((await request("/register", "POST", { username: "Expired", password: "a strong test password", invitation: expired })).status, 400);
  const secureLogin = await request("/login", "POST", { username: "Developer", password: "a strong test password" }, undefined, { "X-Forwarded-Proto": "https" });
  assert.match(secureLogin.headers.get("set-cookie")!, /; Secure/);
  await inspect.execute({ sql: "UPDATE gsg_sessions SET expires=0 WHERE token=?", args: [hashToken(secureLogin.cookie!.split("=")[1])] });
  assert.equal((await request("/developer", "GET", undefined, secureLogin.cookie)).status, 401, "Abgelaufene Sitzung wird abgelehnt");

  const rivalInvite = (await request("/invitations", "POST", { role: "player" }, owner.cookie)).data.invitation;
  const concurrent = await Promise.all(["First", "Second"].map(username => request("/register", "POST", { username, password: "a strong test password", invitation: rivalInvite })));
  assert.deepEqual(concurrent.map(result => result.status).sort(), [200, 400], "Einladung ist auch bei gleichzeitiger Einlösung einmalig");

  const guest = await connect(), a = await connect(developer.cookie), b = await connect(player.cookie);
  const impersonation = await guest.timeout(5000).emitWithAck("room:create", { playerId: " " + developer.account.id + " ", characterId: "alpha_korvo" });
  assert.equal(impersonation.ok, false);
  const room = await emit(a, "room:create", { playerId: developer.account.id, characterId: "alpha_korvo", gameId: "kribbeln" });
  const joined = await emit(b, "room:join", { playerId: player.account.id, code: room.code, characterId: "alpha_rick_prime" });
  await emit(a, "room:ready");
  let game = await emit(b, "room:ready");
  assert.ok(game.statisticsId);
  while (!game.kribbelnGame!.finished) {
    const actor = game.kribbelnGame!.order[game.kribbelnGame!.playerIndex] === developer.account.id ? a : b;
    await emit(actor, "kribbeln:roll", { keep: [] });
    game = await emit(actor, "kribbeln:submit", { choice: "skip" });
  }
  const stats = () => store.accounts.statistics(developer.account.id);
  assert.deepEqual(await stats(), [{ gameId: "kribbeln", played: 1, won: 1 }], "Ein abgeschlossener Gleichstand zählt als Sieg für alle Gewinner");
  await emit(a, "room:join", { playerId: developer.account.id, code: room.code, sessionToken: room.sessionToken });
  assert.equal((await stats())[0].played, 1, "Wiederbeitritt zählt nicht doppelt");
  const saved = (await store.load(false)).find(saved => saved.room.code === room.code)!;
  const duplicate: SavedRoom = structuredClone(saved);
  const sample = structuredClone(saved.room);
  sample.config.gameId = "qwixx"; sample.game = createQwixxGame(sample.players);
  sample.game.phase = "finished"; sample.game.winnerIds = [developer.account.id, player.account.id];
  assert.deepEqual(resultStatements(sample, "owner").map(statement => typeof statement === "string" ? [] : statement.args?.[2]), [1, 1]);
  sample.config.gameId = "durak"; sample.durakGame = createDurakGame(sample.players);
  sample.durakGame.phase = "finished"; sample.durakGame.durakId = developer.account.id;
  assert.deepEqual(resultStatements(sample, "owner").map(statement => typeof statement === "string" ? [] : statement.args?.[2]), [0, 1]);
  sample.durakGame.durakId = null;
  assert.deepEqual(resultStatements(sample, "owner").map(statement => typeof statement === "string" ? [] : statement.args?.[2]), [0, 0]);
  for (const mode of ["party", "roll-it-up", "free-minigame", "goldenschmidt"] as const) {
    sample.config.gameId = mode; sample.partyGame = createPartyGame(sample.players, { rounds: 5 }, true, 123, Date.now(), mode);
    sample.partyGame.phase = "finished"; sample.partyGame.winners = [developer.account.id];
    assert.deepEqual(resultStatements(sample, "owner").map(statement => typeof statement === "string" ? [] : statement.args?.[2]), [1, 0]);
    sample.partyGame.phase = "aborted";
    assert.equal(resultStatements(sample, "owner").length, 0, "Abgebrochene Partien zählen nicht");
  }
  await store.save(new Map([[room.code, duplicate]]));
  assert.equal((await stats())[0].played, 1, "Speicherwiederholung zählt nicht doppelt");
  duplicate.room.statisticsId = randomUUID(); duplicate.room.partyTest = { seed: 1 };
  await store.save(new Map([[room.code, duplicate]]));
  assert.equal((await stats())[0].played, 1, "Testpartien zählen nicht");
  duplicate.room.partyTest = undefined; duplicate.room.kribbelnGame!.finished = false;
  await store.save(new Map([[room.code, duplicate]]));
  assert.equal((await stats())[0].played, 1, "Unfertige Partien zählen nicht");
  await emit(a, "room:lobby");
  await emit(a, "room:ready"); game = await emit(b, "room:ready");
  assert.notEqual(game.statisticsId, room.statisticsId, "Neue Runde im selben Raum erhält eigene Statistik-ID");

  const rows = (await inspect.execute("SELECT password FROM gsg_accounts")).rows;
  assert.ok(rows.every(row => !String(row.password).includes("a strong test password") && String(row.password).includes(":")));
  const storedSession = (await inspect.execute("SELECT token FROM gsg_sessions")).rows;
  assert.ok(storedSession.every(row => String(row.token).length === 64 && !owner.cookie.includes(String(row.token))));
  const beforeRestart = await stats();
  const reader = new RoomStore(config);
  assert.deepEqual(await reader.accounts.statistics(developer.account.id), beforeRestart);
  assert.equal((await reader.accounts.session(developer.cookie.split("=")[1]))?.id, developer.account.id);
  reader.close();
  const anotherLogin = await request("/login", "POST", { username: "Developer", password: "a strong test password" });
  const otherDevice = await connect(anotherLogin.cookie!);
  const disconnected = new Promise<void>(resolve => a.once("disconnect", () => resolve()));
  await request("/logout", "POST", {}, developer.cookie);
  await disconnected;
  assert.ok(otherDevice.connected, "Abmelden trennt nur Verbindungen dieser Sitzung");
  assert.equal((await request("/me", "GET", undefined, anotherLogin.cookie)).data.account.id, developer.account.id);
  assert.equal((await request("/me", "GET", undefined, developer.cookie)).data.account, null);
  for (let i = 0; i < 22; i++) await request("/login", "POST", { username: "absent", password: "wrong" });
  assert.equal((await request("/login", "POST", { username: "absent", password: "wrong" })).status, 429);
  assert.ok(joined.sessionToken);
  console.log("Konten: Einladungen, sichere Sitzungen, Rollen, Einstellungen, Rechteentzug, Identitätsschutz, Online-Statistik ohne Doppelzählung, Persistenz und Anmeldelimit geprüft.");
} catch (error) {
  console.error(error);
  throw error;
} finally {
  sockets.forEach(socket => socket.disconnect());
  await server.close(); inspect.close();
  assert.equal(path.dirname(directory), path.resolve(tmpdir()));
  assert.ok(path.basename(directory).startsWith("gsg-accounts-"));
  await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
