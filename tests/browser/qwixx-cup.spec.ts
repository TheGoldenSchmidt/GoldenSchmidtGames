import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { CUP_PREPARE_MS, CUP_READY_MS } from "../../src/lib/kribbelnCup";
import { DICE_CUP_ROLL_DURATION } from "../../src/components/DiceCupTable";

async function localQwixx(page: Page, reduced = false) {
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto("/"); await page.getByRole("button", { name: /Lokal spielen/ }).click();
  await page.getByRole("button", {name:/^Qwixx /}).click();
  for (let player = 1; player <= 2; player++) await page.getByRole("combobox", { name: `Figur von Spieler ${player}`, exact: true }).selectOption("alpha_rick_prime");
  await page.getByRole("button", { name: "Qwixx starten", exact: true }).click();
  if (!reduced) await page.getByRole("button", { name: "Intro überspringen" }).click();
  await expect(page.locator(".qwixx-cup-table")).toBeVisible();
}

async function material(page: Page) {
  const models = await page.locator(".qwixx-die").evaluateAll(dice => dice.map(die => ({
    id: die.getAttribute("data-die-id"), color: die.getAttribute("data-die-color"),
    faces: Array.from(die.querySelectorAll(".die-face")).map(face => ({ number: Number(face.className.match(/die-face--(\d)/)?.[1]), color: face.className.match(/kribbel-face-color--(\w+)/)?.[1] }))
  })));
  expect(models.map(die => die.color)).toEqual(["white", "white", "red", "yellow", "green", "blue"]);
  expect(new Set(models.map(die => die.id)).size).toBe(6);
  for (const die of models) {
    expect(die.faces.map(face => face.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(die.faces.every(face => face.color === die.color)).toBe(true);
  }
  await expect(page.locator("button.qwixx-die")).toHaveCount(6);
}

async function swipe(page: Page, touch: boolean, shake = false) {
  const cup = page.getByRole("button", { name: /Würfelbecher schütteln/ });
  await cup.scrollIntoViewIfNeeded();
  const box = (await cup.boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height / 2;
  const points = shake ? [[x - 24, y], [x + 24, y], [x - 24, y], [x, y]] : [[x, y + 20], [x, y + 45], [x, y + 65], [x, y + 85]];
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (const [px, py] of points) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: px, y: py }] }); await page.waitForTimeout(35); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await cdp.detach();
  } else {
    await page.mouse.move(x, y); await page.mouse.down();
    for (const [px, py] of points) { await page.mouse.move(px, py, { steps: 2 }); await page.waitForTimeout(35); }
    await page.mouse.up();
  }
}

async function sensor(page: Page, x = 0, beta = 0) {
  await page.evaluate(({ x, beta }) => window.dispatchEvent(new DeviceMotionEvent("devicemotion", {
    acceleration: { x, y: 0, z: 0 }, accelerationIncludingGravity: { x, y: 0, z: 9.81 }, rotationRate: { alpha: 0, beta, gamma: 0 }, interval: 16
  })), { x, beta });
}

