import { selectEntryCharacter } from "./select-entry-character";
import { test, expect } from "@playwright/test";
import { CHARACTERS } from "../../shared/characters";
import { randomUUID } from "node:crypto";

test("Solo-Test: eigene JSON-Figur wählen, drehen und mit echten Bots spielen",async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(profile=>localStorage.setItem("spielraum.profile.v1",JSON.stringify(profile)),{id:randomUUID(),username:"Anna"});
  await page.goto("/");await page.getByRole("button", {name: /Lokal spielen/}).click();
    await page.getByRole("button", {name: /^Inselparty 1–5 Bots/}).click();
    await expect(page.getByRole("button", {name: "Testpartie mit Bots erstellen"})).toBeDisabled();
    await expect(page.getByLabel("Deine Spielfigur").locator("option")).toHaveCount(CHARACTERS.length + 1);
    await page.getByLabel("Deine Spielfigur").selectOption({label: "Prime Rick"});
    await page.getByLabel("Bot-Mitspieler").selectOption("2");
  await page.getByRole("button",{name:"Testpartie mit Bots erstellen"}).click();
  await expect(page.getByText("Deine Testpartie",{exact:true})).toBeVisible();
  await page.locator(".room summary").filter({hasText:"Deine Spielfigur"}).click();
  const preview=page.getByRole("img",{name:/3D-Vorschau/});
  await expect(preview).toHaveAttribute("data-webgl","ready");
  for(const name of ["Morty Smith","Mr Nimbus","Pupa","Eric Cartman"]){
    await selectEntryCharacter(page,name);
    await expect(page.locator(".room summary").filter({hasText:"Deine Spielfigur"})).toContainText(name);
    await page.locator(".room summary").filter({hasText:"Deine Spielfigur"}).click();
    await expect(preview).toHaveAttribute("aria-label",`3D-Vorschau: ${name}`);
    await expect(preview).toHaveAttribute("data-webgl","ready");
  }
  await expect(preview).toHaveAttribute("data-character","alpha_eric_cartman");
  for(let i=0;i<4;i++)await page.getByRole("button",{name:"Figur drehen"}).click();
  await page.screenshot({path:info.outputPath("figurenwahl.png"),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator(".room summary").filter({hasText:"Deine Spielfigur"}).click();
  await page.getByRole("button",{name:"Ich bin bereit",exact:true}).click();
  const intro=page.getByRole("button",{name:"Intro überspringen"});if(await intro.count())await intro.click();
  await expect(page.locator(".party-mini-intro")).toBeVisible();
  await expect(page.getByText("Testpartie mit Bots",{exact:false}).first()).toBeVisible();
  await page.locator(".party-test-tools>summary").click();
  await page.getByLabel("Minispiel auswählen").selectOption("crates");
  await page.getByRole("button",{name:"Minispiel starten",exact:true}).click();
  await expect(page.locator(".party-test-tools")).not.toHaveAttribute("open","",{timeout:20000});
  await expect(page.getByRole("heading",{name:"Kistenkrawall",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Ich bin bereit",exact:true}).click();
  const arena=page.locator(".party-action-world");
  await expect(arena).toHaveAttribute("data-webgl","ready");
  await expect.poll(async()=>JSON.parse(await arena.getAttribute("data-actors")??"[]").some((a:{x:number;z:number})=>Math.abs(a.z-3.8)>.15),{timeout:10000}).toBe(true);
  await page.screenshot({path:info.outputPath("bots-in-arena.png"),fullPage:true});
  await page.locator(".party-test-tools>summary").click();await page.getByRole("button",{name:"Minispiel wiederholen"}).click();
  await expect(page.getByRole("heading",{name:"Kistenkrawall",exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test("Lokal spielen: Partymodi allein mit Bots, auch ohne Internet",async({page,context},info)=>{
  test.setTimeout(150000);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(profile=>localStorage.setItem("spielraum.profile.v1",JSON.stringify(profile)),{id:randomUUID(),username:"Anna"});
  await page.goto("/");
  // The installed PWA serves everything from its cache once it has been loaded.
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller)),{timeout:30000}).toBe(true);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await context.setOffline(true);
  await page.getByRole("button",{name:/Lokal spielen/}).click();
  await expect(page.getByRole("heading",{name:"Allein mit Bots"})).toBeVisible();
  for(const name of ["Roll It Up!","Inselparty","Freies Minispiel","Schlag den GoldenSchmidt"]){
    await page.getByRole("button",{name:new RegExp(`^${name.replace("!","\\!")} 1–5 Bots`)}).click();
    await expect(page.getByRole("heading",{name,exact:true})).toBeVisible();
    await expect(page.getByText("auch ohne Internet")).toBeVisible();
    await page.getByRole("button",{name:"Zurück"}).click();
  }
  await page.screenshot({path:info.outputPath("lokal-spielen.png"),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole("button",{name:/^Inselparty 1–5 Bots/}).click();
  await page.getByLabel("Deine Spielfigur").selectOption({label:"Prime Rick"});
  await page.getByLabel("Bot-Mitspieler").selectOption("1");
  await page.getByRole("button",{name:"Testpartie mit Bots erstellen"}).click();
  await expect(page.getByText("Deine Testpartie",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Ich bin bereit",exact:true}).click();
  const intro=page.getByRole("button",{name:"Intro überspringen"});if(await intro.count())await intro.click();
  // Opening minigame, then onto the board: all without a network connection.
  await page.locator(".party-mini-intro").getByRole("button",{name:"Ich bin bereit",exact:true}).click();
  const attempt=page.locator(".party-end-attempt summary");
  await expect(attempt).toBeVisible();
  await expect(page.locator(".match-countdown, .party-action-countdown")).toHaveCount(0,{timeout:10000});
  await attempt.click();await page.locator(".party-end-attempt button").click();
  const onward=page.getByRole("button",{name:"Ab auf die Insel",exact:true});
  await expect.poll(async()=>await onward.isVisible()||await page.locator("[data-board-phase]").count()>0,{timeout:70000}).toBe(true);
  if(await onward.isVisible())await onward.click();
  await expect(page.locator("[data-board-phase]")).toBeVisible({timeout:20000});
  await expect(page.getByRole("region",{name:"Inselkarte"})).toBeVisible();
  await page.screenshot({path:info.outputPath("inselparty-offline.png")});
  expect(errors).toEqual([]);
});

