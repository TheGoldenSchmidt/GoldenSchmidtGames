import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { KRIBBEL_COLORS, KRIBBEL_ROWS } from "../../shared/kribbeln";
import { CUP_PREPARE_MS, CUP_READY_MS } from "../../src/lib/kribbelnCup";

async function localGame(page: Page, reduced = false) {
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto("/");
  await page.getByRole("button", { name: /Lokal spielen/ }).click();
  await page.getByRole("button", { name: /^Kribbeln / }).first().click();
  for(let n=1;n<=2;n++)await page.getByRole("combobox",{name:`Figur von Spieler ${n}`,exact:true}).selectOption("alpha_rick_prime");
  await page.getByRole("button", { name: "Kribbeln starten", exact: true }).click();
  if (!reduced) await page.getByRole("button", { name: "Intro überspringen" }).click();
  await expect(page.getByRole("heading", { name: KRIBBEL_ROWS[0].label, exact: true })).toBeVisible();
}

async function checkVisibleMaterial(page: Page) {
  const faces = await page.locator(".kribbel-cube-scene .die-face").evaluateAll(elements => elements.map(element => ({
    value: Number(element.className.match(/die-face--(\d)/)?.[1]),
    color: element.className.match(/kribbel-face-color--(\w+)/)?.[1]
  })));
  expect(faces).toHaveLength(36);
  for (const color of KRIBBEL_COLORS) for (let value = 1; value <= 6; value++) {
    expect(faces.filter(face => face.color === color && face.value === value)).toHaveLength(1);
  }
}

