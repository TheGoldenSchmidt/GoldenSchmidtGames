import { test, expect } from "@playwright/test";
import { matchStarted, onlineSession } from "./party-session";
import type { LavaHostGame } from "../../shared/matches/lavaHost";

async function unityLoaded(page: import("@playwright/test").Page) {
  await expect.poll(() => page.frames().some(f => f.url().includes("spiel=online")), { timeout: 30000 }).toBe(true);
  const frame = page.frames().find(f => f.url().includes("spiel=online"))!;
  await frame.waitForFunction(() => (window as unknown as { gsgUnity?: unknown }).gsgUnity, null, { timeout: 150000 });
}

// Pilot Floor is Lava "Unity · Host rechnet": the host's Unity scene simulates with its physics; the room
// checks and relays its reports, the other phone's input reaches the host's runners through the room.
test("Floor is Lava „Unity · Host rechnet“: Host-Handy simuliert, Raum prüft und verteilt", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Nur Smartphone");
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "lava" });
  try {
    await page.getByRole("group", { name: "Variante" }).getByRole("button", { name: /Host rechnet/ }).tap();
    await expect(page.getByRole("group", { name: "Variante" }).getByRole("button", { name: /Host rechnet/ })).toHaveAttribute("aria-pressed", "true");
    // Only the host chooses.
    await expect(session.action({ type: "look", renderer: "unity", view: "third" }, session.ids[1])).rejects.toThrow(/Host/);
    await unityLoaded(page);
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const relay = async () => (await session.state()).partyGame!.mini!.match!;
    expect((await relay()).id).toBe("lavahost");
    const world = page.locator(".match-world");
    await expect(world).toHaveAttribute("data-ready", "true", { timeout: 150000 });
    await expect(world).toHaveAttribute("data-role", "host");
    await expect(page.locator(".match-game")).toHaveClass(/is-unity-hud/, { timeout: 30000 });
    await expect(page.locator(".party-connection")).toHaveCount(0, { timeout: 30000 });
    // The host's scene reports after the countdown; the room keeps the newest snapshot (physical heights).
    await expect.poll(async () => ((await relay()).game as LavaHostGame).seq, { timeout: 60000 }).toBeGreaterThan(5);
    const snap = async () => ((await relay()).game as LavaHostGame).snap!;
    expect((await snap()).physical).toBe(true);
    expect((await snap()).runners.map(r => r.id)).toEqual(session.ids);
    // The other phone's stick moves its runner in the host's simulation.
    const other = async () => (await snap()).runners[1];
    const start = await other();
    await expect(async () => {
      for (let i = 1; i <= 10; i++) await session.control(session.ids[1], { x: 1, y: 0, ax: 0, ay: 0, ha: false, hb: false, ca: 0, cb: 0, cn: 0, n: 0 }, Date.now() + i);
      const now = await other();
      expect(Math.hypot(now.x - start.x, now.y - start.y) + (now.alive ? 0 : 1)).toBeGreaterThan(.5);
    }).toPass({ timeout: 30000 });
    // Only the host may report.
    const current = (await session.state()).partyGame!;
    await expect(new Promise((resolve, reject) => session.sockets[1].timeout(5000).emit("party:unity", { token: session.tokens[session.ids[1]], phaseId: current.phaseId, report: { seq: 999999, done: true } },
      (err: Error | null, response: { ok: boolean; error?: string }) => err ? reject(err) : response.ok ? resolve(response) : reject(new Error(response.error))))).rejects.toThrow(/Host-Handy/);
    await page.screenshot({ path: info.outputPath("unity-lava-host.png") });
    // The other player leaves: the match ends with the host's points.
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible({ timeout: 30000 });
    expect(errors).toEqual([]);
  } finally { session.close(); }
});
