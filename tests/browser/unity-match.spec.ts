import { test, expect } from "@playwright/test";
import { matchStarted, onlineSession } from "./party-session";
import type { MatchState } from "../../shared/matches/types";
import type { TankGame } from "../../shared/matches/tankTrouble";

/** Like people in the intro: wait until the Unity frame (loading since the intro) is up before "Ich bin bereit". */
async function unityLoaded(page: import("@playwright/test").Page) {
  await expect.poll(() => page.frames().some(f => f.url().includes("spiel=online")), { timeout: 30000 }).toBe(true);
  const frame = page.frames().find(f => f.url().includes("spiel=online"))!;
  await frame.waitForFunction(() => (window as unknown as { gsgUnity?: unknown }).gsgUnity, null, { timeout: 150000 });
}

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

    await unityLoaded(page);
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
    // Unity's own HUD takes over: the app keeps only its menu and sound toggle; touches reach the Unity frame.
    await expect(page.locator(".match-game")).toHaveClass(/is-unity-hud/, { timeout: 30000 });
    // The software-rendered test browser may stall while Unity loads the scene; the app's socket then reconnects.
    await expect(page.locator(".party-connection")).toHaveCount(0, { timeout: 30000 });
    // Unity counts 3-2-1 itself (the app's countdown is hidden): wait for the room's start signal.
    await expect.poll(async () => (await session.state()).partyGame!.mini!.match!.time, { timeout: 15000 }).toBeGreaterThan(300);
    await expect(page.getByRole("group", { name: "Bewegungsstick" })).toHaveCount(0);
    await expect(page.locator(".match-hud__info")).toBeHidden();
    await expect(page.getByRole("button", { name: /Ton (aus|ein)schalten/ })).toBeVisible();
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", points: [number, number][]) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id: id + 1 })) });
    // Own tank alive (controls shown), then push Unity's stick up: the room gets "where the camera looks".
    await expect.poll(async () => (await match()).game.tanks[session.ids[0]]?.alive ?? false, { timeout: 10000 }).toBe(true);
    await page.waitForTimeout(500);
    await touch("touchStart", [[80, 740]]);
    for (const dy of [15, 30, 45, 60]) await touch("touchMove", [[80, 740 - dy]]);
    await expect.poll(async () => { const input = await own(); return forward(input.x, input.y); }, { timeout: 5000 }).toBeGreaterThan(.9);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: info.outputPath(`unity-tanks-${view.split(" ")[0]}.png`) });
    await touch("touchEnd", []);
    await expect.poll(async () => { const input = await own(); return Math.hypot(input.x, input.y); }, { timeout: 5000 }).toBeLessThan(.1);
    // Drag in Unity's aim zone and release: the room registers the shot.
    await touch("touchStart", [[300, 700]]);
    for (const dy of [20, 40, 60]) await touch("touchMove", [[300, 700 - dy]]);
    await page.waitForTimeout(150);
    await touch("touchEnd", []);
    await expect.poll(async () => (await match()).game.tanks[session.ids[0]]?.lastShot ?? 0, { timeout: 5000 }).toBeGreaterThan(0);
    await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.locator(".unity-match")).not.toHaveClass(/is-shown/);
    expect(errors).toEqual([]);
  } finally { session.close(); }
});

// The ring games in Unity: stick and action button of Unity's HUD reach the room.
for (const [miniId, name, action] of [["sumo", "Sumo Smash", "Stoß"], ["bumpercars", "Bumper Mayhem", "Turbo"]] as const) test(`${name} mit Unity-Darstellung: Unity-HUD steuert den Raum`, async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Nur Smartphone");
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId });
  try {
    await expect(page.getByRole("group", { name: "Variante" }).getByRole("button", { name: /Unity/ })).toHaveAttribute("aria-pressed", "true");
    await unityLoaded(page);
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    await expect(page.locator(".match-world")).toHaveAttribute("data-ready", "true", { timeout: 150000 });
    await expect(page.locator(".match-game")).toHaveClass(/is-unity-hud/, { timeout: 30000 });
    // The software-rendered test browser may stall while Unity loads the scene; the app's socket then reconnects.
    await expect(page.locator(".party-connection")).toHaveCount(0, { timeout: 30000 });
    // Unity counts 3-2-1 itself (the app's countdown is hidden): wait for the room's start signal.
    await expect.poll(async () => (await session.state()).partyGame!.mini!.match!.time, { timeout: 15000 }).toBeGreaterThan(300);
    const fighter = async () => (await session.state()).partyGame!.mini!.match!.game as { fighters: Record<string, { actionAt: number }> };
    const own = async () => (await session.state()).partyGame!.mini!.match!.players.find(p => p.id === session.ids[0])!.input;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", points: [number, number][]) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id: id + 1 })) });
    await page.waitForTimeout(800);
    await touch("touchStart", [[80, 740]]);
    for (const dx of [15, 30, 45, 60]) await touch("touchMove", [[80 + dx, 740]]);
    await expect.poll(async () => { const input = await own(); return Math.hypot(input.x, input.y); }, { timeout: 5000 }).toBeGreaterThan(.7);
    await page.screenshot({ path: info.outputPath(`unity-${miniId}.png`) });
    await touch("touchEnd", []);
    // Action button bottom right (Unity HUD): the room starts the dash/turbo.
    // (The stick may have walked the fighter off the ring; the room then ignores the shove, so count the tap itself.)
    const taps = async () => (await session.state()).partyGame!.mini!.match!.players.find(p => p.id === session.ids[0])!.usedA;
    const before = await taps();
    await touch("touchStart", [[330, 780]]); await page.waitForTimeout(120); await touch("touchEnd", []);
    await expect.poll(taps, { timeout: 5000 }).toBeGreaterThan(before);
    void fighter;
    expect(errors).toEqual([]);
    expect(await page.locator(".unity-match").getAttribute("class")).toContain("is-shown");
    void action;
  } finally { session.close(); }
});

