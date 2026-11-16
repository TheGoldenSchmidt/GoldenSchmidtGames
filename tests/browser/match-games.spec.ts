import { test, expect } from "@playwright/test";
import { matchStarted, onlineSession } from "./party-session";
import type { MatchState } from "../../shared/matches/types";
import type { QuickDrawGame } from "../../shared/matches/quickDraw";
import type { TrailsGame } from "../../shared/matches/lightTrails";
import type { PongGame } from "../../shared/matches/neonPong";
import type { TankGame } from "../../shared/matches/tankTrouble";
import type { BombGame } from "../../shared/matches/bombArena";
import type { LavaGame } from "../../shared/matches/floorIsLava";
import type { ParcoursGame } from "../../shared/matches/parcours";
import type { RingGame } from "../../shared/matches/ringCore";
import type { RunGame } from "../../shared/matches/chaosRun";
import type { ArrowGame } from "../../shared/matches/arrowMasters";
import type { TowerGame } from "../../shared/matches/towerTumble";
import type { HookGame } from "../../shared/matches/hookWars";
import { CHARACTERS } from "../../shared/characters";
import { miniPool } from "../../shared/minigameCatalog";

/** Neue Match-Minispiele: nur Smartphone (Projekt `phone`). */

test("Lobby: neue Spiele, 1st-Generation-Checkbox und 320 Pixel ohne Überlauf", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Online spielen/ }).click();
  await page.getByRole("button", { name: /^Raum erstellen/ }).click();
  await page.getByLabel("Deine Spielfigur").selectOption({label: "Morty Smith"});
  await page.getByRole("button", { name: "Neuen Raum erstellen" }).click();
  await page.getByLabel("Ausgewähltes Spiel").selectOption("goldenschmidt");
  const classic = page.getByRole("checkbox", { name: /1st Generation Minigames/ });
  await expect(classic).toBeChecked();
  await classic.tap();
  await expect(classic).not.toBeChecked();
  await expect(page.getByText(new RegExp(`aus ${miniPool(2, false).length} passenden Spielen`))).toBeVisible();
  await page.getByLabel("Ausgewähltes Spiel").selectOption("free-minigame");
  await page.getByRole("combobox", { name: "Minispiel", exact: true }).selectOption("quickdraw");
  await expect(page.getByText(/Warte auf das rote »ZIEH!«/)).toBeVisible();
  await page.getByLabel("Ausgewähltes Spiel").selectOption("party");
  await expect(page.getByRole("checkbox", { name: /1st Generation Minigames/ })).toBeChecked();
  await page.setViewportSize({ width: 320, height: 760 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("lobby-classic-320.png"), fullPage: true });
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`Quick Draw: Anleitung, Countdown, Schuss per Tipp und Ergebnis (${reducedMotion})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion });
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "quickdraw" });
    try {
      await expect(page.getByRole("heading", { name: "Quick Draw", exact: true })).toBeVisible();
      await expect(page.getByText(/Fehlstart/).first()).toBeVisible();
      await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
      await session.action({ type: "ready" }, session.ids[1]);
      await expect(page.locator(".match-stage canvas")).toBeVisible();
      await expect(page.locator(".match-countdown")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`countdown-${reducedMotion}.png`) });
      await matchStarted(page);
      const trigger = page.getByRole("button", { name: "Ziehen und schießen", exact: true });
      await expect(trigger).toBeEnabled();
      // Warten, bis die Autorität das Signal freigibt, dann wie ein Mensch reagieren.
      const signal = async () => ((await session.state()).partyGame!.mini!.match as MatchState<QuickDrawGame>).game.rounds[0].signalAt;
      await expect.poll(signal, { timeout: 8000, intervals: [50] }).toBeGreaterThan(0);
      await page.waitForTimeout(250);
      await page.screenshot({ path: testInfo.outputPath(`signal-${reducedMotion}.png`) });
      await trigger.tap();
      await expect(trigger).toBeDisabled();
      await expect.poll(async () => {
        const g = ((await session.state()).partyGame!.mini!.match as MatchState<QuickDrawGame>).game;
        return g.rounds[0].resolvedAt !== undefined || Boolean(g.rounds[0].shots[session.ids[0]]);
      }).toBe(true);
      const own = async () => ((await session.state()).partyGame!.mini!.match as MatchState<QuickDrawGame>).game.rounds[0].shots[session.ids[0]];
      await expect.poll(async () => (await own())?.early).toBe(false);
      // Die zweite Person gibt auf: das Duell endet, Ergebnis und Rückkehr.
      await session.action({ type: "finish" }, session.ids[1]);
      await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
      await expect(page.getByRole("list", { name: "Minispielergebnis", exact: true })).toContainText("Bestzeit");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`result-${reducedMotion}.png`), fullPage: true });
      // Online rooms return to their lobby after the game.
      await page.getByRole("button", { name: "Zurück zur Lobby", exact: true }).tap();
      await expect(page.getByRole("heading", { name: "Mitspieler", exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    } finally { session.close(); }
  });
}

test("Quick Draw: Fehlstart vor dem Signal und Übung gegen Bots", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "quickdraw" });
  try {
    await page.getByRole("button", { name: "Erst kurz üben", exact: true }).tap();
    const dialog = page.getByRole("dialog", { name: "Übung: Quick Draw" });
    await expect(dialog.locator(".match-stage canvas")).toBeVisible();
    await expect(dialog.locator(".match-standings li")).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath("practice.png") });
    await dialog.getByRole("button", { name: "Übung schließen" }).tap();
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    await page.getByRole("button", { name: "Ziehen und schießen", exact: true }).tap();
    const round = async () => ((await session.state()).partyGame!.mini!.match as MatchState<QuickDrawGame>).game.rounds[0];
    await expect.poll(async () => (await round()).shots[session.ids[0]]?.early).toBe(true);
    await expect.poll(async () => (await round()).winners).toEqual([session.ids[1]]);
    await expect(page.locator(".match-feedback")).toContainText(/Fehlstart|Treffer|Kein gültiger/);
  } finally { session.close(); }
});

test("Light Trails: Wischen und Abbiegetasten lenken den eigenen Gleiter", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "trails" });
  try {
    await expect(page.getByRole("heading", { name: "Light Trails", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const rider = async () => ((await session.state()).partyGame!.mini!.match as MatchState<TrailsGame>).game.riders[session.ids[0]];
    const start = await rider();
    const zone = page.getByRole("group", { name: "Wischen, um abzubiegen" });
    const box = (await zone.boundingBox())!;
    // Echte Wischgeste: senkrecht zur Fahrtrichtung.
    const vertical = start.dir === 1 || start.dir === 3, cx = box.x + box.width / 2, cy = box.y + box.height / 3;
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.mouse.move(vertical ? cx : cx + 60, vertical ? cy + 60 : cy, { steps: 4 }); await page.mouse.up();
    await expect.poll(async () => (await rider()).path.length, { timeout: 3000 }).toBeGreaterThan(1);
    await page.getByRole("button", { name: "Links", exact: true }).tap();
    await expect.poll(async () => (await rider()).path.length, { timeout: 3000 }).toBeGreaterThan(2);
    await page.screenshot({ path: testInfo.outputPath("trails.png") });
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

for (const players of [2, 4] as const) test(`Neon Pong ${players === 2 ? "1v1" : "2v2"}: Finger zieht den eigenen Schläger, eigenes Tor unten`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const characters = CHARACTERS.slice(0, players).map(c => c.id);
  const session = await onlineSession(page, false, characters, false, "free-minigame", { miniId: "pong" });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    for (const id of session.ids.slice(1)) await session.action({ type: "ready" }, id);
    await matchStarted(page);
    const slider = page.getByRole("slider", { name: "Schläger bewegen" }), box = (await slider.boundingBox())!;
    const paddle = async () => ((await session.state()).partyGame!.mini!.match as MatchState<PongGame>).game.paddles.find(p => p.id === session.ids[0])!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + 4, box.y + box.height / 2, { steps: 5 });
    await expect.poll(async () => { const p = await paddle(); return Math.abs(p.x - p.min) < .2; }, { timeout: 4000 }).toBe(true);
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 5 }); await page.mouse.up();
    await expect.poll(async () => { const p = await paddle(); return Math.abs(p.x - p.max) < .2; }, { timeout: 4000 }).toBe(true);
    await expect(page.getByRole("status").filter({ hasText: players === 4 ? "2 gegen 2" : "noch" }).first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`pong-${players}.png`) });
    for (const id of session.ids.slice(1)) if ((await session.state()).partyGame!.phase === "mini-play") await session.action({ type: "finish" }, id);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});


/** Swipes horizontally across the camera area and returns how far the chase camera turned (radians). */
async function swipeCamera(page: import("@playwright/test").Page, area: { x: number; y: number }, dx = 120) {
  const world = page.locator(".match-world"), before = Number(await world.getAttribute("data-yaw"));
  await page.mouse.move(area.x, area.y); await page.mouse.down();
  await page.mouse.move(area.x + dx, area.y, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(150);
  return Number(await world.getAttribute("data-yaw")) - before;
}

for (const motion of ["no-preference", "reduce"] as const) test(`Tank Trouble 2.5D (${motion}): Figuren in den Panzern, Stick fährt, Laser beim Zielen, Loslassen schießt`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: motion });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "tanks" });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const world = page.locator(".match-world");
    await expect(world).toHaveAttribute("data-webgl", "ready");
    const chosen = Object.fromEntries((await session.state()).partyGame!.players.map(p => [p.id, p.characterId]));
    await expect.poll(async () => JSON.parse(await world.getAttribute("data-figures") ?? "{}")).toEqual(chosen);
    const tank = async () => ((await session.state()).partyGame!.mini!.match as MatchState<TankGame>).game.tanks[session.ids[0]];
    const start = await tank();
    const stick = page.getByRole("group", { name: "Bewegungsstick" }), box = (await stick.boundingBox())!;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2, toCentre = Math.sign(5.6 - start.x) || 1;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 40 * toCentre, cy - 10, { steps: 3 });
    await expect.poll(async () => Math.hypot((await tank()).x - start.x, (await tank()).y - start.y), { timeout: 4000 }).toBeGreaterThan(.3);
    await page.mouse.up();
    await expect(world).toHaveAttribute("data-laser", "off");
    const aim = page.getByRole("group", { name: "Zielen und schießen" }), area = (await aim.boundingBox())!;
    await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2); await page.mouse.down();
    // Aim into the field (towards its centre) so laser and bullet are visible.
    const here = await tank(), ax = Math.sign(5.6 - here.x) || 1, ay = Math.sign(8.8 - here.y) || 1;
    await page.mouse.move(area.x + area.width / 2 + 50 * ax, area.y + area.height / 2 + 15 * ay, { steps: 3 });
    await expect(world).toHaveAttribute("data-laser", "on");
    await page.screenshot({ path: testInfo.outputPath(`tanks-3d-aim-${motion}.png`) });
    await page.mouse.up();
    await expect.poll(async () => (await tank()).lastShot, { timeout: 4000 }).toBeGreaterThan(0);
    await expect(world).toHaveAttribute("data-laser", "off");
    await page.waitForTimeout(250);
    await page.screenshot({ path: testInfo.outputPath(`tanks-3d-shot-${motion}.png`) });
    expect(Number(await world.getAttribute("data-draw-calls"))).toBeLessThan(300);
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

for (const motion of ["no-preference", "reduce"] as const) test(`Tank Trouble – Turmsicht (${motion}): Kamera hinter dem Panzer, Stick und Zielen relativ zur Kamera, Schuss`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: motion });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "tankview" });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const world = page.locator(".match-world");
    await expect(world).toHaveAttribute("data-webgl", "ready");
    await expect(world).toHaveAttribute("data-camera", "chase");
    const match = async () => (await session.state()).partyGame!.mini!.match as MatchState<TankGame>;
    const own = async () => (await match()).players.find(p => p.id === session.ids[0])!.input;
    /** Cosine between a field direction and the camera's view direction. */
    const forward = async (x: number, y: number) => { const yaw = Number(await world.getAttribute("data-yaw")); return (x * Math.sin(yaw) - y * Math.cos(yaw)) / (Math.hypot(x, y) || 1); };
    // Stick up = drive where the camera looks.
    const stick = (await page.getByRole("group", { name: "Bewegungsstick" }).boundingBox())!;
    await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2); await page.mouse.down();
    await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2 - 45, { steps: 3 });
    await expect.poll(async () => { const input = await own(); return forward(input.x, input.y); }, { timeout: 3000 }).toBeGreaterThan(.9);
    await page.mouse.up();
    // Swiping on the upper left turns the camera.
    const stage = (await page.locator(".match-stage").boundingBox())!;
    expect(Math.abs(await swipeCamera(page, { x: stage.x + 30, y: stage.y + stage.height * .2 }, 100))).toBeGreaterThan(.4);
    // Drag up on the right half = aim ahead; release fires.
    const aim = (await page.getByRole("group", { name: "Zielen und schießen" }).boundingBox())!;
    await page.mouse.move(aim.x + aim.width / 2, aim.y + aim.height / 2); await page.mouse.down();
    await page.mouse.move(aim.x + aim.width / 2, aim.y + aim.height / 2 - 60, { steps: 3 });
    await expect(world).toHaveAttribute("data-laser", "on");
    await expect.poll(async () => { const input = await own(); return forward(input.ax, input.ay); }, { timeout: 3000 }).toBeGreaterThan(.9);
    await page.screenshot({ path: testInfo.outputPath(`tankview-aim-${motion}.png`) });
    await page.mouse.up();
    await expect.poll(async () => (await match()).game.tanks[session.ids[0]].lastShot, { timeout: 4000 }).toBeGreaterThan(0);
    // This device only receives what the own tank sees: the opponent is there only with a free line of sight.
    const view = await match(), mine = view.game.tanks[session.ids[0]], other = view.game.tanks[session.ids[1]];
    if (other) expect(Math.hypot(other.x - mine.x, other.y - mine.y)).toBeLessThanOrEqual(6.01);
    expect(Number(await world.getAttribute("data-draw-calls"))).toBeLessThan(300);
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

for (const motion of ["no-preference", "reduce"] as const) test(`Bomb Arena 2.5D (${motion}): Figuren im 3D-Feld, Stick läuft, Bombe zerstört Kisten`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: motion });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "bombs" });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const world = page.locator(".match-world");
    await expect(world).toHaveAttribute("data-webgl", "ready");
    // The chosen figures of both players stand in the field.
    const chosen = Object.fromEntries((await session.state()).partyGame!.players.map(p => [p.id, p.characterId]));
    await expect.poll(async () => JSON.parse(await world.getAttribute("data-figures") ?? "{}")).toEqual(chosen);
    await expect(page.locator(".match-canvas")).toHaveCount(0);
    const game = async () => ((await session.state()).partyGame!.mini!.match as MatchState<BombGame>).game;
    await page.getByRole("button", { name: "Bombe", exact: true }).tap();
    await expect.poll(async () => (await game()).bombs.filter(b => b.owner === session.ids[0]).length).toBe(1);
    const start = (await game()).bombers[session.ids[0]];
    const stick = page.getByRole("group", { name: "Bewegungsstick" }), box = (await stick.boundingBox())!;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    // Vom Start (1,1) führt der freie Weg nach rechts oder unten.
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 45, cy, { steps: 3 });
    await expect.poll(async () => (await game()).bombers[session.ids[0]].cx !== start.cx, { timeout: 4000 }).toBe(true);
    await page.mouse.up();
    await page.screenshot({ path: testInfo.outputPath(`bombs-3d-${motion}.png`) });
    // The bomb goes off after its fuse; flames burn only briefly, so wait for the bomb to vanish.
    await expect.poll(async () => (await game()).bombs.filter(b => b.owner === session.ids[0]).length, { timeout: 4000 }).toBe(0);
    await page.screenshot({ path: testInfo.outputPath(`bombs-3d-boom-${motion}.png`) });
    expect(Number(await world.getAttribute("data-draw-calls"))).toBeLessThan(300);
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

for (const [miniId, name] of [["bombs", "Bomb Arena"], ["tanks", "Tank Trouble"], ["lava", "Floor is Lava"], ["sumo", "Sumo Smash"], ["chaosrun", "Chaos Run"]] as const) test(`${name} 2.5D mit sechs Figuren: alle stehen im Feld, Zeichenaufwand bleibt begrenzt`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const six = ["alpha_rick_prime", "alpha_morty_smith", "alpha_summer_smith", "alpha_eric_cartman", "alpha_korvo", "alpha_mr_poopybutthole"] as const;
  const session = await onlineSession(page, false, [...six], false, "free-minigame", { miniId });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    for (const other of session.ids.slice(1)) await session.action({ type: "ready" }, other);
    await matchStarted(page);
    const world = page.locator(".match-world");
    // Sumo Smash and Chaos Run use the rigged characters: six different looks (body, skin, hair) instead of the chosen figures.
    await expect.poll(async () => { const looks = Object.values(JSON.parse(await world.getAttribute("data-figures") ?? "{}")) as string[]; return miniId === "sumo" || miniId === "chaosrun" ? new Set(looks).size : looks.sort(); }, { timeout: 20000 }).toEqual(miniId === "sumo" || miniId === "chaosrun" ? 6 : [...six].sort());
    // Measure while all figures are still on the field (in Floor is Lava idle players soon sink).
    await expect.poll(async () => Number(await world.getAttribute("data-draw-calls")), { timeout: 5000 }).toBeGreaterThan(40);
    const calls = Number(await world.getAttribute("data-draw-calls")), triangles = Number(await world.getAttribute("data-triangles"));
    console.log(`${name} 2.5D, six figures:`, { calls, triangles });
    expect(calls).toBeLessThan(300);
    await page.screenshot({ path: testInfo.outputPath(`${miniId}-3d-six.png`) });
    for (const other of session.ids.slice(1)) await session.action({ type: "finish" }, other);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

for (const [miniId, name] of [["bombs", "Bomb Arena"], ["tanks", "Tank Trouble"], ["lava", "Floor is Lava"], ["sumo", "Sumo Smash"], ["chaosrun", "Chaos Run"]] as const) test(`${name} ohne WebGL: die 2D-Fläche übernimmt, das Spiel läuft bis zum Ergebnis`, async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      return kind.startsWith("webgl") ? null : (original as (...a: unknown[]) => RenderingContext | null).call(this, kind, ...rest);
    } as typeof original;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    await expect(page.locator(".match-canvas")).toBeVisible();
    await expect(page.locator(".match-world")).toHaveCount(0);
    if (miniId === "bombs") {
      await page.getByRole("button", { name: "Bombe", exact: true }).tap();
      await expect.poll(async () => ((await session.state()).partyGame!.mini!.match as MatchState<BombGame>).game.bombs.length).toBe(1);
    }
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

for (const motion of ["no-preference", "reduce"] as const) test(`Floor is Lava 2.5D (${motion}): Figuren auf Tempelplatten, Platten zerbröseln, Springen und Schubsen`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: motion });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "lava" });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const world = page.locator(".match-world");
    await expect(world).toHaveAttribute("data-webgl", "ready");
    const chosen = Object.fromEntries((await session.state()).partyGame!.players.map(p => [p.id, p.characterId]));
    await expect.poll(async () => JSON.parse(await world.getAttribute("data-figures") ?? "{}")).toEqual(chosen);
    const game = async () => ((await session.state()).partyGame!.mini!.match as MatchState<LavaGame>).game;
    const me = async () => (await game()).runners[session.ids[0]];
    // Chase camera by default; the stick is relative to it: up runs where the camera looks.
    await expect(world).toHaveAttribute("data-camera", "chase");
    const own = async () => ((await session.state()).partyGame!.mini!.match as MatchState<LavaGame>).players.find(p => p.id === session.ids[0])!.input;
    {
      const pad = (await page.getByRole("group", { name: "Bewegungsstick" }).boundingBox())!;
      await page.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2); await page.mouse.down();
      await page.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2 - 45, { steps: 3 });
      await expect.poll(async () => { const yaw = Number(await world.getAttribute("data-yaw")), input = await own(); return input.x * Math.sin(yaw) - input.y * Math.cos(yaw); }, { timeout: 3000 }).toBeGreaterThan(.9);
      await page.mouse.up();
    }
    await page.screenshot({ path: testInfo.outputPath(`lava-3d-chase-${motion}.png`) });
    await page.getByRole("button", { name: "Übersicht", exact: true }).tap();
    await expect(world).toHaveAttribute("data-camera", "overview");
    await expect(page.getByRole("button", { name: "Übersicht", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Übersicht", exact: true }).tap();
    await expect(world).toHaveAttribute("data-camera", "chase");
    // Swiping on the free stage turns the camera (hint until the first swipe).
    await expect(page.getByText("wischen: Kamera drehen")).toBeVisible();
    const stage = (await page.locator(".match-stage").boundingBox())!;
    expect(Math.abs(await swipeCamera(page, { x: stage.x + 60, y: stage.y + stage.height * .35 }))).toBeGreaterThan(.5);
    await expect(page.getByText("wischen: Kamera drehen")).toHaveCount(0);
    await expect.poll(async () => (await game()).tiles.includes("2")).toBe(true);
    const start = await me();
    const stick = page.getByRole("group", { name: "Bewegungsstick" }), box = (await stick.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, { steps: 3 });
    await expect.poll(async () => Math.hypot((await me()).x - start.x, (await me()).y - start.y), { timeout: 4000 }).toBeGreaterThan(.4);
    await page.getByRole("button", { name: "Springen", exact: true }).tap();
    await expect.poll(async () => (await me()).airUntil, { timeout: 3000 }).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath(`lava-3d-jump-${motion}.png`) });
    await page.mouse.up();
    // After landing: the shove starts a dash and its cooldown.
    await page.waitForTimeout(700);
    // Tap again if the figure was just dropping a floor (shoves need solid ground).
    await expect.poll(async () => { if ((await me()).shoveReady > start.shoveReady) return true; await page.getByRole("button", { name: "Schubsen", exact: true }).tap(); return false; }, { timeout: 6000, intervals: [300] }).toBe(true);
    await page.waitForTimeout(500);
    await page.screenshot({ path: testInfo.outputPath(`lava-3d-crumble-${motion}.png`) });
    // Standing still: the slab crumbles and the figure drops to the floor below.
    // (The idle opponent may end the round meanwhile; a new round starts on the top floor again.)
    const match = async () => (await session.state()).partyGame!.mini!.match as MatchState<LavaGame>;
    await expect.poll(async () => { const m = await match(); return m.game.runners[session.ids[0]].floor > 0 || m.events.some(e => e.kind === "drop" && e.ids[0] === session.ids[0]); }, { timeout: 8000 }).toBe(true);
    await page.waitForTimeout(700);
    await page.screenshot({ path: testInfo.outputPath(`lava-3d-floor-${motion}.png`) });
    expect(Number(await world.getAttribute("data-draw-calls"))).toBeLessThan(300);
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

for (const motion of ["no-preference", "reduce"] as const) test(`Sumo Smash 2.5D (${motion}): animierte Figuren, Kamera rahmt alle, Stoß`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: motion });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "sumo" });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const world = page.locator(".match-world");
    await expect(world).toHaveAttribute("data-webgl", "ready", { timeout: 15000 });
    await expect.poll(async () => Object.keys(JSON.parse(await world.getAttribute("data-figures") ?? "{}")).sort()).toEqual([...session.ids].sort());
    const fighter = async () => ((await session.state()).partyGame!.mini!.match as MatchState<RingGame>).game.fighters[session.ids[0]];
    const start = await fighter();
    // Walk towards the centre, then dash.
    const stick = page.getByRole("group", { name: "Bewegungsstick" }), box = (await stick.boundingBox())!;
    const len = Math.hypot(start.x, start.y) || 1;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - start.x / len * 40, box.y + box.height / 2 - start.y / len * 40, { steps: 3 });
    await expect.poll(async () => Math.hypot((await fighter()).x - start.x, (await fighter()).y - start.y), { timeout: 4000 }).toBeGreaterThan(.4);
    await page.screenshot({ path: testInfo.outputPath(`sumo-3d-walk-${motion}.png`) });
    await page.getByRole("button", { name: "Stoß", exact: true }).tap();
    await expect.poll(async () => (await fighter()).actionAt, { timeout: 3000 }).toBeGreaterThan(0);
    await page.mouse.up();
    await page.waitForTimeout(200);
    await page.screenshot({ path: testInfo.outputPath(`sumo-3d-dash-${motion}.png`) });
    expect(Number(await world.getAttribute("data-draw-calls"))).toBeLessThan(300);
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

for (const [miniId, name] of [["sumo", "Sumo Smash"], ["bombs", "Bomb Arena"]] as const) test(`${name}: gewählte animierte Figuren (Rapper, Roboter) stehen im Spiel`, async ({ page }, testInfo) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const session = await onlineSession(page, false, ["rig_mc_goldie", "rig_bolt"], false, "free-minigame", { miniId });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const world = page.locator(".match-world");
    await expect(world).toHaveAttribute("data-webgl", "ready", { timeout: 20000 });
    await expect.poll(async () => JSON.parse(await world.getAttribute("data-figures") ?? "{}"), { timeout: 20000 }).toEqual({ [session.ids[0]]: "rig_mc_goldie", [session.ids[1]]: "rig_bolt" });
    await expect.poll(async () => Number(await world.getAttribute("data-frames")), { timeout: 5000 }).toBeGreaterThan(20);
    await page.screenshot({ path: testInfo.outputPath(`${miniId}-rigged-choice.png`) });
    expect(errors).toEqual([]);
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

for (const [miniId, button] of [["sumo", "Stoß"], ["bumpercars", "Turbo"]] as const) test(`${miniId === "sumo" ? "Sumo Smash" : "Bumper Mayhem"}: Stick bewegt, ${button}-Knopf löst die Aktion aus`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const me = async () => ((await session.state()).partyGame!.mini!.match as MatchState<RingGame>).game.fighters[session.ids[0]];
    const start = await me();
    const stick = page.getByRole("group", { name: "Bewegungsstick" }), box = (await stick.boundingBox())!;
    // Richtung Mitte steuern (Start oben am Ring).
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 3 });
    await expect.poll(async () => Math.hypot((await me()).x - start.x, (await me()).y - start.y), { timeout: 4000 }).toBeGreaterThan(.4);
    await page.getByRole("button", { name: button, exact: true }).tap();
    await expect.poll(async () => (await me()).actionAt, { timeout: 3000 }).toBeGreaterThan(0);
    await page.mouse.up();
    await page.screenshot({ path: testInfo.outputPath(`${miniId}.png`) });
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

for (const motion of ["no-preference", "reduce"] as const) test(`Chaos Run 2.5D (${motion}): Figuren in eigenen Spuren, Tippen springt, wischen rutscht, Fortschritt läuft`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: motion });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "chaosrun" });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const world = page.locator(".match-world");
    await expect(world).toHaveAttribute("data-webgl", "ready", { timeout: 20000 });
    await expect.poll(async () => Object.keys(JSON.parse(await world.getAttribute("data-figures") ?? "{}")).sort(), { timeout: 20000 }).toEqual([...session.ids].sort());
    const me = async () => ((await session.state()).partyGame!.mini!.match as MatchState<RunGame>).game.runners[session.ids[0]];
    const zone = page.getByRole("group", { name: /Tippen zum Springen/ }), box = (await zone.boundingBox())!;
    await zone.tap({ position: { x: box.width / 2, y: box.height / 3 } });
    await expect.poll(async () => (await me()).jumpAt, { timeout: 3000 }).toBeGreaterThan(0);
    await page.waitForTimeout(900);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3 + 60, { steps: 4 }); await page.mouse.up();
    await expect.poll(async () => (await me()).slideUntil, { timeout: 3000 }).toBeGreaterThan(0);
    await expect.poll(async () => (await me()).best, { timeout: 3000 }).toBeGreaterThan(5);
    await page.screenshot({ path: testInfo.outputPath(`chaosrun-3d-${motion}.png`) });
    expect(Number(await world.getAttribute("data-draw-calls"))).toBeLessThan(300);
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

test("Arrow Masters: Ziehen spannt den Bogen, alle Pfeile fliegen nach der Zielphase", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "arrows" });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const game = async () => ((await session.state()).partyGame!.mini!.match as MatchState<ArrowGame>).game;
    const pad = page.getByRole("group", { name: "Bogen spannen und zielen" }), box = (await pad.boundingBox())!;
    // Nach unten links ziehen = nach oben rechts schießen.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 70, box.y + box.height / 3 + 70, { steps: 4 });
    await expect.poll(async () => (await game()).archers[session.ids[0]].aim?.power ?? 0).toBeGreaterThan(.5);
    await page.mouse.up();
    await page.screenshot({ path: testInfo.outputPath("arrows-aim.png") });
    await expect.poll(async () => (await game()).phase, { timeout: 15000 }).not.toBe("aim");
    expect((await game()).arrows.some(a => a.owner === session.ids[0])).toBe(true);
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

test("Tower Tumble: alle bauen gleichzeitig, Pfeile verschieben, Drehen und Fallen setzen den Stein auf", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "tower" });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const tower = async (id: string) => ((await session.state()).partyGame!.mini!.match as MatchState<TowerGame>).game.towers[id];
    await expect.poll(async () => (await tower(session.ids[0]))?.piece?.k, { timeout: 5000 }).toBeTruthy();
    expect((await tower(session.ids[1])).piece, "Beide bauen gleichzeitig").toBeTruthy();
    const start = (await tower(session.ids[0])).piece!;
    const commands = async () => ((await session.state()).partyGame!.mini!.match as MatchState<TowerGame>).players.find(p => p.id === session.ids[0])!.usedN;
    const before = await commands();
    // Three taps: one half cell each (rules test covers the exact positions; here the piece may land early on a slow machine).
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Links", exact: true }).tap();
    await expect.poll(commands, { timeout: 3000 }).toBe(before + 3);
    const moved = (await tower(session.ids[0])).piece;
    if (moved?.n === start.n) expect(moved.tx).toBeCloseTo(start.tx - 1.5, 5);
    // Holding repeats the step.
    const right = (await page.getByRole("button", { name: "Rechts", exact: true }).boundingBox())!;
    await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2); await page.mouse.down();
    await expect.poll(commands, { timeout: 3000 }).toBeGreaterThan(before + 6);
    await page.mouse.up();
    await page.waitForTimeout(300); // a command sent just before release may still be on its way
    const settled = await commands(); await page.waitForTimeout(400);
    expect(await commands(), "Loslassen stoppt die Wiederholung").toBe(settled);
    const turned = (await tower(session.ids[0])).piece!.r;
    await page.getByRole("button", { name: "Drehen" }).tap();
    await expect.poll(async () => (await tower(session.ids[0])).piece!.r).toBe((turned + 1) % 4);
    await page.screenshot({ path: testInfo.outputPath("tower-aim.png") });
    // Hold the drop button until the piece has landed.
    const drop = page.getByRole("button", { name: "Fallen" }), d = (await drop.boundingBox())!;
    await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2); await page.mouse.down();
    await expect.poll(async () => (await tower(session.ids[0])).placed, { timeout: 5000 }).toBeGreaterThan(0);
    await page.mouse.up();
    await page.waitForTimeout(600);
    await page.screenshot({ path: testInfo.outputPath("tower-landed.png") });
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

test("Hook Wars: Stick läuft, rechts ziehen schießt den Haken, loslassen löst ihn", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "hooks" });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const me = async () => ((await session.state()).partyGame!.mini!.match as MatchState<HookGame>).game.bots[session.ids[0]];
    const start = await me();
    const stick = page.getByRole("group", { name: "Bewegungsstick" }), box = (await stick.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 3 });
    await expect.poll(async () => (await me()).x - start.x, { timeout: 4000 }).toBeGreaterThan(.3);
    await page.mouse.up();
    // Haken nach rechts oben: Richtung des Ankers über der Startplattform.
    const pad = page.getByRole("group", { name: "Greifhaken zielen und halten" }), area = (await pad.boundingBox())!;
    await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2); await page.mouse.down();
    await page.mouse.move(area.x + area.width / 2 + 30, area.y + area.height / 2 - 60, { steps: 3 });
    await expect.poll(async () => (await me()).lastShot?.at ?? -1, { timeout: 4000 }).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath("hooks.png") });
    await page.mouse.up();
    await expect.poll(async () => (await me()).hook, { timeout: 3000 }).toBeUndefined();
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

for (const motion of ["no-preference", "reduce"] as const) test(`Hindernis-Parcours Türenlotto (${motion}): Verfolgerkamera, Laufen, Springen, Hechten, Ducken, Festhalten`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: motion });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "tuerenlotto" });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const world = page.locator(".match-world");
    await expect(world).toHaveAttribute("data-webgl", "ready", { timeout: 20000 });
    await expect(world).toHaveAttribute("data-camera", "chase");
    const match = async () => (await session.state()).partyGame!.mini!.match as MatchState<ParcoursGame>;
    const me = async () => (await match()).game.racers[session.ids[0]];
    const start = await me();
    // Stick up runs forward along the course (the camera looks forward at the start).
    const stick = (await page.getByRole("group", { name: "Bewegungsstick" }).boundingBox())!;
    await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2); await page.mouse.down();
    await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2 - 45, { steps: 3 });
    await expect.poll(async () => (await me()).z - start.z, { timeout: 4000 }).toBeGreaterThan(1.5);
    await page.mouse.up();
    const stage = (await page.locator(".match-stage").boundingBox())!;
    expect(Math.abs(await swipeCamera(page, { x: stage.x + 60, y: stage.y + stage.height * .3 }))).toBeGreaterThan(.5);
    await page.getByRole("button", { name: "Springen", exact: true }).tap();
    await expect.poll(async () => (await match()).players.find(p => p.id === session.ids[0])!.usedA, { timeout: 3000 }).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath(`parcours-jump-${motion}.png`) });
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: "Hechten", exact: true }).tap();
    await expect.poll(async () => (await match()).players.find(p => p.id === session.ids[0])!.usedB, { timeout: 3000 }).toBeGreaterThan(0);
    await page.waitForTimeout(900);
    // Holding buttons: duck and hold on.
    for (const [name, key] of [["Ducken", "hb"], ["Festhalten", "ha"]] as const) {
      const b = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
      await expect.poll(async () => (await match()).players.find(p => p.id === session.ids[0])!.input[key], { timeout: 3000 }).toBe(true);
      await page.mouse.up();
      await expect.poll(async () => (await match()).players.find(p => p.id === session.ids[0])!.input[key], { timeout: 3000 }).toBe(false);
    }
    await page.screenshot({ path: testInfo.outputPath(`parcours-run-${motion}.png`) });
    expect(Number(await world.getAttribute("data-draw-calls"))).toBeLessThan(300);
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

for (const [miniId, name] of [["tuerenlotto", "Türenlotto"], ["kreiselkurs", "Kreiselkurs"], ["wippenwerk", "Wippenwerk"], ["glibberflut", "Glibberflut"], ["geisterpfad", "Geisterpfad"], ["fallklappen", "Fallklappen"], ["windkanal", "Windkanal"], ["kletterwand", "Kletterwand"], ["standhaft", "Standhaft"]] as const) test(`${name} mit sechs Figuren: Strecke und Figuren stehen, Zeichenaufwand begrenzt`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const six = ["alpha_rick_prime", "alpha_morty_smith", "alpha_summer_smith", "alpha_eric_cartman", "alpha_korvo", "alpha_mr_poopybutthole"] as const;
  const session = await onlineSession(page, false, [...six], false, "free-minigame", { miniId });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    for (const other of session.ids.slice(1)) await session.action({ type: "ready" }, other);
    await matchStarted(page);
    const world = page.locator(".match-world");
    await expect.poll(async () => Object.keys(JSON.parse(await world.getAttribute("data-figures") ?? "{}")).length, { timeout: 20000 }).toBe(6);
    await expect.poll(async () => Number(await world.getAttribute("data-draw-calls")), { timeout: 5000 }).toBeGreaterThan(20);
    const calls = Number(await world.getAttribute("data-draw-calls")), triangles = Number(await world.getAttribute("data-triangles"));
    console.log(`${name}, six figures:`, { calls, triangles });
    expect(calls).toBeLessThan(300);
    await page.screenshot({ path: testInfo.outputPath(`${miniId}-six.png`) });
    for (const other of session.ids.slice(1)) await session.action({ type: "finish" }, other);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

test("Hindernis-Parcours ohne WebGL: die 2D-Draufsicht übernimmt, das Spiel läuft bis zum Ergebnis", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      return kind.startsWith("webgl") ? null : (original as (...a: unknown[]) => RenderingContext | null).call(this, kind, ...rest);
    } as typeof original;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "kreiselkurs" });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    await expect(page.locator(".match-canvas")).toBeVisible();
    await expect(page.locator(".match-world")).toHaveCount(0);
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

test("Testmodus (?messung): Messfeld mit FPS, Netz und Kamera-Reglern, Werte bleiben auf dem Gerät", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("gsg-messung", "1"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "kreiselkurs" });
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    const panel = page.getByRole("complementary", { name: "Messwerte für den Gerätetest" });
    await expect(panel).toBeVisible();
    await expect.poll(async () => Number((await panel.getByRole("button", { name: /^Messung/ }).textContent())!.match(/(\d+) FPS/)?.[1] ?? 0), { timeout: 5000 }).toBeGreaterThan(0);
    await expect(panel.getByText(/Netz: \d+ ms/)).toBeVisible();
    const distance = panel.getByRole("slider").first();
    await distance.fill("1.3");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("gsg-messung-kamera-kreiselkurs") ?? "{}").camDistK)).toBe(1.3);
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
  } finally { session.close(); }
});

test("Hindernis-Parcours: wer raus ist, schaut zu und wechselt die gezeigte Person", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const session = await onlineSession(page, false, ["alpha_rick_prime", "alpha_morty_smith", "alpha_summer_smith"], false, "free-minigame", { miniId: "kreiselkurs" }, ["Anna", "Ben", "Clara"]);
  try {
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    for (const other of session.ids.slice(1)) await session.action({ type: "ready" }, other);
    await matchStarted(page);
    const world = page.locator(".match-world");
    await expect(world).toHaveAttribute("data-watch", session.ids[0], { timeout: 20000 });
    // Keep the others "racing": they send neutral input; this device gives up.
    await session.action({ type: "finish" }, session.ids[0]);
    const next = page.getByRole("button", { name: "Nächste Person zeigen" });
    await expect(next).toBeVisible();
    await expect.poll(() => world.getAttribute("data-watch")).not.toBe(session.ids[0]);
    const first = await world.getAttribute("data-watch");
    expect([session.ids[1], session.ids[2]]).toContain(first);
    await next.tap();
    await expect.poll(() => world.getAttribute("data-watch")).not.toBe(first);
    await page.screenshot({ path: testInfo.outputPath("parcours-watch.png") });
  } finally { session.close(); }
});
