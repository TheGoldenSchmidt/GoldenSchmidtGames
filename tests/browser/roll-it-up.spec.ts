import { test, expect } from "@playwright/test";
import { onlineSession } from "./party-session";

test("Bauschale, persönliche Sammlung und Kaufstellen sind spielbar", async ({page}, info) => {
  const session = await onlineSession(page, true, undefined, true, "roll-it-up");
  try {
    await expect(page.locator(".party-world")).toHaveAttribute("data-webgl", "ready");
    await expect(page.locator(".party-screen")).not.toContainText("Trophäe");
    await expect(page.locator(".party-header")).toContainText("Roll It Up!");
    await page.screenshot({path:info.outputPath("bauschale.png")});
    await page.getByRole("button", {name:"Dein Set öffnen",exact:true}).click();
    await expect(page.locator(".roll-collection li")).toHaveCount(6);
    await page.getByRole("button",{name:"Dein Set schließen",exact:true}).click();
    await page.getByRole("button",{name:"Zur 2D-Übersicht wechseln"}).click();
    const field = page.getByRole("button",{name:"Feld 2: Grinder",exact:true});
    await field.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".party-map-caption")).toContainText("8 Münzen");
    await page.getByRole("button",{name:"Feldinfo schließen",exact:true}).click();
    await page.getByRole("button",{name:"Feld 34: Jayspot"}).click();
    await expect(page.locator(".party-map-caption")).toContainText("vollständigem Set");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize()!.width);
    await page.getByRole("button",{name:"Feldinfo schließen",exact:true}).click();
    await page.getByRole("button",{name:"Würfeln & losziehen"}).click();
    await expect.poll(async()=>(await session.state()).partyGame!.dice.length).toBe(1);
  } finally { session.close(); }
});
