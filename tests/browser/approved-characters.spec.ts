import { selectEntryCharacter } from "./select-entry-character";
import {test,expect} from "@playwright/test";
import {CHARACTERS,type CharacterId} from "../../shared/characters";
import {onlineSession,toArenaMini,request} from "./party-session";

test("Sechs freigegebene Figuren bleiben in gemeinsamer Insel und Arena erhalten",async({page},info)=>{
  test.skip(info.project.name==="desktop","Inselparty ist nur für Smartphones vorgesehen.");
  test.setTimeout(90000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.emulateMedia({reducedMotion:"reduce"});
  const characters:CharacterId[]=["alpha_rick_prime","alpha_summer_smith","alpha_scary_terry","alpha_mr_nimbus","alpha_doctor_timothy","alpha_pupa"];
  const session=await onlineSession(page,false,characters);
  try{
    const world=page.locator(".party-world");await expect(world).toHaveAttribute("data-webgl","ready",{timeout:15000});
    await expect(page.locator(".party-standings .character-avatar")).toHaveCount(6);
    for(const id of characters)await expect(page.locator(`.party-standings [data-character="${id}"] img`)).toBeVisible();
    await expect.poll(()=>world.getAttribute("data-draw-calls").then(Number)).toBeGreaterThan(0);
    await page.screenshot({path:info.outputPath("sechs-figuren-insel.png")});
    const room=await toArenaMini(session),phaseId=room.partyGame!.phaseId;
    for(let i=0;i<session.sockets.length;i++)await request(session.sockets[i],"party:action",{token:session.tokens[session.ids[i]],seq:(room.partyGame!.seq[session.ids[i]]??0)+1,phaseId,action:{type:"ready"}});
    const arena=page.locator(".party-action-world");await expect(arena).toHaveAttribute("data-webgl","ready",{timeout:15000});
    const actors=()=>arena.getAttribute("data-actors").then(value=>JSON.parse(value??"[]"));
    await expect.poll(async()=>(await actors()).length).toBe(6);
    expect((await actors()).map((a:{characterId:string})=>a.characterId).sort()).toEqual([...characters].sort());
    await expect(page.locator(".party-action-countdown")).toHaveCount(0,{timeout:12000});
    const before=await actors();
    for(let i=0;i<6;i++)await session.control(session.ids[i],{x:i%2?1:-1,z:-1,jump:true,punch:true},1);
    await expect.poll(async()=>(await actors()).some((a:{id:string;x:number;z:number})=>{const old=before.find((b:{id:string})=>b.id===a.id);return Math.abs(a.x-old.x)+Math.abs(a.z-old.z)>.1;})).toBe(true);
    const rendering=await arena.evaluate(el=>({calls:el.getAttribute("data-draw-calls"),triangles:el.getAttribute("data-triangles"),frames:el.getAttribute("data-frames")}));
    expect(Number(rendering.calls)).toBeGreaterThan(0);expect(Number(rendering.calls)).toBeLessThan(500);console.log("Six-character rendering:",rendering);
    await info.attach("six-character-rendering.json",{body:JSON.stringify(rendering,null,2),contentType:"application/json"});
    await page.screenshot({path:info.outputPath("sechs-figuren-arena.png")});expect(errors).toEqual([]);
  }finally{session.close();}
});

test("Animierte Figuren stehen in der Auswahl: Porträtkarten, Vorschau auf der Bühne",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");await page.getByRole("button",{name:/Online spielen/}).click();
  await page.getByRole("button", {name: /^Raum erstellen/}).click();
  await selectEntryCharacter(page, "Morty Smith");
  await page.getByRole("button",{name:"Neuen Raum erstellen"}).click();
  const summary=page.locator(".room summary").filter({hasText:"Deine Spielfigur"});
  const grid=page.getByRole("group",{name:"Deine Spielfigur",exact:true});
  for(const [name,id] of [["Bolt","rig_bolt"],["MC Goldie","rig_mc_goldie"],["Lil Schmidt","rig_lil_schmidt"],["Morty Smith","alpha_morty_smith"]] as const){
    await selectEntryCharacter(page,name);
    await expect(summary).toContainText(name);
    await summary.click();
    await expect(page.locator(".party-character-canvas")).toHaveAttribute("data-character",id,{timeout:20000});
    await expect(page.locator(".party-character-canvas")).toHaveAttribute("data-webgl","ready");
  }
  await expect(grid.getByRole("button")).toHaveCount(CHARACTERS.length);
  await expect(grid.getByRole("button",{name:"Morty Smith"})).toHaveAttribute("aria-pressed","true");
  for(const c of CHARACTERS.filter(c=>c.id.startsWith("rig_")))expect(await grid.locator(`img[src="/characters/${c.id}.png"]`).evaluate((img:HTMLImageElement)=>img.complete?img.naturalWidth:-1),`${c.name}: Vorschaubild`).not.toBe(0);
  expect(errors).toEqual([]);
});

