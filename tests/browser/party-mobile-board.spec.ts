import { test, expect } from "@playwright/test";
import { activePartyPlayer } from "../../shared/party";
import { onlineSession } from "./party-session";

const characters=["alpha_rick_prime","alpha_summer_smith","alpha_scary_terry","alpha_mr_nimbus","alpha_doctor_timothy","alpha_pupa"] as const;
for(const mode of ["party","roll-it-up"] as const)for(const motion of ["no-preference","reduce"] as const) {
  test(`${mode}: kompakter Brett-HUD und laufende Figuren (${motion})`,async({page},info)=>{
    await page.emulateMedia({reducedMotion:motion});
    const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
    const session=await onlineSession(page,true,[...characters],true,mode,undefined,["Anna mit einem langen Namen","Ben","Clara","David","Emma","Finn"]);
    try {
      const world=page.locator(".party-world"),roster=page.locator(".party-board-roster");
      await expect(world).toHaveAttribute("data-webgl","ready");
      await expect.poll(()=>world.getAttribute("data-frames").then(Number)).toBeGreaterThan(8);
      await expect(roster.locator(".character-avatar")).toHaveCount(6);
      await expect(page.getByText("Die 3D-Minispiele ausprobieren",{exact:true})).toHaveCount(0);
      await expect(page.getByText("Regeln & Spielgefühl",{exact:true})).toHaveCount(0);
      const sizes=info.project.name==="phone"?[{width:390,height:844},{width:320,height:740},{width:844,height:390}]:[{width:1280,height:900}];
      for(const size of sizes){
        await page.setViewportSize(size);
        if(info.project.name==="phone"){
          expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(size.height+1);
          expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(size.width);
          const action=(await page.getByRole("button",{name:"Würfeln & losziehen",exact:true}).boundingBox())!;
          expect(action.x+action.width).toBeGreaterThanOrEqual(size.width-14);
        }
        const mapBox=(await world.boundingBox())!,players=(await roster.boundingBox())!;
        expect(mapBox.height).toBeGreaterThan(size.height<500?90:200);
        expect(players.y).toBeGreaterThanOrEqual(mapBox.y+mapBox.height-1);
        if(info.project.name==="phone")expect(players.y+players.height).toBeLessThanOrEqual(size.height);
        for(const button of await page.locator(".party-map-side-tools button, .party-board-toolbar button").all()){
          const bounds=(await button.boundingBox())!;
          expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
          expect(bounds.y+bounds.height).toBeLessThanOrEqual(size.height);
        }
        await page.screenshot({path:info.outputPath(`board-${size.width}.png`)});
      }
      await page.setViewportSize(info.project.name==="phone"?{width:390,height:844}:{width:1280,height:900});
      const before=(await session.state()).partyGame!;
      const inventory=page.getByRole("button",{name:"Dein Inventar öffnen",exact:true});
      await inventory.click();
      const panel=page.getByRole("dialog",{name:"Dein Inventar",exact:true});
      await expect(panel).toContainText("Geschenke und Inselmärkte");
      await page.screenshot({path:info.outputPath("inventory-panel.png")});
      await page.keyboard.press("Escape");await expect(panel).toHaveCount(0);
      await expect(inventory).toBeFocused();
      const collection=mode==="party"?"Dein Trophäenziel":"Dein Set";
      await page.getByRole("button",{name:`${collection} öffnen`,exact:true}).click();
      const content=page.getByRole("dialog",{name:collection,exact:true});
      if(mode==="roll-it-up")await expect(content.locator(".roll-collection li")).toHaveCount(6);
      else await expect(content.getByRole("meter")).toHaveAttribute("value","10");
      await content.getByRole("button",{name:`${collection} schließen`,exact:true}).click();
      await page.getByRole("button",{name:"Spielmenü öffnen",exact:true}).click();
      await expect(page.getByRole("dialog")).toContainText("Vibration");
      await page.keyboard.press("Escape");
      await page.getByRole("button",{name:"Zur 2D-Übersicht wechseln",exact:true}).click();
      await expect(world).toHaveCount(0);await expect(roster.locator(".character-avatar")).toHaveCount(6);
      if(info.project.name==="phone")expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(845);
      await page.getByRole("button",{name:"Zur 3D-Ansicht wechseln",exact:true}).click();
      await expect(world).toHaveAttribute("data-webgl","ready");
      await expect.poll(()=>world.getAttribute("data-frames").then(Number)).toBeGreaterThan(1);
      const after=(await session.state()).partyGame!;
      expect(after.seq).toEqual(before.seq);expect(after.players).toEqual(before.players);

      const actor=activePartyPlayer(after).id;
      const read=()=>world.getAttribute("data-motion").then(value=>JSON.parse(value??"{}")[actor] as {walking:boolean;stride:number;position:number[]});
      await page.getByRole("button",{name:"Würfeln & losziehen",exact:true}).click();
      if(motion==="no-preference"){
        await expect.poll(async()=>(await read())?.walking,{intervals:[30],timeout:8000}).toBe(true);
        const first=await read();
        await expect.poll(async()=>Math.abs((await read()).stride-first.stride),{intervals:[20]}).toBeGreaterThan(.02);
        await expect.poll(async()=>(await read()).position.some((n,i)=>Math.abs(n-first.position[i])>.02),{intervals:[20]}).toBe(true);
      }else {
        await expect.poll(async()=>(await session.state()).partyGame!.dice.length).toBeGreaterThan(0);
        expect((await read()).walking).toBe(false);expect((await read()).stride).toBe(0);
      }
      await expect.poll(async()=>(await session.state()).partyGame!.phase,{timeout:10000,intervals:[100]}).not.toBe("moving");
      await expect.poll(async()=>Math.abs((await read()).stride),{timeout:3000}).toBeLessThan(.02);
      const settled=(await session.state()).partyGame!,active=activePartyPlayer(settled);
      await expect(page.locator(`.party-player-position[data-player="${actor}"]`)).toHaveAttribute("data-field",String(active.position));
      if(info.project.name==="phone")expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(845);
      expect(errors).toEqual([]);
    }finally{session.close();}
  });
}
