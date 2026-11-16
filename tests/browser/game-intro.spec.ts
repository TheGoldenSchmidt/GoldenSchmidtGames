import { selectEntryCharacter } from "./select-entry-character";
import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { io } from "socket.io-client";
import { request } from "./party-session";
import type { RoomState } from "../../shared/types";

async function localSetup(page: Page, game: string, count = 2) {
  await page.goto("/");
  await page.getByRole("button", { name: /Lokal spielen/ }).click();
  await page.getByRole("button", { name: new RegExp(`^${game} `) }).first().click();
  for (let n = 2; n < count; n++) await page.getByRole("button", { name: "+", exact: true }).click();
  for (let n = 1; n <= count; n++) await page.getByRole("textbox", { name: `Name von Spieler ${n}`, exact: true }).fill(["Anna", "Ben", "Clara", "David", "Emma", "Finn"][n - 1]);
  for(let n=1;n<=count;n++)await page.getByRole("combobox",{name:`Figur von Spieler ${n}`,exact:true}).selectOption("alpha_rick_prime");
  await page.getByRole("button", { name: `${game} starten`, exact: true }).click();
}

test("Durak: sechs sitzende Spieler, echte Kamerafahrt und geschützter Spielbeginn", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const clockTime=new Date("2026-01-01T00:00:00Z");
  await page.clock.install({time:clockTime});await page.clock.pauseAt(new Date(clockTime.getTime()+1000));
  await localSetup(page, "Durak", 6);
  const intro = page.getByRole("dialog", { name: "Durak", exact: true });
  const world = intro.locator(".game-intro__world");
  await expect(world).toHaveAttribute("data-webgl", "ready");
  await expect(page.locator(".game-entrance")).toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "Karten anzeigen", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Intro überspringen" })).toBeFocused();
  const start = JSON.parse(await world.getAttribute("data-camera") ?? "{}");
  expect(start.polar).toBeGreaterThan(.8);
  await page.screenshot({ path: info.outputPath("durak-runde.png") });
  await page.clock.fastForward(2000);
  const middle=JSON.parse(await world.getAttribute("data-camera")??"{}");
  expect(middle.polar).toBeGreaterThan(0);expect(middle.polar).toBeLessThan(start.polar);
  await page.clock.fastForward(1100);
  await expect(intro).toHaveAttribute("data-stage", "overhead", { timeout: 10000 });
  const end = JSON.parse(await world.getAttribute("data-camera") ?? "{}");
  expect(end.polar).toBe(0); expect(end.distance).toBeLessThan(start.distance);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("durak-von-oben.png") });
  await page.clock.fastForward(1000);await page.clock.resume();
  await expect(intro).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Gerät weitergeben" })).toBeVisible();
  await expect(page.locator(".game-entrance")).not.toHaveAttribute("inert");
  await page.getByRole("button", { name: "Karten anzeigen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Angreifen", exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

for (const game of ["Qwixx", "Kribbeln"]) test(`${game}: eigene 3D-Szene und Überspringen ins bedienbare Spiel`, async ({ page }, info) => {
  await localSetup(page, game, game === "Qwixx" ? 5 : 2);
  const intro = page.getByRole("dialog", { name: game, exact: true });
  await expect(intro.locator(".game-intro__world")).toHaveAttribute("data-webgl", "ready");
  // Sofort überspringen: Eine WebGL-Aufnahme kann auf CI länger als das
  // viersekündige Intro dauern und würde den Klick gegen dessen Ende testen.
  await page.getByRole("button", { name: "Intro überspringen" }).click();
  await expect(intro).toHaveCount(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.getByRole("button", { name: "Würfeln", exact: true }).click();
  await expect(page.locator(".game-entrance")).not.toHaveAttribute("inert");
  if (game === "Kribbeln") await expect(page.getByRole("button", { name: /Würfel neu werfen/ })).toBeEnabled();
  else await expect(page.locator(".dice-tray")).toBeVisible();
  await page.screenshot({ path: info.outputPath(`${game.toLowerCase()}-spielstart.png`) });
});

test("Escape beendet das Intro, und eine neue Partie erhält wieder ein Intro", async ({ page }) => {
  await localSetup(page, "Durak");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Intro überspringen" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".game-intro")).toHaveCount(0);
  await page.getByRole("button", { name: "Karten anzeigen", exact: true }).click();
  await page.getByRole("button", { name: "Beenden", exact: true }).click();
  await page.getByRole("button", { name: /Lokal spielen/ }).click();
  await page.getByRole("button", {name:/^Qwixx /}).click();
  for(let n=1;n<=2;n++)await page.getByRole("combobox",{name:`Figur von Spieler ${n}`,exact:true}).selectOption("alpha_morty_smith");
  await page.getByRole("button", { name: "Qwixx starten", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Qwixx", exact: true })).toBeVisible();
});

test("Reduzierte Bewegung überspringt Intros und beendet eine laufende Kamerafahrt", async ({ page }) => {
  // Only the preference change may dismiss the second intro, not its four-second timer.
  const start = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await localSetup(page, "Qwixx");
  await expect(page.locator(".game-intro")).toHaveCount(0);
  await page.getByRole("button", { name: "Würfeln", exact: true }).click();
  await page.getByRole("button", { name: "Beenden", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: /Lokal spielen/ }).click();
  await page.getByRole("button", {name:/^Qwixx /}).click();
  for(let n=1;n<=2;n++)await page.getByRole("combobox",{name:`Figur von Spieler ${n}`,exact:true}).selectOption("alpha_morty_smith");
  await page.getByRole("button", { name: "Qwixx starten", exact: true }).click();
  await expect(page.locator(".game-intro")).toBeVisible();
  await expect(page.locator(".qwixx-arena-world")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.runFor(16);
  await expect(page.locator(".game-intro")).toHaveCount(0);
  await expect(page.locator(".qwixx-arena-world")).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await page.getByRole("button", { name: "Würfeln", exact: true }).click();
});

test("Ohne WebGL führt die Ersatzszene automatisch ins Spiel", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      return kind.startsWith("webgl") ? null : Reflect.apply(original, this, [kind, ...args]);
    } });
  });
  await localSetup(page, "Durak");
  await expect(page.locator(".game-intro")).toHaveClass(/is-fallback/);
  await expect(page.locator(".game-intro")).toHaveCount(0, { timeout: 8000 });
  await expect(page.getByRole("button", { name: "Karten anzeigen", exact: true })).toBeVisible();
});

