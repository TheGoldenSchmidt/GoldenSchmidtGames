import { test, expect } from "@playwright/test";
import { onlineSession } from "./party-session";
import { settledBoardCamera } from "./board-view";
import { activePartyPlayer, type PartyAction } from "../../shared/party";
import { boardRoute, partyPaths, stationAt } from "../../shared/partyBoard";

test("Bauschale, persönliche Sammlung und Kaufstellen sind spielbar", async ({page}, info) => {
  const session = await onlineSession(page, true, undefined, true, "roll-it-up");
  try {
    await expect(page.locator(".party-world")).toHaveAttribute("data-webgl", "ready");
    await expect(page.locator(".party-screen")).not.toContainText("Trophäe");
    await expect(page.locator(".party-header")).toContainText("Roll It Up!");
    await settledBoardCamera(page.locator(".party-world"));
    await page.screenshot({path:info.outputPath("bauschale.png")});
    await page.getByRole("button", {name:"Dein Set öffnen",exact:true}).click();
    await expect(page.locator(".roll-collection li")).toHaveCount(6);
    await page.getByRole("button",{name:"Dein Set schließen",exact:true}).click();
    await page.getByRole("button",{name:"Zur 2D-Übersicht wechseln"}).click();
    const field = page.getByRole("button",{name:"Feld 2: Grinder",exact:true});
    await field.tap();
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

test("Bauschale: Kaufbestätigung und Wegvorschau folgen dem tatsächlichen Zug", async ({page}, info) => {
  test.setTimeout(120000);
  const session=await onlineSession(page,true,undefined,true,"roll-it-up");
  const viewer=activePartyPlayer((await session.state()).partyGame!).id;
  let purchased=false,chosen=false;
  try {
    // Advance only through legal actions, independent of dice and the drawn minigame.
    const end=Date.now()+100000;
    while(!(purchased&&chosen)&&Date.now()<end){
      const g=(await session.state()).partyGame!,p=activePartyPlayer(g);
      if(g.phase==="moving"){await page.waitForTimeout(150);continue;}
      if(p.id===viewer&&g.phase==="supply"&&!purchased){
        const station=stationAt(p.position)!;
        await expect(page.locator(".roll-purchase")).toContainText(`${station.price} Münzen`);
        await expect(page.locator(".roll-purchase")).not.toContainText("Danach");
        await expect(page.locator(".roll-set")).toContainText(`${p.supplies?.length??0} / 6`);
        await page.screenshot({path:info.outputPath("kaufentscheidung.png")});
        await page.getByRole("button",{name:`${station.name} kaufen`,exact:true}).tap();
        await expect.poll(async()=>(await session.state()).partyGame!.players.find(q=>q.id===viewer)!.supplies).toContain(station.field);
        await expect(page.locator(".roll-notice")).toContainText(`${station.name} gesammelt`);
        purchased=true;continue;
      }
      if(p.id===viewer&&g.phase==="path"&&!chosen){
        const destination=partyPaths(g,p).at(-1)!,route=boardRoute(g,p,destination,g.steps);
        const options=page.locator(".roll-paths button");
        await expect(options).toHaveCount(partyPaths(g,p).length);
        await options.last().tap();
        await expect(options.last()).toHaveAttribute("aria-pressed","true");
        expect((await session.state()).partyGame!.seq[viewer]).toBe(g.seq[viewer]);
        if(route.junction)await expect(options.last()).toContainText("Vorschau bis zur nächsten Gabelung");
        if(route.stations.some(s=>!s.owned))await expect(options.last()).toContainText(route.stations.find(s=>!s.owned)!.name);
        await page.screenshot({path:info.outputPath("wegentscheidung.png")});
        await page.getByRole("button",{name:"Gewählten Weg nehmen",exact:true}).tap();
        await expect.poll(async()=>(await session.state()).partyGame!.seq[viewer]).toBe(g.seq[viewer]+1);
        chosen=true;continue;
      }
      if(g.phase==="mini-result"){for(const id of session.ids)if((await session.state()).partyGame!.phase==="mini-result")await session.action({type:"next"},id);continue;}
      if(g.phase==="mini-intro"||g.phase==="mini-play"){
        for(const id of session.ids)if((await session.state()).partyGame!.phase===g.phase)await session.action({type:g.phase==="mini-intro"?"ready":"finish"},id);
        continue;
      }
      const actions:Partial<Record<typeof g.phase,PartyAction>>={turn:{type:"roll"},path:{type:"path",destination:partyPaths(g,p)[0]},supply:{type:"supply",buy:false},shop:{type:"shop"},gift:{type:"gift",accept:false},summary:{type:"next"},"mini-result":{type:"next"}};
      const action=actions[g.phase];expect(action).toBeDefined();await session.action(action!);
    }
    expect(purchased).toBe(true);expect(chosen).toBe(true);
  }finally{session.close();}
});

for(const motion of ["no-preference","reduce"] as const)test(`Bauschale: ruhende Szene und 2D-Ausweichansicht (${motion})`,async({page},info)=>{
  await page.emulateMedia({reducedMotion:motion});
  const session=await onlineSession(page,true,undefined,true,"roll-it-up");
  try{
    const world=page.locator(".party-world");await settledBoardCamera(world);
    // Render-on-demand must avoid a permanent GPU loop when no action is taking place.
    await page.waitForTimeout(700);
    const frames=Number(await world.getAttribute("data-frames"));
    await page.waitForTimeout(1000);
    expect(Number(await world.getAttribute("data-frames"))-frames).toBeLessThanOrEqual(2);
    await info.attach("renderer",{body:JSON.stringify(await world.evaluate(node=>({...((node as HTMLElement).dataset)}))),contentType:"application/json"});
    await world.locator("canvas").evaluate(canvas=>(canvas as HTMLCanvasElement).getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext());
    await expect(page.getByRole("status").filter({hasText:"3D ist hier nicht verfügbar"})).toBeVisible();
    await expect(page.locator(".party-map-scroll")).toBeVisible();
    await page.getByRole("button",{name:"Feld 2: Grinder",exact:true}).tap();
    await expect(page.getByRole("dialog")).toContainText("8 Münzen");
    await page.getByRole("button",{name:"Feldinfo schließen",exact:true}).tap();
    await page.getByRole("button",{name:"Würfeln & losziehen",exact:true}).tap();
    await expect.poll(async()=>(await session.state()).partyGame!.dice.length).toBe(1);
  }finally{session.close();}
});


test("Ergebnisse bleiben bis zur Bestätigung aller Teilnehmer sichtbar",async({page})=>{
 const session=await onlineSession(page,false,undefined,false,"roll-it-up");
 try{
  await expect.poll(async()=>(await session.state()).partyGame!.phase).toBe("mini-intro");
  for(const id of session.ids)await session.action({type:"ready"},id);
  for(const id of session.ids)if((await session.state()).partyGame!.phase==="mini-play")await session.action({type:"finish"},id);
  await page.getByRole("button",{name:"Weiter zur Bauschale",exact:true}).tap();
  await expect(page.getByRole("button",{name:"Bestätigt",exact:true})).toBeDisabled();
  expect((await session.state()).partyGame!.phase).toBe("mini-result");
  await page.reload();
  await expect(page.getByRole("button",{name:"Bestätigt",exact:true})).toBeDisabled();
  await session.action({type:"next"},session.ids[1]);
  await expect(page.locator(".roll-board")).toBeVisible();
 }finally{session.close();}
});

test("Brettkamera bleibt während Würfeln, Bewegung und Entscheidung stehen",async({page},info)=>{
 const session=await onlineSession(page,true,undefined,true,"roll-it-up");
 try{
  const world=page.locator(".party-world");await settledBoardCamera(world);
  const camera=await world.getAttribute("data-camera");
  await page.getByRole("button",{name:"Würfeln & losziehen",exact:true}).tap();
  await expect.poll(async()=>(await session.state()).partyGame!.dice.length).toBe(1);
  await expect.poll(async()=>(await session.state()).partyGame!.phase,{timeout:10000}).not.toBe("moving");
  await settledBoardCamera(world);
  expect(await world.getAttribute("data-camera")).toBe(camera);
  await expect(page.locator(".roll-turn")).toHaveCount(0);
  await page.screenshot({path:info.outputPath("kompaktes-zugpanel.png")});
 }finally{session.close();}
});
