import { test,expect } from "@playwright/test";
import { ACTION_MINI_IDS, ARENA_META, NEUTRAL_INPUT } from "../../shared/partyArena";
import { onlineSession, toArenaMini, practiceSession } from "./party-session";

// Independent rooms allow the expanded arena palette to be evenly sharded in CI.
test.describe.configure({mode:"parallel"});

test("Partyinsel wird ausschließlich online angeboten",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:/Lokal spielen/}).click();
  await expect(page.getByRole("button",{name:/Inselparty/})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Qwixx starten",exact:true})).toBeVisible();
});

test("Echte 3D-Insel: Kamera, Felder, sichtbare Hauptaktion und Wiederbeitritt",async({page},info)=>{
  await page.emulateMedia({reducedMotion:"reduce"});const session=await onlineSession(page,true);
  try{
    await expect(page.locator('.party-world[data-webgl="ready"] canvas')).toBeVisible();
    await expect.poll(()=>page.locator(".party-world").getAttribute("data-frames")).not.toBeNull();
    const rollBox=await page.getByRole("button",{name:"Würfeln & losziehen",exact:true}).boundingBox();
    expect(rollBox!.y+rollBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    const viewport=page.viewportSize()!;
    await page.setViewportSize({width:320,height:740});
    const smallBox=await page.getByRole("button",{name:"Würfeln & losziehen",exact:true}).boundingBox();
    expect(smallBox!.y+smallBox!.height).toBeLessThanOrEqual(740);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
    await page.setViewportSize(viewport);
    const camera=await page.locator(".party-world").getAttribute("data-camera");
    await page.getByRole("button",{name:"Kamera öffnen",exact:true}).click();
    await page.getByRole("button",{name:"Kamera nach rechts drehen",exact:true}).click();
    await expect.poll(()=>page.locator(".party-world").getAttribute("data-camera")).not.toBe(camera);
    await page.getByRole("button",{name:"Karte vergrößern",exact:true}).click();
    await page.getByRole("button",{name:"Karte verkleinern",exact:true}).click();
    await page.getByRole("button",{name:"Zur Figur",exact:true}).click();
    await page.getByRole("button",{name:"Kamera schließen",exact:true}).click();
    await page.screenshot({path:info.outputPath("party-3d-figur.png"),fullPage:false,animations:"disabled"});
    await page.getByRole("button",{name:"Kamera öffnen",exact:true}).click();
    await page.getByRole("button",{name:"Ganze Insel",exact:true}).click();
    await page.getByRole("button",{name:"Kamera schließen",exact:true}).click();
    await page.getByRole("button",{name:"Felder und Figuren",exact:true}).click();
    await page.getByRole("button",{name:"Feld 0: Hafen",exact:true}).click();
    await expect(page.getByRole("dialog").getByText("Beim Passieren bekommst du 3 Münzen.",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Felder und Figuren schließen",exact:true}).click();
    await page.screenshot({path:info.outputPath("party-3d-insel.png"),fullPage:true,animations:"disabled"});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole("button",{name:"Spielmenü öffnen",exact:true}).click();
    await page.getByRole("button",{name:"Verlassen",exact:true}).click();
    await expect(page.getByRole("button",{name:"Lokale Inselparty fortsetzen",exact:true})).toHaveCount(0);
    await page.getByRole("button",{name:"Online-Inselparty wieder beitreten",exact:true}).click();
    await expect(page.locator('.party-world[data-webgl="ready"] canvas')).toBeVisible();
  }finally{session.close();}
});

for(const mini of ACTION_MINI_IDS)test(`3D-Minispiel ${mini}: eigene Figur mit echter Steuerung`,async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  const session=await practiceSession(page,mini);
  try{
    const dialog=page.getByRole("dialog");
    await expect(dialog.locator('.party-action-world[data-webgl="ready"] canvas')).toBeVisible({timeout:15000});
    await expect(dialog.locator(".party-action-countdown")).toHaveCount(0,{timeout:10000});
    const read=()=>dialog.locator(".party-action-world").getAttribute("data-actors").then(value=>JSON.parse(value??"[]")[0]);
    const start=await read();
    const direction=mini==="crates"?"ArrowRight":"ArrowUp";
    await page.keyboard.down(direction);await page.waitForTimeout(380);await page.keyboard.up(direction);
    if(mini==="crates")await expect.poll(async()=>(await read())?.x).toBeGreaterThan(start.x+.15);
    else await expect.poll(async()=>(await read())?.z).toBeLessThan(start.z-.15);
    if(ARENA_META[mini].jump){const before=(await read()).jumpAt;await page.keyboard.down("Space");await expect.poll(async()=>(await read())?.jumpAt).toBeGreaterThan(before);await page.keyboard.up("Space");}
    if(ARENA_META[mini].punch){const before=(await read()).punchAt;await page.keyboard.down("e");await expect.poll(async()=>(await read())?.punchAt).toBeGreaterThan(before);await page.keyboard.up("e");}
    // Pointer movement on the on-screen stick works on phones and desktop.
    const stick=await dialog.getByRole("group",{name:"Bewegungsstick"}).boundingBox();
    await page.mouse.move(stick!.x+stick!.width/2,stick!.y+stick!.height/2);await page.mouse.down();await page.mouse.move(stick!.x+stick!.width*.75,stick!.y+stick!.height/2);await page.waitForTimeout(200);await page.mouse.up();
    await page.screenshot({path:info.outputPath(`party-3d-${mini}.png`),fullPage:false,animations:"disabled"});
    await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);
    expect(errors).toEqual([]);
  }finally{session.close();}
});

test("Neigung: ausdrückliche Freigabe, Kalibrierung und Sensorsteuerung",async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(DeviceOrientationEvent,"requestPermission",{configurable:true,value:async()=>{(window as unknown as {sensorRequests:number}).sensorRequests=((window as unknown as {sensorRequests:number}).sensorRequests??0)+1;return "granted";}});});
  const session=await practiceSession(page,"tilt");
  try{
    await expect(page.getByRole("dialog").locator(".party-action-countdown")).toHaveCount(0,{timeout:15000});
    expect(await page.evaluate(()=>(window as unknown as {sensorRequests?:number}).sensorRequests??0)).toBe(0);
    await page.getByRole("button",{name:"Neigung aktivieren",exact:true}).click();
    await page.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent("deviceorientation",{beta:30,gamma:0})));
    await expect(page.getByText(/Neigung aktiv\. Halte/)).toBeVisible();
    await page.evaluate(()=>{for(let i=0;i<8;i++)window.dispatchEvent(new DeviceOrientationEvent("deviceorientation",{beta:30,gamma:14}));});
    await expect.poll(()=>page.getByRole("dialog").locator(".party-action-world").getAttribute("data-actors").then(value=>JSON.parse(value??"[]")[0]?.x)).toBeGreaterThan(.3);
    await page.getByRole("button",{name:"Gerade halten & kalibrieren",exact:true}).click();
    await page.getByRole("button",{name:"Neigung ausschalten",exact:true}).click();
    await expect(page.getByRole("button",{name:"Neigung aktivieren",exact:true})).toBeEnabled();
    expect(await page.evaluate(()=>(window as unknown as {sensorRequests:number}).sensorRequests)).toBe(1);
  }finally{session.close();}
});