// Bomb Arena and Schneeballschlacht in Unity: Unity's buttons reach the room (bomb, throw/form).
for (const [miniId, name, key] of [["bombs", "Bomb Arena", "bombs"], ["snowball", "Schneeballschlacht", "players"]] as const) test(`${name} mit Unity-Darstellung: Unity-HUD steuert den Raum`, async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Nur Smartphone");
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId });
  try {
    await expect(page.getByRole("group", { name: "Variante" }).getByRole("button", { name: /Unity/ })).toHaveAttribute("aria-pressed", "true");
    await unityLoaded(page);
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    await expect(page.locator(".match-world")).toHaveAttribute("data-ready", "true", { timeout: 150000 });
    await expect(page.locator(".match-game")).toHaveClass(/is-unity-hud/, { timeout: 30000 });
    // The software-rendered test browser may stall while Unity loads the scene; the app's socket then reconnects.
    await expect(page.locator(".party-connection")).toHaveCount(0, { timeout: 30000 });
    // Unity counts 3-2-1 itself (the app's countdown is hidden): wait for the room's start signal.
    await expect.poll(async () => (await session.state()).partyGame!.mini!.match!.time, { timeout: 15000 }).toBeGreaterThan(300);
    const own = async () => (await session.state()).partyGame!.mini!.match!.players.find(p => p.id === session.ids[0])!;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", points: [number, number][]) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id: id + 1 })) });
    await page.waitForTimeout(800);
    await touch("touchStart", [[80, 740]]);
    for (const dy of [15, 30, 45, 60]) await touch("touchMove", [[80, 740 - dy]]);
    await expect.poll(async () => { const input = (await own()).input; return Math.hypot(input.x, input.y); }, { timeout: 5000 }).toBeGreaterThan(.7);
    await page.screenshot({ path: info.outputPath(`unity-${miniId}.png`) });
    await touch("touchEnd", []);
    // Main button bottom right: bomb or throw; the room counts the tap.
    const before = (await own()).usedA;
    await touch("touchStart", [[330, 780]]); await page.waitForTimeout(120); await touch("touchEnd", []);
    await expect.poll(async () => (await own()).usedA, { timeout: 5000 }).toBeGreaterThan(before);
    expect(errors).toEqual([]);
    void key;
  } finally { session.close(); }
});

// Floor is Lava in Unity (3rd person by default): stick, jump ("a") and the dive command reach the room.
test("Floor is Lava mit Unity-Darstellung: Springen und Hechten aus dem Unity-HUD", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Nur Smartphone");
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "lava" });
  try {
    await expect(page.getByRole("group", { name: "Variante" }).getByRole("button", { name: /Unity/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "Ansicht" }).getByRole("button", { name: /3rd Person/ })).toHaveAttribute("aria-pressed", "true");
    await unityLoaded(page);
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    await expect(page.locator(".match-world")).toHaveAttribute("data-ready", "true", { timeout: 150000 });
    await expect(page.locator(".match-game")).toHaveClass(/is-unity-hud/, { timeout: 30000 });
    // The software-rendered test browser may stall while Unity loads the scene; the app's socket then reconnects.
    await expect(page.locator(".party-connection")).toHaveCount(0, { timeout: 30000 });
    // Unity counts 3-2-1 itself (the app's countdown is hidden): wait for the room's start signal.
    await expect.poll(async () => (await session.state()).partyGame!.mini!.match!.time, { timeout: 15000 }).toBeGreaterThan(300);
    const own = async () => (await session.state()).partyGame!.mini!.match!.players.find(p => p.id === session.ids[0])!;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", points: [number, number][]) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id: id + 1 })) });
    // Unity shows its buttons only while the own runner is in play: not between rounds and not after a fall
    // (standing still, that takes about three seconds). The software-rendered test browser draws Unity at a few
    // frames per second, so a touch is repeated until the room has it; the room counts every tap Unity sends.
    const tapUntil = (point: [number, number], count: () => Promise<number>) => expect(async () => {
      const start = await count();
      await touch("touchStart", [point]); await page.waitForTimeout(80); await touch("touchEnd", []);
      await expect.poll(count, { timeout: 1500 }).toBeGreaterThan(start);
    }).toPass({ timeout: 30000 });
    await expect(async () => {
      await touch("touchStart", [[80, 740]]);
      for (const dy of [15, 30, 45, 60]) await touch("touchMove", [[80, 740 - dy]]);
      try { await expect.poll(async () => { const input = (await own()).input; return Math.hypot(input.x, input.y); }, { timeout: 1500 }).toBeGreaterThan(.5); }
      finally { await page.screenshot({ path: info.outputPath("unity-lava.png") }); await touch("touchEnd", []); }
    }).toPass({ timeout: 30000 });
    // Jump above, dive (a game command, sent with the stick of the same moment) bottom right.
    await tapUntil([330, 682], async () => (await own()).usedA);
    await tapUntil([330, 780], async () => (await own()).usedN);
    expect(errors).toEqual([]);
  } finally { session.close(); }
});