async function swipeCup(page: Page, touch: boolean, shakeOnly = false) {
  const cup = page.getByRole("button", { name: "Würfelbecher schütteln oder nach unten wischen", exact: true });
  await cup.scrollIntoViewIfNeeded();
  const box = (await cup.boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height / 2;
  const points = shakeOnly ? [[x - 24, y], [x + 24, y], [x - 24, y], [x, y]] : [[x, y + 20], [x, y + 40], [x, y + 65], [x, y + 85]];
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

async function motionSample(page: Page, x = 0, beta = 0) {
  await page.evaluate(({ x, beta }) => window.dispatchEvent(new DeviceMotionEvent("devicemotion", {
    acceleration: { x, y: 0, z: 0 }, accelerationIncludingGravity: { x, y: 0, z: 9.81 }, rotationRate: { alpha: 0, beta, gamma: 0 }, interval: 16
  })), { x, beta });
}

test("Sechs feste Farbwürfel fliegen aus dem Becher und behalten ihre Identität", async ({ page }, info) => {
  await localGame(page);
  await checkVisibleMaterial(page);
  await expect(page.locator(".kribbel-die-slot.is-in-cup")).toHaveCount(6);
  await page.evaluate(() => { (window as unknown as { cupDice: Element[] }).cupDice = Array.from(document.querySelectorAll(".kribbel-cube-scene .die-cube")); });
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.getByRole("button", { name: "Würfeln", exact: true }).click();
  await expect(page.locator(".kribbel-cup-table")).toHaveAttribute("data-cup-state", "preparing");
  await page.clock.runFor(CUP_PREPARE_MS);
  await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(6);
  await checkVisibleMaterial(page);
  await expect(page.getByRole("button", { name: /^Würfel \d fliegt$/ })).toHaveCount(6);
  await expect(page.locator(".kribbel-task")).toHaveAttribute("data-state", "waiting");
  await expect(page.locator(".kribbel-feedback > strong")).toHaveText("…");
  await page.clock.runFor(400);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (target instanceof Element && target.closest(".kribbel-cup-table")) { animation.pause(); animation.currentTime = 550; }
    }
  });
  await page.screenshot({ path: info.outputPath("kribbeln-wuerfel-fallen.png"), fullPage: true });
  await page.clock.runFor(850);
  await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(0);
  await checkVisibleMaterial(page);
  await expect(page.locator(".kribbel-task")).toHaveAttribute("data-state", "met");
  await expect(page.locator(".kribbel-feedback > strong")).toHaveText("6");
  await expect(page.getByRole("button", { name: "Ergebnis eintragen", exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath("kribbeln-gelandet.png"), fullPage: true });

  const first = page.locator(".kribbel-die-slot").nth(0);
  const second = page.locator(".kribbel-die-slot").nth(1);
  await first.click(); await second.click();
  const heldLabels = await page.locator(".kribbel-die-slot.is-kept").evaluateAll(elements => elements.map(element => element.getAttribute("aria-label")));
  await page.getByRole("button", { name: "4 Würfel neu werfen", exact: true }).click();
  await page.clock.runFor(CUP_PREPARE_MS);
  await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(4);
  await checkVisibleMaterial(page);
  expect(await page.locator(".kribbel-die-slot.is-kept").evaluateAll(elements => elements.map(element => element.getAttribute("aria-label")))).toEqual(heldLabels);
  await page.clock.runFor(1250);
  await checkVisibleMaterial(page);
  expect(await page.evaluate(() => (window as unknown as { cupDice: Element[] }).cupDice.every((die, index) => die === document.querySelectorAll(".kribbel-cube-scene .die-cube")[index]))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Alle Aufgaben haben verständliche Zielbilder und Kribbelfelder zeigen die nächste Summe", async ({ page }, info) => {
  await localGame(page, true);
  for (let row = 0; row < KRIBBEL_ROWS.length; row++) {
    await expect(page.getByRole("heading", { name: KRIBBEL_ROWS[row].label, exact: true })).toBeVisible();
    await expect(page.locator(".kribbel-task__picture")).toHaveAttribute("aria-label", new RegExp(KRIBBEL_ROWS[row].label));
    await expect(page.locator(".kribbel-task")).toHaveAttribute("data-state", "waiting");
    if ([5, 8, 9].includes(row)) await expect(page.locator(".kribbel-task__hint")).toHaveText("Du brauchst mindestens 7 Augen.");
    if ([0, 3, 6, 7, 9].includes(row)) await page.screenshot({ path: info.outputPath(`kribbeln-aufgabe-${row + 1}.png`), fullPage: true });
    for (let player = 0; player < 2; player++) {
      await page.getByRole("button", { name: "Würfeln", exact: true }).click();
      await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(0);
      await expect(page.locator(".kribbel-task")).not.toHaveAttribute("data-state", "waiting");
      await page.getByRole("button", { name: row === 2 ? "Ergebnis eintragen" : "Aufgabe streichen", exact: true }).click();
    }
  }
  await expect(page.getByRole("heading", { name: "Partie beendet", exact: true })).toBeVisible();
});

test("Reduzierte Bewegung beendet einen laufenden Wurf ohne weitere Wartezeit", async ({ page }) => {
  await localGame(page);
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.getByRole("button", { name: "Würfeln", exact: true }).click();
  await page.clock.runFor(CUP_PREPARE_MS);
  await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(6);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(0);
  await expect(page.locator(".kribbel-feedback > strong")).toHaveText("6");
  await expect(page.getByRole("button", { name: "Ergebnis eintragen", exact: true })).toBeEnabled();
});

test("Becher schütteln und per Touch oder Maus auswerfen verbraucht genau einen Wurf", async ({ page }, info) => {
  await localGame(page, true);
  await swipeCup(page, info.project.name === "phone", true);
  await expect(page.locator(".kribbel-cup-table")).toHaveAttribute("data-cup-state", "ready");
  await expect(page.getByLabel("Wurf 0 von 3", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("kribbeln-becher-bereit.png"), fullPage: true });
  await swipeCup(page, info.project.name === "phone");
  await expect(page.getByLabel("Wurf 1 von 3", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "6 Würfel neu werfen", exact: true })).toBeEnabled();
  await checkVisibleMaterial(page);
  for (let index = 0; index < 6; index++) await page.locator(".kribbel-die-slot").nth(index).click();
  await expect(page.getByRole("button", { name: "0 Würfel neu werfen", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Würfelbecher schütteln/ })).toBeDisabled();
  for (let index = 0; index < 6; index++) await page.locator(".kribbel-die-slot").nth(index).click();
  await page.getByRole("button", { name: "6 Würfel neu werfen", exact: true }).click();
  await expect(page.getByLabel("Wurf 2 von 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "6 Würfel neu werfen", exact: true }).click();
  await expect(page.getByLabel("Wurf 3 von 3", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Würfelbecher schütteln/ })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Handybewegung braucht Freigabe, schüttelt vor dem Kippen und wirft nicht automatisch weiter", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { requests: 0, listeners: new Set<EventListenerOrEventListenerObject>() };
    Object.assign(window, { cupMotionState: state });
    Object.defineProperty(DeviceMotionEvent, "requestPermission", { configurable: true, value: async () => { state.requests++; return "granted"; } });
    const add = window.addEventListener, remove = window.removeEventListener;
    Object.defineProperty(window, "addEventListener", { value: (...args: unknown[]) => { if (args[0] === "devicemotion") state.listeners.add(args[1] as EventListener); return Reflect.apply(add, window, args); } });
    Object.defineProperty(window, "removeEventListener", { value: (...args: unknown[]) => { if (args[0] === "devicemotion") state.listeners.delete(args[1] as EventListener); return Reflect.apply(remove, window, args); } });
  });
  await localGame(page);
  await page.clock.install(); await page.clock.pauseAt(new Date());
  const read = () => page.evaluate(() => { const state = (window as unknown as { cupMotionState: { requests: number; listeners: Set<unknown> } }).cupMotionState; return { requests: state.requests, listeners: state.listeners.size }; });
  expect(await read()).toEqual({ requests: 0, listeners: 0 });
  await page.getByRole("button", { name: "Handybewegung aktivieren", exact: true }).click();
  await motionSample(page, 0, 200);
  expect(await read()).toEqual({ requests: 1, listeners: 1 });
  await expect(page.getByLabel("Wurf 0 von 3", { exact: true })).toBeVisible();
  for (const x of [20, -20, 20]) { await motionSample(page, x); await page.clock.runFor(140); }
  await expect(page.locator(".kribbel-cup-table")).toHaveAttribute("data-cup-state", "ready");
  await expect(page.getByLabel("Wurf 0 von 3", { exact: true })).toBeVisible();
  await page.clock.runFor(350); await motionSample(page, 0, 200); await page.clock.runFor(CUP_READY_MS);
  await expect(page.getByLabel("Wurf 1 von 3", { exact: true })).toBeVisible();
  await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(6);
  await motionSample(page, 0, 200); await page.clock.runFor(1250); await motionSample(page, 0, 200);
  await expect(page.getByLabel("Wurf 1 von 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Handybewegung ausschalten", exact: true }).click();
  expect((await read()).listeners).toBe(0);
  await page.getByRole("button", { name: "Handybewegung aktivieren", exact: true }).click();
  await motionSample(page);
  await page.getByRole("button", { name: "Beenden", exact: true }).click();
  expect((await read()).listeners).toBe(0);
  await motionSample(page, 0, 200);
  await expect(page.getByRole("button", { name: /Lokal spielen/ })).toBeVisible();
});