test("Qwixx: sechs feste Würfel, farbiger Flug, Auswahl erst nach Landung und nächster Spieler", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await localQwixx(page); await material(page);
  await expect(page.locator(".qwixx-arena")).toBeVisible();
  await expect(page.locator(".qwixx-arena-world")).toHaveAttribute("data-active-player", "local-0");
  await expect(page.locator(".qwixx-die.is-in-cup")).toHaveCount(6);
  await page.evaluate(() => { (window as unknown as { qwixxModels: Element[] }).qwixxModels = Array.from(document.querySelectorAll(".qwixx-die .die-cube")); });
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 60_000));
  await page.getByRole("button", { name: "Würfeln", exact: true }).click(); await page.clock.runFor(CUP_PREPARE_MS);
  await expect(page.locator(".qwixx-die.is-rolling")).toHaveCount(6);
  await expect(page.locator(".qwixx-cell.is-selectable")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Weiße Aktion auslassen", exact: true })).toHaveCount(0);
  await expect(page.locator(".qwixx-white-sum strong")).toHaveText("…");
  await material(page);
  await page.clock.runFor(400);
  await page.evaluate(() => { for (const animation of document.getAnimations()) { const target = (animation.effect as KeyframeEffect | null)?.target; if (target instanceof Element && target.closest(".dice-cup-table")) { animation.pause(); animation.currentTime = 550; } } });
  await page.screenshot({ path: info.outputPath("qwixx-becher-flug.png"), fullPage: true });
  await page.clock.runFor(850);
  await expect(page.locator(".qwixx-die.is-rolling")).toHaveCount(0);
  await expect(page.locator(".qwixx-white-sum strong")).toHaveText("2");
  await page.getByRole("button", { name: "Weißer Würfel 1: 1, auswählen", exact: true }).click({ force: true });
  await expect(page.locator(".qwixx-die.is-chosen")).toHaveCount(2);
  await page.screenshot({ path: info.outputPath("qwixx-becher-gelandet.png"), fullPage: true });
  await expect(page.getByRole("button", { name: "Rot 2, auswählbar", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Rot 2, auswählbar", exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Weiße Aktion auslassen", exact: true }).click();
  await page.getByRole("button", { name: "Weißer Würfel 1: 1, auswählen", exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Gelber Würfel: 1, auswählen", exact: true }).click({ force: true });
  await expect(page.locator(".qwixx-die.is-chosen")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Gelb 2, auswählbar", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Gelb 2, auswählbar", exact: true }).click({ force: true });
  await expect(page.getByRole("button", { name: "Würfeln", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Würfeln", exact: true }).click();
  await page.clock.runFor(CUP_PREPARE_MS);
  await expect(page.locator(".qwixx-die.is-rolling")).toHaveCount(6);
  await page.clock.runFor(DICE_CUP_ROLL_DURATION);
  await expect(page.locator(".qwixx-die.is-rolling")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { qwixxModels: Element[] }).qwixxModels.every((model, index) => model === document.querySelectorAll(".qwixx-die .die-cube")[index]))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("Qwixx: Becher mit Touch oder Maus schütteln und auswerfen, kein Behalten", async ({ page }, info) => {
  await localQwixx(page, true);
  await swipe(page, info.project.name === "phone", true);
  await expect(page.locator(".qwixx-cup-table")).toHaveAttribute("data-cup-state", "ready");
  await expect(page.locator(".qwixx-white-sum strong")).toHaveText("–");
  await swipe(page, info.project.name === "phone");
  await expect(page.locator(".qwixx-white-sum strong")).toHaveText("2");
  await expect(page.locator(".qwixx-cell.is-selectable")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /Würfelbecher schütteln/ })).toBeDisabled();
  await expect(page.locator(".qwixx-die[aria-pressed]")).toHaveCount(2);
  await page.getByRole("button", { name: "Weißer Würfel 1: 1, auswählen", exact: true }).click({ force: true });
  await expect(page.locator(".qwixx-die.is-chosen")).toHaveCount(2);
  await material(page);
});

test("Qwixx: Handybewegung mit Freigabe und reduzierte Bewegung während des Flugs", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { qwixxPermissions: 0 });
    Object.defineProperty(DeviceMotionEvent, "requestPermission", { configurable: true, value: async () => { (window as unknown as { qwixxPermissions: number }).qwixxPermissions++; return "granted"; } });
  });
  await localQwixx(page); await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 60_000));
  expect(await page.evaluate(() => (window as unknown as { qwixxPermissions: number }).qwixxPermissions)).toBe(0);
  await page.getByRole("button", { name: "Handybewegung aktivieren", exact: true }).click();
  await sensor(page, 0, 200);
  await expect(page.locator(".qwixx-white-sum strong")).toHaveText("–");
  for (const x of [20, -20, 20]) { await sensor(page, x); await page.clock.runFor(140); }
  await expect(page.locator(".qwixx-cup-table")).toHaveAttribute("data-cup-state", "ready");
  await page.clock.runFor(350); await sensor(page, 0, 200); await page.clock.runFor(CUP_READY_MS);
  await expect(page.locator(".qwixx-die.is-rolling")).toHaveCount(6);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".qwixx-die.is-rolling")).toHaveCount(0);
  await expect(page.locator(".qwixx-white-sum strong")).toHaveText("2");
  for (const x of [20, -20, 20]) { await sensor(page, x); await page.clock.runFor(140); }
  await page.clock.runFor(350); await sensor(page, 0, 200);
  await expect(page.locator(".qwixx-cup-table")).not.toHaveAttribute("data-cup-state", "preparing");
  await expect(page.getByRole("button", { name: "Weiße Aktion auslassen", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { qwixxPermissions: number }).qwixxPermissions)).toBe(1);
});

test("Qwixx: bei verweigerter oder ausbleibender Handybewegung bleibt Würfeln verfügbar", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(DeviceMotionEvent, "requestPermission", { configurable: true, value: async () => "denied" }));
  await localQwixx(page, true);
  await page.getByRole("button", { name: "Handybewegung aktivieren", exact: true }).click();
  await expect(page.getByText(/Bewegungsfreigabe abgelehnt/)).toBeVisible();
  await page.evaluate(() => Object.defineProperty(DeviceMotionEvent, "requestPermission", { configurable: true, value: async () => "granted" }));
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 60_000));
  await page.getByRole("button", { name: "Handybewegung aktivieren", exact: true }).click(); await page.clock.runFor(3001);
  await expect(page.getByText(/Kein Bewegungssignal verfügbar/)).toBeVisible();
  await page.getByRole("button", { name: "Würfeln", exact: true }).click();
  await expect(page.locator(".qwixx-white-sum strong")).toHaveText("2");
  await expect(page.getByRole("button", { name: "Weiße Aktion auslassen", exact: true })).toBeVisible();
});

