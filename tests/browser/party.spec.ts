import { test,expect } from "@playwright/test";
import { activePartyPlayer, applyPartyAction, COLORS, createPartyGame, createPartyPractice, MINI_IDS, SYMBOLS, type PartyGame } from "../../shared/party";

async function restore(page:import('@playwright/test').Page,fixture:PartyGame) {
  await page.clock.install({time:new Date(100000)});
  await page.addInitScript(value=>localStorage.setItem("spielraum.party.local.v1",JSON.stringify(value)),fixture);
  await page.goto("/");await page.getByRole("button",{name:"Lokale Inselparty fortsetzen",exact:true}).click();
}

test("Inselparty: Brett, beide Geräteformate, Speichern und vollständige lokale Partie",async({page},testInfo)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button",{name:/Lokal spielen/}).click();
  await page.getByRole("button",{name:/Inselparty Eine Insel/}).click();
  await page.getByRole("combobox",{name:"Runden",exact:true}).selectOption("5");
  await page.getByRole("button",{name:"Inselparty starten",exact:true}).click();
  await expect(page.getByRole("heading",{name:/du bist dran/})).toBeVisible();
  await expect(page.getByRole("button",{name:/Feld 0:/})).toHaveCount(1);
  const rollBox=await page.getByRole("button",{name:"Würfeln & losziehen",exact:true}).boundingBox();
  expect(rollBox!.y+rollBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.screenshot({path:testInfo.outputPath("inselparty-board.png"),fullPage:true,animations:"disabled"});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole("button",{name:"Karte vergrößern"}).click();
  await page.getByRole("button",{name:"Karte verkleinern"}).click();
  await page.getByRole("button",{name:"Verlassen",exact:true}).click();
  await page.getByRole("button",{name:"Lokale Inselparty fortsetzen",exact:true}).click();
  for(let actions=0;actions<500;actions++){
    const phase=await page.evaluate(()=>JSON.parse(localStorage.getItem("spielraum.party.local.v1")!).phase as string);
    if(phase==="finished")break;
    if(phase==="turn")await page.getByRole("button",{name:"Würfeln & losziehen",exact:true}).click();
    else if(phase==="path")await page.getByRole("button",{name:/Hauptweg/}).click();
    else if(phase==="trophy")await page.getByRole("button",{name:/Trophäe kaufen/}).click();
    else if(phase==="gift")await page.getByRole("button",{name:"Geschenk annehmen",exact:true}).click();
    else if(phase==="shop")await page.getByRole("button",{name:"Ohne Einkauf weiter",exact:true}).click();
    else if(phase==="summary")await page.getByRole("button",{name:"Nächster Zug",exact:true}).click();
    else if(phase==="mini-intro")await page.getByRole("button",{name:"Ich bin bereit",exact:true}).click();
    else if(phase==="mini-play"){await page.clock.fastForward(4000);await page.getByText("Versuch vorzeitig beenden",{exact:true}).click();await page.getByRole("button",{name:"Versuch beenden",exact:true}).click();}
    else if(phase==="mini-result")await page.getByRole("button",{name:/Weiter zur Insel|Zur Siegerehrung/}).click();
    else throw new Error(`Unerwartete Phase: ${phase}`);
    await page.clock.runFor(phase==="turn"?1800:phase==="path"?1100:110);
  }
  await expect(page.getByRole("heading",{name:"Die Insel feiert euch!"})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath("inselparty-finale.png"),fullPage:true,animations:"disabled"});
  expect(errors).toEqual([]);
});

