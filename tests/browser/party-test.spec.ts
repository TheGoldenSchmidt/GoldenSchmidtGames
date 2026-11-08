import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("Solo-Test: eigene JSON-Figur wählen, drehen und mit echten Bots spielen",async({page},info)=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(profile=>localStorage.setItem("spielraum.profile.v1",JSON.stringify(profile)),{id:randomUUID(),username:"Anna"});
  await page.goto("/");await page.getByRole("button",{name:/Online spielen/}).click();
  await page.getByText("Inselparty alleine testen",{exact:true}).click();
  await page.getByLabel("Bot-Mitspieler").selectOption("2");
  await page.getByRole("button",{name:"Testpartie mit Bots erstellen"}).click();
  await expect(page.getByText("Deine Testpartie",{exact:true})).toBeVisible();
  const preview=page.getByRole("img",{name:/3D-Vorschau/});
  await expect(preview).toHaveAttribute("data-webgl","ready");
  for(const name of ["Morty","Cartman","Rekrut","Kenny"]){
    await page.getByRole("button",{name:new RegExp(`^${name}`)}).click();
    await expect(page.getByRole("button",{name:new RegExp(`^${name}`)})).toHaveAttribute("aria-pressed","true");
    await expect(preview).toHaveAttribute("aria-label",`3D-Vorschau: ${name}`);
    await expect(preview).toHaveAttribute("data-webgl","ready");
  }
  await expect(preview).toHaveAttribute("data-character","kenny_mccormick");
  for(let i=0;i<4;i++)await page.getByRole("button",{name:"Figur drehen"}).click();
  await page.screenshot({path:info.outputPath("figurenwahl.png"),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole("button",{name:"Ich bin bereit",exact:true}).click();
  const intro=page.getByRole("button",{name:"Intro überspringen"});if(await intro.count())await intro.click();
  await expect(page.locator(".party-world")).toHaveAttribute("data-webgl","ready");
  await expect(page.getByText("Testpartie mit Bots",{exact:false}).first()).toBeVisible();
  await page.locator(".party-test-tools>summary").click();
  await page.getByLabel("Minispiel auswählen").selectOption("crates");
  await page.getByRole("button",{name:"Minispiel starten",exact:true}).click();
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
