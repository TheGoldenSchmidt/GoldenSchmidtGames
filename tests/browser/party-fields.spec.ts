import { settledBoardCamera } from "./board-view";
import {test,expect} from "@playwright/test";
import {onlineSession} from "./party-session";

const expected={
  coin:{color:"rgb(50, 111, 199)",symbol:"+"},
  bad:{color:"rgb(195, 61, 76)",symbol:"−"},
  event:{color:"rgb(101, 199, 131)",symbol:"!"},
  shop:{color:"rgb(166, 223, 245)",symbol:"▣"}
};
for(const mode of ["party","roll-it-up"] as const)for(const motion of ["no-preference","reduce"] as const){
  test(`${mode}: Feldfarben und Symbole ohne Nummern (${motion})`,async({page},info)=>{
    await page.emulateMedia({reducedMotion:motion});
    const session=await onlineSession(page,true,undefined,true,mode);
    try{
      const world=page.locator(".party-world");
      await expect(world).toHaveAttribute("data-webgl","ready");
      await settledBoardCamera(world);
      await page.getByRole("button",{name:"Kamera öffnen",exact:true}).click();
      await page.getByRole("button",{name:mode==="party"?"Ganze Insel":"Ganze Schale",exact:true}).click();
      await page.getByRole("button",{name:"Kamera schließen",exact:true}).click();
      // Let the requested overview finish before the visual check.
      await settledBoardCamera(world);
      await page.screenshot({path:info.outputPath("fields-3d.png")});
      await page.getByRole("button",{name:"Felder und Figuren",exact:true}).click();
      const legend=page.getByLabel("Feldarten");
      await expect(legend).toContainText("!Ereignis");
      await expect(legend).toContainText("++3 Münzen");
      await page.getByRole("button",{name:"Felder und Figuren schließen",exact:true}).click();
      await page.getByRole("button",{name:"Zur 2D-Übersicht wechseln",exact:true}).click();
      const map=page.locator(".party-map-scroll");
      await expect(map.locator(".party-field-symbol")).toHaveCount(mode==="party"?34:35);
      for(const [type,look] of Object.entries(expected)){
        for(const field of await map.locator(`.party-field--${type}`).all()){
          await expect(field.locator(":scope > circle")).toHaveCSS("fill",look.color);
          await expect(field.locator(":scope > .party-field-symbol")).toHaveText(look.symbol);
        }
      }
      for(const symbol of await map.locator(".party-field-symbol").allTextContents())expect(symbol).not.toMatch(/\d/);
      const before=(await session.state()).partyGame!;
      const event=page.getByRole("button",{name:"Feld 4: Ereignis",exact:true});
      await event.tap();
      await expect(page.locator(".party-map-caption")).toContainText("Überraschung");
      expect((await session.state()).partyGame!.seq).toEqual(before.seq);
      await page.screenshot({path:info.outputPath("fields-2d.png")});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize()!.width);
      await page.getByRole("button",{name:"Feldinfo schließen",exact:true}).click();
      await expect(event).toBeFocused();
      if(mode==="roll-it-up")await page.getByRole("button",{name:"Zur Figur zurückkehren",exact:true}).tap();
      await page.getByRole("button",{name:"Würfeln & losziehen",exact:true}).tap();
      await expect.poll(async()=>(await session.state()).partyGame!.dice.length).toBeGreaterThan(0);
    }finally{session.close();}
  });
}