test("Animierte und klassische Figuren gemischt: Insel und klassische Arena zeigen die gewählten Figuren",async({page},info)=>{
  test.skip(info.project.name==="desktop","Inselparty ist nur für Smartphones vorgesehen.");
  test.setTimeout(90000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await page.emulateMedia({reducedMotion:"reduce"});
  const characters:CharacterId[]=["rig_mc_goldie","rig_lil_schmidt","rig_kiki_komet","rig_bolt","rig_glubschi","alpha_morty_smith"];
  const session=await onlineSession(page,false,characters);
  try{
    const world=page.locator(".party-world");await expect(world).toHaveAttribute("data-webgl","ready",{timeout:20000});
    for(const id of characters)await expect(page.locator(`.party-standings [data-character="${id}"] img`)).toBeVisible();
    await expect.poll(()=>world.getAttribute("data-draw-calls").then(Number)).toBeGreaterThan(0);
    await page.screenshot({path:info.outputPath("gemischte-figuren-insel.png")});
    const room=await toArenaMini(session),phaseId=room.partyGame!.phaseId;
    for(let i=0;i<session.sockets.length;i++)await request(session.sockets[i],"party:action",{token:session.tokens[session.ids[i]],seq:(room.partyGame!.seq[session.ids[i]]??0)+1,phaseId,action:{type:"ready"}});
    const arena=page.locator(".party-action-world");await expect(arena).toHaveAttribute("data-webgl","ready",{timeout:20000});
    const actors=()=>arena.getAttribute("data-actors").then(value=>JSON.parse(value??"[]"));
    await expect.poll(async()=>(await actors()).length).toBe(6);
    expect((await actors()).map((a:{characterId:string})=>a.characterId).sort()).toEqual([...characters].sort());
    await expect(page.locator(".party-action-countdown")).toHaveCount(0,{timeout:12000});
    for(let i=0;i<6;i++)await session.control(session.ids[i],{x:i%2?1:-1,z:-1,jump:true,punch:true},1);
    await page.waitForTimeout(600);
    const rendering=await arena.evaluate(el=>({calls:el.getAttribute("data-draw-calls"),triangles:el.getAttribute("data-triangles")}));
    expect(Number(rendering.calls)).toBeGreaterThan(0);expect(Number(rendering.calls)).toBeLessThan(600);console.log("Mixed rigged/classic rendering:",rendering);
    await page.screenshot({path:info.outputPath("gemischte-figuren-arena.png")});expect(errors).toEqual([]);
  }finally{session.close();}
});

for(const [game,marker] of [["Qwixx",".qwixx-turn"],["Durak",".durak-players"],["Kribbeln",".kribbel-score-strip"]])test(`${game}: Auswahl begleitet lokale Spieler`,async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/");await page.getByRole("button",{name:/Lokal spielen/}).click();
  await page.getByRole("button",{name:new RegExp(`^${game} `)}).first().click();
  await expect(page.getByRole("button",{name:`${game} starten`,exact:true})).toBeDisabled();
  const selected=CHARACTERS.slice(2,4);
  for(let i=0;i<2;i++)await page.getByRole("combobox",{name:`Figur von Spieler ${i+1}`,exact:true}).selectOption(selected[i].id);
  await page.getByRole("button",{name:`${game} starten`,exact:true}).click();
  if(game==="Durak")await page.getByRole("button",{name:"Karten anzeigen",exact:true}).click();
  await expect(page.locator(`${marker} .character-avatar`).first()).toBeVisible();
  expect(await page.locator(`${marker} .character-avatar`).first().getAttribute("data-character")).toMatch(/alpha_(summer|jerry)_smith/);
});
