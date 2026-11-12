import { test, expect, type Locator } from "@playwright/test";
import { onlineSession } from "./party-session";

const characters = ["alpha_rick_prime", "alpha_summer_smith", "alpha_scary_terry", "alpha_mr_nimbus", "alpha_doctor_timothy", "alpha_pupa"] as const;
const camera = (world: Locator) => world.getAttribute("data-camera").then(value => JSON.parse(value ?? "[]") as number[]);
const distance = (a: number[], b: number[]) => Math.hypot(...a.map((value, i) => value - b[i]));

for (const mode of ["party", "roll-it-up"] as const) {
  for (const motion of ["no-preference", "reduce"] as const) {
    test(`${mode}: Figurenfokus, Kameratasten und Feldsuche (${motion})`, async ({ page }, info) => {
      await page.emulateMedia({ reducedMotion: motion });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const names = ["Anna mit einem sehr langen Spielernamen", "Ben", "Clara", "David", "Emma", "Finn"];
      const session = await onlineSession(page, true, [...characters], true, mode, undefined, names);
      try {
        const activate = (button: Locator) => info.project.name === "phone" ? button.tap() : button.click();
        const world = page.locator(".party-world");
        const figure = page.getByRole("button", { name: "Zur Figur", exact: true });
        const whole = page.getByRole("button", { name: mode === "party" ? "Ganze Insel" : "Ganze Schale", exact: true });
        const zoomIn = page.getByRole("button", { name: "Karte vergrößern", exact: true });
        const zoomOut = page.getByRole("button", { name: "Karte verkleinern", exact: true });
        const browser = page.getByRole("dialog", { name: "Felder und Figuren", exact: true });
        await expect(world).toHaveAttribute("data-webgl", "ready");
        await expect.poll(() => world.getAttribute("data-frames").then(Number)).toBeGreaterThan(8);
        await page.getByRole("button", {name:"Kamera öffnen",exact:true}).click();
        await expect(figure).toHaveAttribute("aria-pressed", "true");
        await expect(browser).toHaveCount(0);
        await expect(zoomOut).toBeDisabled();
        const before = (await session.state()).partyGame!;
        const start = await camera(world);
        await page.screenshot({ path: info.outputPath("figurenfokus.png") });

        const sizes = info.project.name === "phone" ? [{ width: 390, height: 844 }, { width: 320, height: 740 }] : [{ width: 1280, height: 900 }];
        for (const size of sizes) {
          await page.setViewportSize(size);
          for (const button of await page.locator(".party-camera-tools button").all()) {
            const bounds = (await button.boundingBox())!;
            expect(bounds.width).toBeGreaterThanOrEqual(44);
            expect(bounds.height).toBeGreaterThanOrEqual(44);
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
          await page.screenshot({ path: info.outputPath(`kamera-${size.width}.png`) });
        }
        await page.setViewportSize(info.project.name === "phone" ? { width: 390, height: 844 } : { width: 1280, height: 900 });

        await page.getByRole("button", {name:"Kamera schließen",exact:true}).click();
        const bounds = (await world.boundingBox())!;
        const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        if (info.project.name === "phone") {
          const touch = await page.context().newCDPSession(page);
          const points = (spread: number) => [{ x: center.x - spread, y: center.y, id: 0 }, { x: center.x + spread, y: center.y, id: 1 }];
          await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(30) });
          await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(55) });
          await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await touch.detach();
        } else {
          await page.mouse.move(center.x, center.y);
          await page.mouse.wheel(0, -300);
        }
        await page.getByRole("button", {name:"Kamera öffnen",exact:true}).click();
        await expect(zoomOut).toBeEnabled();
        // Camera gestures must not inspect a field on release.
        await expect(figure).toHaveAttribute("aria-pressed", "true");
        await activate(figure);
        await expect.poll(async () => distance(start, await camera(world))).toBeLessThan(.15);

        await activate(whole);
        await expect(whole).toHaveAttribute("aria-pressed", "true");
        await expect.poll(async () => distance(start, await camera(world))).toBeGreaterThan(15);
        await page.screenshot({ path: info.outputPath("gesamte-karte.png") });
        await activate(zoomIn);
        await expect(zoomOut).toBeEnabled();
        await activate(page.getByRole("button", { name: "Kamera nach rechts drehen", exact: true }));
        await figure.focus();
        await page.keyboard.press("Enter");
        // Reset must restore both orientation and distance after zooming and rotating.
        await expect.poll(async () => distance(start, await camera(world))).toBeLessThan(.15);
        await expect(figure).toHaveAttribute("aria-pressed", "true");
        await expect(zoomOut).toBeDisabled();

        await page.getByRole("button", {name:"Kamera schließen",exact:true}).click();
        await page.getByRole("button", { name: "Felder und Figuren", exact: true }).click();
        const field = mode === "party" ? "Feld 6: Shop, Trophäenstand" : "Feld 2: Grinder";
        const inspect = page.getByRole("button", { name: field, exact: true });
        await inspect.focus();
        await page.keyboard.press("Enter");
        await expect(inspect).toHaveAttribute("aria-pressed", "true");
        await expect(browser.locator(".party-map-caption")).toContainText(mode === "party" ? "Trophäenstand: 20 Münzen" : "Grinder beim Passieren für 8 Münzen");
        await expect.poll(async () => distance(start, await camera(world))).toBeLessThan(.15);
        await browser.getByRole("button", { name: "Felder und Figuren schließen", exact: true }).click();
        await expect.poll(async () => distance(start, await camera(world))).toBeLessThan(.15);
        const after = (await session.state()).partyGame!;
        expect(after.seq).toEqual(before.seq);
        expect(after.players.map(player => player.position)).toEqual(before.players.map(player => player.position));

        await page.getByRole("button", { name: "Zur 2D-Übersicht wechseln", exact: true }).click();
        await expect(page.locator(".party-world")).toHaveCount(0);
        await page.getByRole("button", { name: "Zur 3D-Ansicht wechseln", exact: true }).click();
        await expect(world).toHaveAttribute("data-webgl", "ready");
        await page.getByRole("button", {name:"Kamera öffnen",exact:true}).click();
        await expect(figure).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", {name:"Kamera schließen",exact:true}).click();
        await page.getByRole("button", { name: "Felder und Figuren", exact: true }).click();
        await browser.getByRole("button", { name: field, exact: true }).click();
        await browser.getByRole("button", { name: "Felder und Figuren schließen", exact: true }).click();
        await page.getByRole("button", {name:"Kamera öffnen",exact:true}).click();
        await expect(figure).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", {name:"Kamera schließen",exact:true}).click();
        await page.getByRole("button", { name: "Würfeln & losziehen", exact: true }).click();
        await expect.poll(async () => (await session.state()).partyGame!.dice.length).toBeGreaterThan(0);
        expect(await world.boundingBox()).toEqual(bounds);
        expect(errors).toEqual([]);
      } finally { session.close(); }
    });
  }
}