// Parcours run and final in Unity (3rd person): stick, jump, dive and "Ducken" held reach the room.
for (const [miniId, name] of [["tuerenlotto", "Türenlotto"], ["standhaft", "Standhaft"]] as const) test(`${name} mit Unity-Darstellung: Unity-HUD steuert den Lauf`, async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Nur Smartphone");
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId });
  let hopping: ReturnType<typeof setInterval> | undefined;
  try {
    await expect(page.getByRole("group", { name: "Variante" }).getByRole("button", { name: /Unity/ })).toHaveAttribute("aria-pressed", "true");
    await unityLoaded(page);
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
    await session.action({ type: "ready" }, session.ids[1]);
    await matchStarted(page);
    await expect(page.locator(".match-world")).toHaveAttribute("data-ready", "true", { timeout: 150000 });
    await expect(page.locator(".match-game")).toHaveClass(/is-unity-hud/, { timeout: 30000 });
    // The software-rendered test browser may stall while Unity loads the scene; the app's socket then reconnects.
    await expect(page.locator(".party-connection")).toHaveCount(0, { timeout: 30000 });
    // Unity counts 3-2-1 itself (the app's countdown is hidden): wait for the room's start signal.
    await expect.poll(async () => (await session.state()).partyGame!.mini!.match!.time, { timeout: 15000 }).toBeGreaterThan(300);
    // In the final the second player keeps jumping over the bar, so the final is not decided while this device acts.
    let seq = 0;
    hopping = miniId === "standhaft" ? setInterval(() => { seq++; void session.control(session.ids[1], { x: 0, y: 0, ax: 0, ay: 0, ha: false, hb: false, ca: seq, cb: 0, cn: 0, n: 0 }, seq).catch(() => undefined); }, 350) : undefined;
    const own = async () => (await session.state()).partyGame!.mini!.match!.players.find(p => p.id === session.ids[0])!;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", points: [number, number][]) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y], id) => ({ x, y, id: id + 1 })) });
    // Unity draws at a few frames per second in the test browser: a touch is repeated until the room has it.
    const tapUntil = (point: [number, number], count: () => Promise<number>) => expect(async () => {
      const start = await count();
      await touch("touchStart", [point]); await page.waitForTimeout(80); await touch("touchEnd", []);
      await expect.poll(count, { timeout: 1500 }).toBeGreaterThan(start);
    }).toPass({ timeout: 30000 });
    // Buttons: dive and jump above, "Festhalten" and "Ducken" below.
    await tapUntil([328, 692], async () => (await own()).usedA);
    // Stick up: along the course (−y in the room's field) in a run; in the final the camera starts behind the
    // racer facing the middle, so there only the length counts.
    await expect(async () => {
      await touch("touchStart", [[80, 740]]);
      for (const dy of [15, 30, 45, 60]) await touch("touchMove", [[80, 740 - dy]]);
      try {
        await expect.poll(async () => { const input = (await own()).input; return miniId === "standhaft" ? -Math.hypot(input.x, input.y) : input.y; }, { timeout: 1500 }).toBeLessThan(-.4);
      } finally { await page.screenshot({ path: info.outputPath(`unity-${miniId}.png`) }); await touch("touchEnd", []); }
    }).toPass({ timeout: 30000 });
    await tapUntil([230, 692], async () => (await own()).usedB);
    await expect(async () => {
      await touch("touchStart", [[328, 790]]);
      try { await expect.poll(async () => (await own()).input.hb, { timeout: 1500 }).toBe(true); }
      finally { await touch("touchEnd", []); }
    }).toPass({ timeout: 30000 });
    await expect.poll(async () => (await own()).input.hb, { timeout: 5000 }).toBe(false);
    expect(errors).toEqual([]);
  } finally { clearInterval(hopping); session.close(); }
});
