import { test, expect } from "@playwright/test";
import { matchStarted, onlineSession } from "./party-session";
import type { MatchState } from "../../shared/matches/types";
import type { TankGame } from "../../shared/matches/tankTrouble";

// Unity as the rendering of a room's match: the host picks rendering and view in the game menu before
// "Ich bin bereit"; the room computes Tank Trouble, the persistent Unity frame draws it under the app's controls.
for (const view of ["3rd Person", "1st Person"] as const) test(`Tank Trouble mit Unity-Darstellung (${view}): Host wählt im Spielmenü, Raum rechnet, Unity zeichnet`, async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Nur Smartphone");
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (/CSP-VERSTOSS|\[GSG\] Unbekanntes Spiel/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", e => console.log(`CSP-VERSTOSS ${e.violatedDirective} ${e.blockedURI}`)));
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "tanks" });
  try {
    // Default: Unity in the overview; the Unity build already loads during the intro.
    const variant = page.getByRole("group", { name: "Variante" }), views = page.getByRole("group", { name: "Ansicht" });
    await expect(variant.getByRole("button", { name: /Unity/ })).toHaveAttribute("aria-pressed", "true");
    await expect(views.getByRole("button", { name: /Draufsicht/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".unity-match iframe")).toHaveAttribute("src", /^\/unity\/spiele\/index\.html\?spiel=online/);
    // The host picks in the intro (the game menu offers the same choice).
    await views.getByRole("button", { name: new RegExp(view) }).tap();
    await expect(views.getByRole("button", { name: new RegExp(view) })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Spielmenü öffnen" }).tap();
    const menu = page.getByRole("dialog", { name: "Spielmenü" });
    await expect(menu.getByLabel("Ansicht", { exact: true })).toHaveValue(view === "3rd Person" ? "third" : "first");
    await menu.getByRole("button", { name: "Spielmenü schließen" }).tap();
    // Only the host chooses.
    await expect(session.action({ type: "look", renderer: "web", view: "top" }, session.ids[1])).rejects.toThrow(/Host/);

    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const match = async () => (await session.state()).partyGame!.mini!.match as MatchState<TankGame>;
    expect((await match()).id).toBe("tankview");
    const world = page.locator(".match-world");
    await expect(world).toHaveAttribute("data-renderer", "unity");
    await expect(world).toHaveAttribute("data-ready", "true", { timeout: 150000 });
    await expect(page.locator(".match-game")).toHaveClass(/is-unity/);
    await expect(page.locator(".unity-match")).toHaveClass(/is-shown/);
    // Unity reports its camera heading; the stick then drives where the camera looks.
    await expect(world).toHaveAttribute("data-yaw", /^-?\d/, { timeout: 30000 });
    const own = async () => (await match()).players.find(p => p.id === session.ids[0])!.input;
    const forward = async (x: number, y: number) => { const yaw = Number(await world.getAttribute("data-yaw")); return (x * Math.sin(yaw) - y * Math.cos(yaw)) / (Math.hypot(x, y) || 1); };
    const stick = (await page.getByRole("group", { name: "Bewegungsstick" }).boundingBox())!;
    await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2); await page.mouse.down();
    await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2 - 45, { steps: 3 });
    await expect.poll(async () => { const input = await own(); return forward(input.x, input.y); }, { timeout: 5000 }).toBeGreaterThan(.9);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: info.outputPath(`unity-tanks-${view.split(" ")[0]}.png`) });
    await page.mouse.up();
    // Drag on the right half and release: the room registers the shot.
    const aim = (await page.getByRole("group", { name: "Zielen und schießen" }).boundingBox())!;
    await page.mouse.move(aim.x + aim.width / 2, aim.y + aim.height / 2); await page.mouse.down();
    await page.mouse.move(aim.x + aim.width / 2, aim.y + aim.height / 2 - 60, { steps: 3 });
    await page.mouse.up();
    await expect.poll(async () => (await match()).game.tanks[session.ids[0]]?.lastShot ?? 0, { timeout: 5000 }).toBeGreaterThan(0);
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".unity-match")).not.toHaveClass(/is-shown/);
    expect(errors).toEqual([]);
  } finally { session.close(); }
});