test("Qwixx: geschlossene Reihe entfernt ihren Würfel auch aus dem nächsten Becherwurf", async ({ page }, info) => {
  await localQwixx(page, true);
  for (let value = 1; value <= 6; value++) {
    await page.evaluate(value => { Math.random = () => (value - .5) / 6; }, value);
    await page.getByRole("button", { name: "Würfeln", exact: true }).click();
    for (let player = 0; player < 2; player++) await page.getByRole("button", { name: `Rot ${value * 2}, auswählbar`, exact: true }).click();
    await page.getByRole("button", { name: "Zweite Aktion auslassen", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Roter Würfel entfernt", exact: true })).toBeVisible();
  await expect(page.getByText("5 im Becher", { exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" }); await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 60_000));
  await page.getByRole("button", { name: "Würfeln", exact: true }).click(); await page.clock.runFor(CUP_PREPARE_MS);
  await expect(page.locator(".qwixx-die.is-rolling")).toHaveCount(5);
  await expect(page.locator('[data-die-id="red"]')).toHaveClass(/is-retired/);
  await page.clock.runFor(1250);
  await expect(page.locator('[data-die-id="red"] .die-scene')).toBeHidden();
  await page.screenshot({ path: info.outputPath("qwixx-roter-wuerfel-entfernt.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Qwixx online: beide sehen denselben Flug und nur die aktive Person würfelt", async ({ page, browser }) => {
  const context = await browser.newContext({ viewport: page.viewportSize()! }), peer = await context.newPage();
  try {
    await page.emulateMedia({ reducedMotion: "reduce" }); await peer.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(profile => localStorage.setItem("spielraum.profile.v1", JSON.stringify(profile)), { id: randomUUID(), username: "Anna" });
    await peer.addInitScript(profile => localStorage.setItem("spielraum.profile.v1", JSON.stringify(profile)), { id: randomUUID(), username: "Ben" });
    await page.goto("/"); await page.getByRole("button", { name: /Online spielen/ }).click();
    await page.getByRole("button", { name: /^Raum erstellen/ }).click();
    await page.getByLabel("Deine Spielfigur").selectOption({label: "Prime Rick"});
    await page.getByRole("button", { name: "Neuen Raum erstellen", exact: true }).click();
    const code = await page.locator(".room-code strong").innerText();
    await peer.goto(new URL("/", page.url()).href); await peer.getByRole("button", { name: /Online spielen/ }).click();
    await peer.getByRole("button", { name: /^Raum beitreten/ }).click();
    await peer.getByLabel("Deine Spielfigur").selectOption({label: "Morty Smith"}); await peer.getByRole("textbox", { name: "Raumcode" }).fill(code);
    await peer.getByRole("button", { name: "Raum beitreten", exact: true }).click();
    await peer.getByRole("button", { name: "Ich bin bereit", exact: true }).click(); await page.getByRole("button", { name: "Ich bin bereit", exact: true }).click();
    await expect(page.locator(".qwixx-cup-table")).toBeVisible(); await expect(peer.locator(".qwixx-cup-table")).toBeVisible();
    await expect(peer.getByRole("button", { name: /Würfelbecher schütteln/ })).toBeDisabled();
    await page.emulateMedia({ reducedMotion: "no-preference" }); await peer.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByRole("button", { name: "Würfeln", exact: true }).click();
    await expect(page.locator(".qwixx-die.is-rolling")).toHaveCount(6); await expect(peer.locator(".qwixx-die.is-rolling")).toHaveCount(6);
    await expect(page.getByRole("button", { name: "Weiße Aktion auslassen", exact: true })).toBeVisible();
    await expect(peer.getByRole("button", { name: "Weiße Aktion auslassen", exact: true })).toBeVisible();
    expect(await peer.locator(".qwixx-white-sum strong").innerText()).toBe(await page.locator(".qwixx-white-sum strong").innerText());
    expect(await peer.locator(".qwixx-die").evaluateAll(dice => dice.map(die => die.getAttribute("aria-label")))).toEqual(await page.locator(".qwixx-die").evaluateAll(dice => dice.map(die => die.getAttribute("aria-label"))));
    await page.getByRole("button", { name: "Weiße Aktion auslassen", exact: true }).click(); await peer.getByRole("button", { name: "Weiße Aktion auslassen", exact: true }).click();
    await page.getByRole("button", { name: "Auslassen und Fehlwurf nehmen", exact: true }).click();
    await expect(peer.getByRole("button", { name: "Würfeln", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Würfelbecher schütteln/ })).toBeDisabled();
    await peer.getByRole("button", { name: "Würfeln", exact: true }).click();
    await expect(page.locator(".qwixx-die.is-rolling")).toHaveCount(6); await expect(peer.locator(".qwixx-die.is-rolling")).toHaveCount(6);
    await expect(page.getByRole("button", { name: "Weiße Aktion auslassen", exact: true })).toBeVisible();
    await material(peer);
  } finally { await context.close(); }
});
