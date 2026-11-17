import { expect, test, type Page } from "@playwright/test";
import { activePartyPlayer, type PartyGame } from "../../shared/party";
import { partyPaths } from "../../shared/partyBoard";
import { onlineSession } from "./party-session";

type Session = Awaited<ReturnType<typeof onlineSession>>;
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Plays legal moves for both devices until the condition holds; minigames end through "Aufgeben"/"Versuch beenden". */
async function playUntil(session: Session, done: (game: PartyGame) => boolean) {
  for (let step = 0; step < 600; step++) {
    const game = (await session.state()).partyGame!;
    if (done(game)) return game;
    const active = activePartyPlayer(game);
    if (game.phase === "moving") { await pause(Math.max(50, game.movement!.arriveAt - game.serverTime! + 30)); continue; }
    if (game.phase === "turn") await session.action({ type: "roll" });
    else if (game.phase === "path") await session.action({ type: "path", destination: partyPaths(game, active)[0] });
    else if (game.phase === "trophy") await session.action({ type: "trophy", buy: true });
    else if (game.phase === "shop") await session.action({ type: "shop" });
    else if (game.phase === "gift") await session.action({ type: "gift", accept: false });
    else if (game.phase === "summary" || game.phase === "mini-result") await session.action({ type: "next" });
    else if (game.phase === "mini-intro") { for (const id of session.ids) if (!game.mini!.runs[id].ready) await session.action({ type: "ready" }, id); }
    else if (game.phase === "mini-play") {
      await pause(Math.max(0, game.mini!.startAt - game.serverTime!) + 100);
      for (const id of session.ids) {
        const current = (await session.state()).partyGame!;
        if (current.phase === "mini-play" && !current.mini!.runs[id].done) await session.action({ type: "finish" }, id);
      }
    } else throw new Error(`Unerwartete Phase ${game.phase}`);
  }
  throw new Error("Die Partie kam nicht ans Ziel.");
}

async function watchAs(page: Page, session: Session, id: string, name: string, code: string) {
  await page.addInitScript(({ profile, save }) => {
    localStorage.setItem("spielraum.profile.v1", JSON.stringify(profile));
    localStorage.setItem("spielraum.party.online.v1", JSON.stringify(save));
  }, { profile: { id, username: name }, save: { gameId: "party", code, partyToken: session.tokens[id] } });
  await page.goto("/");
  await page.getByRole("button", { name: "Online-Inselparty wieder beitreten", exact: true }).click();
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`Letzte Runden und Bonus-Trophäen bis zur Siegerehrung (${reducedMotion})`, async ({ page, browser }, testInfo) => {
    test.setTimeout(240000);
    await page.emulateMedia({ reducedMotion });
    const session = await onlineSession(page, true);
    const viewer = (await session.state()).partyGame!.order[0], other = session.ids.find(id => id !== viewer)!;
    const room = await session.state();
    const guestContext = await browser.newContext({ viewport: page.viewportSize()!, isMobile: true, hasTouch: true, reducedMotion });
    const guest = await guestContext.newPage();
    try {
      await watchAs(guest, session, other, room.players.find(p => p.id === other)!.name, room.code);
      // Rounds 1 and 2 are normal; the announcement belongs to the first turn of round 3 of 5.
      await expect(page.locator(".party-round-final")).toHaveCount(0);
      let game = await playUntil(session, g => g.round === 3 && g.phase === "turn");
      expect(game.finalStretch?.round).toBe(3);
      for (const device of [page, guest]) {
        await expect(device.locator(".party-round-final")).toHaveText("Schlussrunde");
        await expect(device.getByRole("status").filter({ hasText: "Die letzten 3 Runden!" })).toContainText("+6 und −6 Münzen");
        await expect(device.locator(".party-final-call")).toContainText(/Rückenwind für (dich|\S+): /);
        expect(await device.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
      await page.waitForTimeout(700);
      await page.screenshot({ path: testInfo.outputPath("final-call-active.png") });
      await guest.screenshot({ path: testInfo.outputPath("final-call-waiting.png") });
      // The roll button stays reachable next to the announcement.
      await expect(page.getByRole("button", { name: /Würfeln & losziehen/ })).toBeInViewport();
      await session.action({ type: "roll" });
      await expect(page.locator(".party-final-call")).toHaveCount(0);

      game = await playUntil(session, g => g.phase === "finished");
      expect(game.bonus).toHaveLength(3);
      for (const device of [page, guest]) await expect(device.getByRole("heading", { name: "Bonus-Trophäen" })).toBeVisible();
      if (reducedMotion === "no-preference") {
        await page.waitForTimeout(1300);
        await page.screenshot({ path: testInfo.outputPath("finale-reveal.png") });
      }
      // Both motion settings end with the same visible result.
      for (const device of [page, guest]) {
        await expect(device.getByRole("heading", { name: "Die Insel feiert euch!" })).toBeVisible();
        await expect.poll(() => device.locator(".party-finale-winner").evaluate(element => getComputedStyle(element).opacity), { timeout: reducedMotion === "reduce" ? 500 : 6000 }).toBe("1");
      }
      const verdict = (id: string) => game.winners.includes(id) ? (game.winners.length > 1 ? "Ihr teilt euch den Sieg!" : "Du gewinnst die Inselparty!") : (game.winners.length > 1 ? "teilen sich den Sieg!" : "gewinnt die Inselparty!");
      await expect(page.locator(".party-finale-winner p")).toHaveText(verdict(viewer));
      await expect(guest.locator(".party-finale-winner p")).toHaveText(verdict(other));
      await expect(page.locator(".party-bonus li")).toHaveCount(3);
      await expect(page.locator(".party-round-final")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`finale-${reducedMotion}.png`), fullPage: true });
    } finally {
      session.close();
      await guestContext.close();
    }
  });
}
