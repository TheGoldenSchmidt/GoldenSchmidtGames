import {test,expect} from "@playwright/test";
import {onlineSession} from "./party-session";
import {NEUTRAL_MATCH_INPUT} from "../../shared/matches/types";

test("Auftakt legt Reihenfolge fest und startet ohne hektische Brettfrist",async({page},info)=>{
 await page.emulateMedia({reducedMotion:"reduce"});const session=await onlineSession(page,false,undefined,false);
 try{
  await expect(page.getByText("Auftakt: Bestimmt eure Zugreihenfolge",{exact:true})).toBeVisible();
  for(const id of session.ids)await session.action({type:"ready"},id);
  // The opening is drawn at random: a 3D arena or one of the match games.
  if((await session.state()).partyGame!.mini!.match){
    await expect(page.locator(".match-stage")).toBeVisible();
    await expect(page.locator(".match-countdown")).toHaveCount(0,{timeout:12000});
    for(let i=0;i<session.ids.length;i++)await session.control(session.ids[i],{...NEUTRAL_MATCH_INPUT,x:i?1:-1},1000);
  }else{
    await expect(page.locator(".party-action-world")).toHaveAttribute("data-webgl","ready",{timeout:15000});
    await expect(page.locator(".party-action-countdown")).toHaveCount(0,{timeout:12000});
    for(let i=0;i<session.ids.length;i++)await session.control(session.ids[i],{x:i?1:-1,z:0,jump:false,punch:false},1000);
  }
  for(const id of session.ids){const r=await session.state();if(r.partyGame!.phase==="mini-play")await session.action({type:"finish"},id);}
  await expect(page.getByRole("heading",{name:"Eure Reihenfolge steht!",exact:true})).toBeVisible();
  const result=await session.state(),order=[...result.partyGame!.order];expect(result.partyGame!.players.every(p=>p.coins===10)).toBe(true);
  await session.action({type:"next"});await expect(page.locator(".party-world")).toHaveAttribute("data-webgl","ready",{timeout:15000});
  const current=await session.state();expect(current.partyGame!.order).toEqual(order);expect(current.partyGame!.deadline).toBe(0);
  await expect(page.locator(".party-decision-time")).toHaveCount(0);await expect(page.getByLabel("Feste Zugreihenfolge und Punktestand")).toBeVisible();
  await page.screenshot({path:info.outputPath("klare-inselkarte.png"),fullPage:true});
  await page.getByRole("button",{name:"Zur 2D-Übersicht wechseln",exact:true}).click();await expect(page.locator(".party-field")).toHaveCount(34);
  await page.getByRole("button",{name:/^Feld 4: Ereignis$/}).first().click();await expect(page.getByText("Eine Überraschung für dich oder die ganze Gruppe.",{exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath("feldinfo-uebersicht.png"),fullPage:true});
 }finally{session.close();}
});

test("Ungültige gespeicherte Inselparty bietet keinen Wiederbeitritt",async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("spielraum.party.online.v1",JSON.stringify({code:"ZZZZZ",partyToken:"expired"})));
 await page.goto("/");await expect.poll(()=>page.evaluate(()=>localStorage.getItem("spielraum.party.online.v1"))).toBeNull();
 await expect(page.getByRole("button",{name:"Online-Inselparty wieder beitreten",exact:true})).toHaveCount(0);
});

test("Host beendet die Partie für alle, danach geht es in die Lobby desselben Raums",async({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});const session=await onlineSession(page);
 try{
  const code=(await session.state()).code;
  await page.getByRole("button",{name:"Spielmenü öffnen",exact:true}).click();await page.getByRole("button",{name:"Partie für alle beenden",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Partie beendet",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Zurück zur Lobby",exact:true}).click();
  // Same room, back in its lobby, no game left (decision: rooms are not closed after a game).
  await expect(page.getByRole("heading",{name:"Mitspieler",exact:true})).toBeVisible();
  await expect(page.getByText(code,{exact:true})).toBeVisible();
  const room=await session.state();expect(room.code).toBe(code);expect(room.phase).toBe("lobby");expect(room.partyGame).toBeUndefined();
 }finally{session.close();}
});

test("Abbruch während man draußen ist: der Wiederbeitritt führt über das Ende in die Lobby desselben Raums",async({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});const session=await onlineSession(page);
 try{
  await page.getByRole("button",{name:"Spielmenü öffnen",exact:true}).click();await page.getByRole("button",{name:"Verlassen",exact:true}).click();const resume=page.getByRole("button",{name:"Online-Inselparty wieder beitreten",exact:true});await expect(resume).toBeVisible();
  const state=await session.state();await session.action({type:"abort"},state.hostId);
  // The room stays open after an abort, so the rejoin remains valid and shows the end of the game.
  await resume.click();
  await expect(page.getByRole("heading",{name:"Partie beendet",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Zurück zur Lobby",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Mitspieler",exact:true})).toBeVisible();
  expect((await session.state()).phase).toBe("lobby");
 }finally{session.close();}
});
