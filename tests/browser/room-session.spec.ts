import { selectEntryCharacter } from "./select-entry-character";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { io } from "socket.io-client";
import type { RoomState } from "../../shared/types";
import { request } from "./party-session";

test("Durak verbindet dasselbe Gerät in Lobby und Partie wieder", async ({ page }) => {
  const host = io("http://127.0.0.1:4177", { autoConnect: false, transports: ["websocket"] });
  try {
    const connected = new Promise<void>((resolve, reject) => {
      host.once("connect", resolve);
      host.once("connect_error", reject);
    });
    host.connect();
    await connected;
    const room = await request<RoomState>(host, "room:create", { playerId: randomUUID(), characterId: "alpha_rick_prime" });
    await request(host, "room:configure", { gameId: "durak", playerCount: 2 });
    const guestPresence: boolean[] = [];
    host.on("room:updated", (state: RoomState) => {
      const guest = state.players.find(player => player.id !== room.hostId);
      if (guest) guestPresence.push(guest.connected);
    });

    let dropConnection: () => Promise<void>;
    await page.routeWebSocket(/\/socket\.io\//, route => {
      const upstream = route.connectToServer();
      dropConnection = async () => { await Promise.all([route.close(), upstream.close()]); };
    });
    async function interruptAndReconnect() {
      guestPresence.length = 0;
      await dropConnection();
      await expect.poll(() => guestPresence.includes(false) && guestPresence.at(-1) === true).toBe(true);
    }
    async function joinByCode() {
      await page.getByRole("button", { name: /Online spielen/ }).click();
      await page.getByRole("button", { name: /^Raum beitreten/ }).click();
      await selectEntryCharacter(page, "Morty Smith");
      await page.getByRole("textbox", { name: "Raumcode" }).fill(room.code);
      await page.getByRole("button", { name: "Raum beitreten", exact: true }).click();
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await joinByCode();
    const ready = page.getByRole("button", { name: "Ich bin bereit", exact: true });
    await expect(ready).toBeEnabled();
    await interruptAndReconnect();
    await ready.click();
    await request(host, "room:ready");
    await expect(page.locator(".durak-players")).toBeVisible();
    await interruptAndReconnect();
    await page.reload();
    await expect(page.locator(".durak-players")).toBeVisible();
    const restored = await request<RoomState>(host, "durak:state");
    expect(restored.players).toHaveLength(2);
    expect(restored.durakGame?.phase).toBe("attack");
  } finally {
    host.disconnect();
  }
});