test("Verweigerte Sensorfreigabe und ausbleibende Daten erhalten Ersatzsteuerung",async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(DeviceOrientationEvent,"requestPermission",{configurable:true,value:async()=>"denied"}));
  const session=await practiceSession(page,"balance");
  try{
    await page.getByRole("button",{name:"Neigung aktivieren",exact:true}).click();
    await expect(page.getByText(/Sensorfreigabe abgelehnt/)).toBeVisible();
    await expect(page.getByRole("dialog").locator(".party-action-countdown")).toHaveCount(0,{timeout:15000});
    await page.keyboard.down("ArrowUp");await page.waitForTimeout(350);await page.keyboard.up("ArrowUp");
    await expect.poll(()=>page.getByRole("dialog").locator(".party-action-world").getAttribute("data-actors").then(value=>JSON.parse(value??"[]")[0]?.z)).toBeLessThan(1.8);
    await page.evaluate(()=>Object.defineProperty(DeviceOrientationEvent,"requestPermission",{configurable:true,value:async()=>"granted"}));
    await page.getByRole("button",{name:"Neigung aktivieren",exact:true}).click();
    await expect(page.getByText(/Kein Sensorsignal verfügbar/)).toBeVisible({timeout:5000});
    await expect(page.getByRole("group",{name:"Bewegungsstick"})).toBeVisible();
  }finally{session.close();}
});

test("Online: beide Figuren bewegen sich in derselben Arena",async({page})=>{
  const session=await onlineSession(page);
  try{
    await toArenaMini(session);await session.action({type:"ready"},session.ids[1]);
    await page.getByRole("button",{name:"Ich bin bereit",exact:true}).click();
    await expect(page.locator('.party-action-world[data-webgl="ready"] canvas')).toBeVisible();
    await expect(page.locator(".party-action-countdown")).toHaveCount(0,{timeout:10000});
    const initial=(await session.state()).partyGame!.mini!.arena!,sideways=initial.id==="crates",key=sideways?"ArrowRight":"ArrowUp";
    await page.keyboard.down(key);await page.waitForTimeout(180);await page.keyboard.up(key);
    for(let seq=1;seq<=3;seq++){await session.control(session.ids[1],{x:sideways?.8:0,z:sideways?0:-.8,jump:false,punch:false},seq);await page.waitForTimeout(70);}
    await expect.poll(async()=>{const arena=(await session.state()).partyGame!.mini!.arena!;return arena.actors.every(a=>{const before=initial.actors.find(p=>p.id===a.id)!;return sideways?a.x>before.x+.05:a.z<before.z-.05;});}).toBe(true);
    const rendered=JSON.parse(await page.locator(".party-action-world").getAttribute("data-actors")??"[]");
    expect(rendered.map((a:{id:string})=>a.id).sort()).toEqual([...session.ids].sort());
    const own=async()=>(await session.state()).partyGame!.mini!.arena!.actors.find(actor=>actor.id===session.ids[0])!;
    await page.keyboard.down(key);
    await expect.poll(async()=>{const actor=await own();return sideways?actor.input.x:actor.input.z;}).not.toBe(0);
    await page.getByRole("button",{name:"Spielmenü öffnen",exact:true}).click();
    await expect.poll(async()=>(await own()).input).toEqual(NEUTRAL_INPUT);
    const inputSeq=(await own()).inputSeq;
    await page.keyboard.up(key);await page.keyboard.press("ArrowRight");await page.keyboard.press("e");
    expect((await own()).inputSeq).toBe(inputSeq);
    expect((await session.state()).partyGame!.pausedAt).toBe(0);
    await page.keyboard.press("Escape");
    await page.keyboard.down(key);
    await expect.poll(async()=>{const actor=await own();return sideways?actor.input.x:actor.input.z;}).not.toBe(0);
    await page.keyboard.up(key);
  }finally{session.close();}
});
