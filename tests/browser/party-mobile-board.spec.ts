import { settledBoardCamera } from "./board-view";
import { test, expect } from "@playwright/test";
import { activePartyPlayer } from "../../shared/party";
import { onlineSession } from "./party-session";

const characters=["alpha_rick_prime","alpha_summer_smith","alpha_scary_terry","alpha_mr_nimbus","alpha_doctor_timothy","alpha_pupa"] as const;
for(const mode of ["party","roll-it-up"] as const)for(const motion of ["no-preference","reduce"] as const) {
  test(`${mode}: bildschirmfüllender Brett-HUD und laufende Figuren (${motion})`,async({page},info)=>{
    await page.emulateMedia({reducedMotion:motion});
    const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
    const session=await onlineSession(page,true,[...characters],true,mode,undefined,["Anna","Ben","Clara","David","Emma","Finn"].map(name=>`${name} mit einem langen Namen`));
    try {
      const world=page.locator(".party-world"),roster=page.locator(".party-board-roster");
      await expect(world).toHaveAttribute("data-webgl","ready");
      await settledBoardCamera(world);
      await expect(roster.locator(".character-avatar")).toHaveCount(6);
      await expect(page.getByText("Die 3D-Minispiele ausprobieren",{exact:true})).toHaveCount(0);
      await expect(page.getByText("Regeln & Spielgefühl",{exact:true})).toHaveCount(0);
      const initialCamera=JSON.parse((await world.getAttribute("data-camera"))!);
      const sizes=info.project.name==="phone"?[{width:390,height:844},{width:320,height:740},{width:844,height:390}]:[{width:1280,height:900}];
      for(const size of sizes){
        await page.setViewportSize(size);
        await settledBoardCamera(world);
        if(info.project.name==="phone"){
          expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(size.height+1);
          expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(size.width);
          const action=(await page.getByRole("button",{name:"Würfeln & losziehen",exact:true}).boundingBox())!;
          expect(action.x+action.width).toBeLessThanOrEqual(size.width);
          expect(action.height).toBeGreaterThanOrEqual(50);
        }
        const mapBox=(await world.boundingBox())!,players=(await roster.boundingBox())!;
        expect(mapBox.x).toBe(0);expect(mapBox.y).toBe(0);
        expect(mapBox.width).toBe(size.width);expect(mapBox.height).toBe(size.height);
        expect(players.y).toBeGreaterThan(mapBox.height*.7);
        const decision=(await page.locator(".party-decision").boundingBox())!;
        expect(decision.y+decision.height).toBeLessThanOrEqual(players.y);
        if(info.project.name==="phone")expect(players.y+players.height).toBeLessThanOrEqual(size.height);
        for(const button of await page.locator(".party-map-side-tools button, .party-board-toolbar button").all()){
          const bounds=(await button.boundingBox())!;
          expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
          expect(bounds.y+bounds.height).toBeLessThanOrEqual(size.height);
        }
        await page.screenshot({path:info.outputPath(`board-${size.width}.png`)});
      }
      const frames=Number(await world.getAttribute("data-frames"));
      await page.setViewportSize(info.project.name==="phone"?{width:390,height:844}:{width:1280,height:900});
      await expect.poll(()=>world.getAttribute("data-frames").then(Number)).toBeGreaterThan(frames);
      await settledBoardCamera(world);
      await expect.poll(async()=>{
        const current=JSON.parse((await world.getAttribute("data-camera"))!);
        return Math.hypot(...current.map((n:number,i:number)=>n-initialCamera[i]));
      },{timeout:10000}).toBeLessThan(.05);
      const cameraBefore=JSON.parse((await world.getAttribute("data-camera"))!);
      const sceneBefore=await world.boundingBox();
      const before=(await session.state()).partyGame!;
      if(mode==="roll-it-up"){
        const label=(await page.locator(".roll-world-label.is-active").boundingBox())!;
        await page.touchscreen.tap(label.x+label.width/2,label.y+label.height+30);
      } else await world.tap({position:{x:sceneBefore!.width/2,y:sceneBefore!.height/2}});
      const fieldPopup=page.getByRole("dialog",{name:"Feldinfo",exact:true});
      await expect(fieldPopup).toContainText("Beim Passieren bekommst du 3 Münzen.");
      expect(await world.boundingBox()).toEqual(sceneBefore);
      await fieldPopup.getByRole("button",{name:"Feldinfo schließen",exact:true}).tap();await expect(fieldPopup).toHaveCount(0);
      const inventory=page.getByRole("button",{name:"Dein Inventar öffnen",exact:true});
      await inventory.click();
      const panel=page.getByRole("dialog",{name:"Dein Inventar",exact:true});
      await expect(panel).toContainText("Geschenke und Inselmärkte");
      await page.screenshot({path:info.outputPath("inventory-panel.png")});
      await panel.getByRole("button",{name:"Dein Inventar schließen",exact:true}).tap();await expect(panel).toHaveCount(0);
      await expect(inventory).toBeFocused();
      const collection=mode==="party"?"Dein Trophäenziel":"Dein Set";
      await page.getByRole("button",{name:`${collection} öffnen`,exact:true}).click();
      const content=page.getByRole("dialog",{name:collection,exact:true});
      if(mode==="roll-it-up")await expect(content.locator(".roll-collection li")).toHaveCount(6);
      else await expect(content.getByRole("meter")).toHaveAttribute("value","10");
      await content.getByRole("button",{name:`${collection} schließen`,exact:true}).click();
      await page.getByRole("button",{name:"Spielmenü öffnen",exact:true}).click();
      await expect(page.getByRole("dialog")).toContainText("Vibration");
      await page.getByRole("dialog").getByRole("button",{name:/schließen$/}).tap();
      await page.getByRole("button",{name:"Felder und Figuren",exact:true}).click();
      await page.getByRole("dialog").getByRole("button",{name:"Feld 4: Ereignis",exact:true}).click();
      await expect(page.getByRole("dialog")).toContainText("Überraschung");
      await page.getByRole("dialog").getByRole("button",{name:/schließen$/}).tap();
      expect(await world.boundingBox()).toEqual(sceneBefore);
      const cameraAfter=JSON.parse((await world.getAttribute("data-camera"))!);
      expect(Math.hypot(...cameraAfter.map((n:number,i:number)=>n-cameraBefore[i]))).toBeLessThan(.15);
      await page.getByRole("button",{name:"Zur 2D-Übersicht wechseln",exact:true}).click();
      await expect(world).toHaveCount(0);await expect(roster.locator(".character-avatar")).toHaveCount(6);
      if(info.project.name==="phone")expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(845);
      await page.getByRole("button",{name:"Zur 3D-Ansicht wechseln",exact:true}).click();
      await expect(world).toHaveAttribute("data-webgl","ready");
      await settledBoardCamera(world);
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
      expect(await world.boundingBox()).toEqual(sceneBefore);
      await expect(page.locator(`.party-player-position[data-player="${actor}"]`)).toHaveAttribute("data-field",String(active.position));
      if(info.project.name==="phone")expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(845);
      expect(errors).toEqual([]);
    }finally{session.close();}
  });
}