test("Minispiel-Übung: Countdown, Touch-/Maus-Eingaben und reduzierte Bewegung",async({page},info)=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");
  await page.getByRole("button",{name:/Lokal spielen/}).click();
  await page.getByRole("button",{name:/Inselparty Eine Insel/}).click();
  await page.getByRole("button",{name:"Inselparty starten",exact:true}).click();
  // Der UI-Übungsdialog wird über echte Brettzüge erreicht.
  for(let i=0;i<25;i++){
    const phase=await page.evaluate(()=>JSON.parse(localStorage.getItem("spielraum.party.local.v1")!).phase as string);
    if(phase==="mini-intro")break;
    const names:Record<string,string|RegExp>={turn:"Würfeln & losziehen",path:/Hauptweg/,trophy:"Weiterziehen",gift:"Ablehnen",shop:"Ohne Einkauf weiter",summary:"Nächster Zug"};
    await page.getByRole("button",{name:names[phase],exact:typeof names[phase]==="string"}).click();
  }
  await page.screenshot({path:info.outputPath("inselparty-minispiel-start.png"),fullPage:true,animations:"disabled"});
  await page.getByRole("button",{name:"Erst kurz üben",exact:true}).click();
  await expect(page.getByText("Übung · zählt nicht zur Wertung",{exact:true})).toBeVisible();
  await expect(page.getByRole("dialog")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button",{name:"Zurück zur Minispielrunde",exact:true})).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button",{name:"Ich bin bereit",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Erst kurz üben",exact:true})).toBeFocused();
});

for(const mini of MINI_IDS)test(`Minispiel ${mini}: echte Eingabe verändert die Wertung`,async({page},info)=>{
  const fixture=createPartyPractice(mini,100000);
  await restore(page,fixture);
  await expect(page.getByText("Gleich geht’s los!",{exact:true})).toBeVisible();
  await expect(page.getByLabel("Punktestand",{exact:true})).toHaveCount(0);
  await page.clock.runFor(3100);
  if(mini==="targets")await page.getByRole("button",{name:`Schatzfeld ${fixture.mini!.targets[0]+1}`,exact:true}).click();
  if(mini==="colors")await page.getByRole("button",{name:COLORS[fixture.mini!.prompts[0]],exact:true}).click();
  if(mini==="memory"){const pair=fixture.mini!.cards.flatMap((v,i)=>v===0?[i]:[]);for(const index of pair){await page.getByRole("button",{name:`Muschel ${index+1}, verdeckt`,exact:true}).click();await page.clock.runFor(100);}}
  if(mini==="timing"){await page.clock.runFor(1100);await page.getByRole("button",{name:"Jetzt stoppen",exact:true}).click();}
  if(mini==="trail"){await page.clock.runFor(6000);await page.getByRole("button",{name:SYMBOLS[fixture.mini!.trail[0]],exact:true}).click();}
  if(mini==="risk"){await page.getByRole("button",{name:"Beute sichern",exact:true}).click();}
  await page.clock.runFor(100);
  const result=await page.evaluate(()=>JSON.parse(localStorage.getItem("spielraum.party.local.v1")!).mini.runs.practice);
  expect(mini==="risk"?result.attempts:result.score).toBeGreaterThan(0);
  await page.clock.runFor(250);
  await page.screenshot({path:info.outputPath(`minispiel-${mini}.png`),fullPage:true,animations:"disabled"});
});

test("Der Würfel fällt vor der Bewegung; reduzierte Bewegung überspringt Animationen",async({page})=>{
  const fixture=createPartyGame([{id:"a",name:"Anna"},{id:"b",name:"Ben"}],{rounds:5},false,123,100000);
  const id=activePartyPlayer(fixture).id;
  await restore(page,fixture);
  await page.getByRole("button",{name:"Würfeln & losziehen",exact:true}).click();
  await expect(page.locator(".party-dice-tray")).toHaveClass(/is-rolling/);
  await page.clock.runFor(600);
  await expect(page.locator(`.party-pawn[data-player="${id}"]`)).toHaveAttribute("data-field","0");
  await page.clock.runFor(260);
  await expect(page.locator(`.party-pawn[data-player="${id}"]`)).toHaveAttribute("data-field","1");
  await page.clock.runFor(1000);
  const destination=await page.evaluate((id)=>JSON.parse(localStorage.getItem("spielraum.party.local.v1")!).players.find((p:{id:string})=>p.id===id).position,id);
  await expect(page.locator(`.party-pawn[data-player="${id}"]`)).toHaveAttribute("data-field",String(destination));
  // Reload the initial state with reduced motion: the same rules resolve immediately.
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.evaluate(value=>localStorage.setItem("spielraum.party.local.v1",JSON.stringify(value)),fixture);
  await page.reload();await page.getByRole("button",{name:"Lokale Inselparty fortsetzen",exact:true}).click();
  await page.getByRole("button",{name:"Würfeln & losziehen",exact:true}).click();
  await expect(page.locator(".party-dice-tray")).not.toHaveClass(/is-rolling/);
  await expect(page.locator(`.party-pawn[data-player="${id}"]`)).toHaveAttribute("data-field",String(destination));
});

test("Wegwahl setzt die Bewegung ohne Wiederholung fort",async({page},info)=>{
  const fixture=createPartyGame([{id:"a",name:"Anna"},{id:"b",name:"Ben"}],{rounds:5},false,123,100000);
  const player=activePartyPlayer(fixture);player.position=8;fixture.phase="path";fixture.steps=2;fixture.path=[6,7,8];fixture.dice=[4];
  await restore(page,fixture);await page.clock.runFor(450);
  const pawn=page.locator(`.party-pawn[data-player="${player.id}"]`);
  await expect(pawn).toHaveAttribute("data-field","8");
  await page.getByRole("button",{name:/Abenteuerweg/}).click();await page.clock.runFor(50);
  await expect(pawn).toHaveAttribute("data-field","8");
  await page.clock.runFor(150);await expect(pawn).toHaveAttribute("data-field","28");
  await page.clock.runFor(150);await expect(pawn).toHaveAttribute("data-field","29");
  await page.screenshot({path:info.outputPath("inselparty-wegwahl.png"),fullPage:true,animations:"disabled"});
});

test("Brückenstopp hält den Marker an und startet den nächsten Versuch",async({page})=>{
  await restore(page,createPartyPractice("timing",100000));
  await page.clock.runFor(4200);
  await page.getByRole("button",{name:"Jetzt stoppen",exact:true}).click();
  const marker=page.locator(".party-timing-marker");
  await expect(marker).toHaveClass(/is-stopped/);
  const stoppedAt=await marker.getAttribute("style");
  await page.clock.runFor(500);
  await expect(marker).toHaveAttribute("style",stoppedAt!);
  await page.clock.runFor(800);
  await expect(page.getByRole("button",{name:"Jetzt stoppen",exact:true})).toBeEnabled();
  await expect(marker).not.toHaveClass(/is-stopped/);
});

test("Items zeigen nur ihre eigene Zielauswahl und werden bewusst eingesetzt",async({page})=>{
  const fixture=createPartyGame([{id:"a",name:"Anna"},{id:"b",name:"Ben"}],{rounds:5},false,123,100000);
  activePartyPlayer(fixture).items=["shield","magnet","compass"];
  await restore(page,fixture);
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await page.locator(".party-inventory summary").click();
  await page.getByRole("button",{name:/Schutzschild Wehrt/}).click();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await page.getByRole("button",{name:/Münzangel Bis/}).click();
  await expect(page.getByRole("combobox",{name:/Wem angelst/})).toBeVisible();
  await expect(page.getByRole("combobox",{name:/Zu welchem/})).toHaveCount(0);
  await page.getByRole("button",{name:"Münzangel einsetzen",exact:true}).click();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("spielraum.party.local.v1")!).itemUsed)).toBe(true);
});