for (const gameId of ["durak", "qwixx", "kribbeln", "party"] as const) test(`Online ${gameId}: Intro bei neuem Start, laufender Zustand bleibt verbunden`, async ({ page }, info) => {
  test.skip(gameId === "party" && info.project.name === "desktop", "Inselparty ist nur für Smartphones vorgesehen.");
  const socket = io("http://127.0.0.1:4177", { transports: ["websocket"], forceNew: true, reconnection: false });
  await new Promise<void>((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); });
  try {
    const room = await request<RoomState>(socket, "room:create", {characterId:"alpha_rick_prime", playerId: randomUUID(), name: "Anna" });
    await request(socket, "room:configure", { gameId, playerCount: 2, party: { rounds: 5, tempo: "slow" } });
    await page.goto("/"); await page.getByRole("button", { name: /Online spielen/ }).click();
    await page.getByRole("button", { name: /^Raum beitreten/ }).click();
    await selectEntryCharacter(page, "Morty Smith");
    await page.getByRole("textbox", { name: "Raumcode" }).fill(room.code);
    await page.getByRole("button", { name: "Raum beitreten", exact: true }).click();
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).click();
    await request(socket, "room:ready");
    const intro = page.getByRole("dialog");
    await expect(intro).toBeVisible();
    await expect(intro.locator(".game-intro__world")).toHaveAttribute("data-webgl", "ready");
    await page.getByRole("button", { name: "Intro überspringen" }).click();
    await expect(intro).toHaveCount(0);
    await expect(page.locator(".game-entrance")).not.toHaveAttribute("inert");
    if (gameId === "party") {
      await expect(page.locator(".party-mini-intro")).toBeVisible();
      await page.screenshot({ path: info.outputPath("insel-spielstart.png") });
      await page.getByRole("button", { name: "Verlassen", exact: true }).click();
      await page.getByRole("button", { name: "Online-Inselparty wieder beitreten", exact: true }).click();
      await expect(page.locator(".party-mini-intro")).toBeVisible();
      await expect(page.locator(".game-intro")).toHaveCount(0);
    } else {
      await expect(page.getByRole("button", { name: "Beenden", exact: true })).toBeVisible();
      // A server update during the game must not replay the introduction.
      const current = await request<RoomState>(socket, "qwixx:state");
      expect(current.phase).toBe("playing");
      await expect(page.locator(".game-intro")).toHaveCount(0);
    }
  } finally { socket.disconnect(); }
});

test("Bereits geänderte Bewegungspräferenz wird bei Listener-Registrierung berücksichtigt",async({page})=>{
  await page.clock.install({time:new Date("2026-01-01T00:00:00Z")});await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.addInitScript(()=>{
    const original=window.matchMedia.bind(window);let changed=false;
    window.matchMedia=(query:string)=>{const media=original(query);if(query!=="(prefers-reduced-motion: reduce)")return media;const initial=media.matches,add=media.addEventListener;
      Object.defineProperty(media,"matches",{configurable:true,get:()=>changed||initial});
      Object.defineProperty(media,"addEventListener",{configurable:true,value:(type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{if(type==="change")changed=true;Reflect.apply(add,media,[type,listener,options]);}});
      return media;
    };
  });
  await localSetup(page,"Qwixx");await expect(page.locator(".game-intro")).toHaveCount(0);
  await expect(page.locator(".game-entrance")).not.toHaveAttribute("inert");await expect(page.getByRole("button",{name:"Würfeln",exact:true})).toBeEnabled();
});