test("Verweigerte oder ausbleibende Handybewegung erhält den Würfeln-Knopf", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(DeviceMotionEvent, "requestPermission", { configurable: true, value: async () => "denied" }));
  await localGame(page, true);
  await page.getByRole("button", { name: "Handybewegung aktivieren", exact: true }).click();
  await expect(page.getByText(/Bewegungsfreigabe abgelehnt/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Würfeln", exact: true })).toBeEnabled();
  await page.evaluate(() => Object.defineProperty(DeviceMotionEvent, "requestPermission", { configurable: true, value: async () => "granted" }));
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.getByRole("button", { name: "Handybewegung aktivieren", exact: true }).click();
  await page.clock.runFor(3001);
  await expect(page.getByText(/Kein Bewegungssignal verfügbar/)).toBeVisible();
  await page.getByRole("button", { name: "Würfeln", exact: true }).click();
  await expect(page.getByLabel("Wurf 1 von 3", { exact: true })).toBeVisible();
});

test("Online sehen beide Geräte behaltene Würfel und dieselben gelandeten Farben", async ({ page, browser }) => {
  const secondContext = await browser.newContext({ viewport: page.viewportSize()! });
  const observer = await secondContext.newPage();
  try {
    // Die Einführungen werden separat geprüft. Beide Geräte treten hier
    // ohne Intro bei, damit der zweite Klick dessen automatisches Ende nicht überholt.
    await page.emulateMedia({reducedMotion:"reduce"});
    await observer.emulateMedia({reducedMotion:"reduce"});
    await page.addInitScript(profile => localStorage.setItem("spielraum.profile.v1", JSON.stringify(profile)), { id: randomUUID(), username: "Anna" });
    await observer.addInitScript(profile => localStorage.setItem("spielraum.profile.v1", JSON.stringify(profile)), { id: randomUUID(), username: "Ben" });
    await page.goto("/"); await page.getByRole("button", { name: /Online spielen/ }).click();
    await page.getByRole("button",{name:"Prime Rick",exact:true}).click();
    await page.getByRole("button", { name: "Neuen Raum erstellen", exact: true }).click();
    await page.getByRole("combobox", { name: "Ausgewähltes Spiel", exact: true }).selectOption("kribbeln");
    const code = await page.locator(".room-code strong").innerText();
    await observer.goto(new URL("/", page.url()).href); await observer.getByRole("button", { name: /Online spielen/ }).click();
    await observer.getByRole("textbox", { name: "Raumcode" }).fill(code);
    await observer.getByRole("button",{name:"Morty Smith",exact:true}).click();
    await observer.getByRole("button", { name: "Raum beitreten", exact: true }).click();
    await observer.getByRole("button", { name: "Ich bin bereit", exact: true }).click();
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).click();
    await expect(page.getByRole("heading",{name:KRIBBEL_ROWS[0].label,exact:true})).toBeVisible();
    await expect(observer.getByRole("heading",{name:KRIBBEL_ROWS[0].label,exact:true})).toBeVisible();
    await page.emulateMedia({reducedMotion:"no-preference"});
    await observer.emulateMedia({reducedMotion:"no-preference"});
    await page.getByRole("button", { name: "Würfeln", exact: true }).click();
    await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(6);
    await expect(observer.locator(".kribbel-die-slot.is-rolling")).toHaveCount(6);
    await expect(page.getByRole("button", { name: "6 Würfel neu werfen", exact: true })).toBeEnabled();
    await expect(observer.locator(".kribbel-die-slot.is-rolling")).toHaveCount(0);
    await page.locator(".kribbel-die-slot").nth(0).click();
    await page.locator(".kribbel-die-slot").nth(1).click();
    await page.getByRole("button", { name: "4 Würfel neu werfen", exact: true }).click();
    await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(4);
    await expect(observer.locator(".kribbel-die-slot.is-rolling")).toHaveCount(4);
    await expect(observer.locator(".kribbel-die-slot.is-kept")).toHaveCount(2);
    await checkVisibleMaterial(observer);
    await expect(page.getByRole("button", { name: "4 Würfel neu werfen", exact: true })).toBeEnabled();
    await expect(observer.locator(".kribbel-die-slot.is-rolling")).toHaveCount(0);
    const labels = (target: Page) => target.locator(".kribbel-die-caption").allTextContents();
    expect(await labels(observer)).toEqual(await labels(page));
    await checkVisibleMaterial(observer);
  } finally { await secondContext.close(); }
});