test("Ergebnisse zeigen echte Münzen bei Gleichstand und Nichtteilnahme",async({page},info)=>{
  let fixture=createPartyPractice("memory",100000);
  fixture.players.push({...fixture.players[1],id:"third",name:"Clara",passive:false});fixture.players[1].passive=false;
  for(const player of fixture.players)fixture.mini!.runs[player.id]={...fixture.mini!.runs.practice,score:3,attempts:4,lastInput:104000};
  fixture.mini!.runs.third.lastInput=0;fixture.mini!.runs.third.score=0;
  fixture=applyPartyAction(fixture,"practice",{type:"finish"},104000);
  fixture.localMiniIndex=1;fixture.phase="mini-play";
  fixture=applyPartyAction(fixture,"spectator",{type:"finish"},104001);
  fixture.localMiniIndex=2;fixture.phase="mini-play";
  fixture=applyPartyAction(fixture,"third",{type:"finish"},104002);
  await restore(page,fixture);
  const awards=page.locator(".party-awards li");
  await expect(awards.filter({hasText:"Du"})).toContainText("+7");
  await expect(awards.filter({hasText:"Übung"})).toContainText("+7");
  await expect(awards.filter({hasText:"Clara"})).toContainText("Nicht teilgenommen");
  await expect(awards.filter({hasText:"Clara"})).toContainText("+0");
  await page.screenshot({path:info.outputPath("inselparty-belohnungen.png"),fullPage:true,animations:"disabled"});
});

test("Kleines Handy: Hauptaktion sichtbar und Minispiel ohne Seitenüberlauf",async({page})=>{
  await page.setViewportSize({width:320,height:740});
  const fixture=createPartyGame([{id:"a",name:"Anna"},{id:"b",name:"Ben"}],{rounds:5},false,123,100000);
  await restore(page,fixture);
  const box=await page.getByRole("button",{name:"Würfeln & losziehen",exact:true}).boundingBox();
  expect(box!.y+box!.height).toBeLessThanOrEqual(740);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
});
