import { test, expect, type Page } from "@playwright/test";
import { matchStarted, onlineSession } from "./party-session";
import type { MatchState } from "../../shared/matches/types";
import type { LavaHostGame } from "../../shared/matches/lavaHost";

// Pilot Floor is Lava with Unity. A: the room computes, Unity draws (own figure predicted).
// B: the host's Unity scene computes for the room; the other phones send inputs and draw the reports.
type Session = Awaited<ReturnType<typeof onlineSession>>;

async function choose(page: Page, renderer: "Unity" | "Unity · Host rechnet") {
  await expect(page.locator(".party-mini-look")).toContainText("Web · 3rd Person");
  await page.locator(".party-mini-look").getByRole("button", { name: "Ändern" }).tap();
  const menu = page.getByRole("dialog", { name: "Spielmenü" });
  await menu.getByLabel("Darstellung", { exact: true }).selectOption({ label: renderer });
  await menu.getByRole("button", { name: "Spielmenü schließen" }).tap();
  await expect(page.locator(".party-mini-look")).toContainText(`${renderer} · 3rd Person`);
}

async function start(page: Page, session: Session) {
  await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
  await session.action({ type: "ready" }, session.ids[1]);
  await matchStarted(page);
  const world = page.locator(".match-world");
  await expect(world).toHaveAttribute("data-renderer", "unity");
  await expect(world).toHaveAttribute("data-ready", "true", { timeout: 150000 });
  await expect(page.locator(".unity-match")).toHaveClass(/is-shown/);
  await expect(world).toHaveAttribute("data-yaw", /^-?\d/, { timeout: 30000 });
  return world;
}

/** Pushes the stick away from the camera; returns how well the own input points along the camera (1 = exactly). */
async function push(page: Page, world: ReturnType<Page["locator"]>, own: () => Promise<{ x: number; y: number }>) {
  const stick = (await page.getByRole("group", { name: "Bewegungsstick" }).boundingBox())!;
  await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2); await page.mouse.down();
  await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2 - 45, { steps: 3 });
  const forward = async () => { const yaw = Number(await world.getAttribute("data-yaw")), i = await own(); return (i.x * Math.sin(yaw) - i.y * Math.cos(yaw)) / (Math.hypot(i.x, i.y) || 1); };
  await expect.poll(forward, { timeout: 5000 }).toBeGreaterThan(.9);
}

for (const variant of ["A", "B"] as const) test(`Floor is Lava mit Unity (${variant === "A" ? "Raum rechnet, Unity zeichnet" : "Host-Handy rechnet mit Unity"})`, async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Nur Smartphone");
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (/CSP-VERSTOSS|\[GSG\] Unbekanntes Spiel/.test(m.text())) errors.push(m.text()); });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "lava" });
  try {
    await choose(page, variant === "A" ? "Unity" : "Unity · Host rechnet");
    // Only the host chooses.
    await expect(session.action({ type: "look", renderer: "web", view: "third" }, session.ids[1])).rejects.toThrow(/Host/);
    const world = await start(page, session);
    const match = async () => (await session.state()).partyGame!.mini!.match as MatchState;
    expect((await match()).id).toBe(variant === "A" ? "lava" : "lavahost");
    await expect(world).toHaveAttribute("data-role", variant === "A" ? "view" : "host");
    const own = async () => (await match()).players.find(p => p.id === session.ids[0])!.input;
    await push(page, world, own);
    if (variant === "B") {
      // The host's Unity scene reports; the room keeps the newest snapshot and relays it to the other phone.
      await expect.poll(async () => ((await match()).game as LavaHostGame).seq, { timeout: 30000 }).toBeGreaterThan(5);
      const snap = async () => ((await match()).game as LavaHostGame).snap!;
      const before = (await snap()).runners.find(r => r.id === session.ids[0])!;
      await page.waitForTimeout(1200);
      const after = (await snap()).runners.find(r => r.id === session.ids[0])!;
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(.5);
      // The other phone's input reaches the host's simulation through the room.
      const other = async () => (await snap()).runners.find(r => r.id === session.ids[1])!;
      const start = await other();
      for (let i = 1; i <= 12; i++) { await session.control(session.ids[1], { x: 1, y: 0, ax: 0, ay: 0, ha: false, hb: false, ca: 0, cb: 0, cn: 0, n: 0 }, i); await page.waitForTimeout(100); }
      await expect.poll(async () => (await other()).x - start.x, { timeout: 5000 }).toBeGreaterThan(.5);
      // Only the host may report.
      const current = (await session.state()).partyGame!;
      await expect(new Promise((resolve, reject) => session.sockets[1].timeout(5000).emit("party:unity", { token: session.tokens[session.ids[1]], phaseId: current.phaseId, report: { seq: 99999, done: true } },
        (err: Error | null, response: { ok: boolean; error?: string }) => err ? reject(err) : response.ok ? resolve(response) : reject(new Error(response.error))))).rejects.toThrow(/Host-Handy/);
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: info.outputPath(`unity-lava-${variant}.png`) });
    await page.mouse.up();
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".unity-match")).not.toHaveClass(/is-shown/);
    expect(errors).toEqual([]);
  } finally { session.close(); }
});
