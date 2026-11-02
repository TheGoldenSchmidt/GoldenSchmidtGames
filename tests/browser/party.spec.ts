import { test,expect } from "@playwright/test";
import { COLORS, createPartyPractice, MINI_IDS, SYMBOLS } from "../../shared/party";

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
  await page.screenshot({path:testInfo.outputPath("inselparty-board.png"),fullPage:true});
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
    else if(phase==="mini-play"){await page.clock.fastForward(4000);await page.getByRole("button",{name:"Versuch beenden",exact:true}).click();}
    else if(phase==="mini-result")await page.getByRole("button",{name:/Weiter zur Insel|Zur Siegerehrung/}).click();
    else throw new Error(`Unerwartete Phase: ${phase}`);
    await page.clock.runFor(110);
  }
  await expect(page.getByRole("heading",{name:"Die Insel feiert euch!"})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath("inselparty-finale.png"),fullPage:true});
  expect(errors).toEqual([]);
});

test("Minispiel-Übung: Countdown, Touch-/Maus-Eingaben und reduzierte Bewegung",async({page})=>{
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
  await page.getByRole("button",{name:"Erst kurz üben",exact:true}).click();
  await expect(page.getByText("Übung · zählt nicht zur Wertung",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Zurück zur Minispielrunde",exact:true}).click();
  await expect(page.getByRole("button",{name:"Ich bin bereit",exact:true})).toBeVisible();
});

for(const mini of MINI_IDS)test(`Minispiel ${mini}: echte Eingabe verändert die Wertung`,async({page},info)=>{
  const fixture=createPartyPractice(mini,100000);
  await page.clock.install({time:new Date(100000)});
  await page.addInitScript(value=>localStorage.setItem("spielraum.party.local.v1",JSON.stringify(value)),fixture);
  await page.goto("/");await page.getByRole("button",{name:"Lokale Inselparty fortsetzen",exact:true}).click();
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
  await page.screenshot({path:info.outputPath(`minispiel-${mini}.png`),fullPage:true});
});
