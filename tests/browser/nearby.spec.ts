import { getGame } from "../../shared/games";
import { selectedLobbyGame, selectLobbyGame } from "./select-lobby-game";
import { selectEntryCharacter } from "./select-entry-character";
import { test, expect, type Page } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import type { SavedRoom } from "../../shared/roomPorts";

async function snapshot(page:Page):Promise<SavedRoom> {
  await expect.poll(()=>page.evaluate(()=>!!localStorage.getItem("spielraum.active-room.v1"))).toBe(true);
  return page.evaluate(async()=>{
    const session=JSON.parse(localStorage.getItem("spielraum.active-room.v1")!);
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{
      const open=indexedDB.open("gsg.table."+session.nearby.table);
      open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
    });
    try{return await new Promise<SavedRoom>((resolve,reject)=>{
      const read=db.transaction("rooms").objectStore("rooms").get(session.code);
      read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);
    });}finally{db.close();}
  });
}

async function enter(page: Page, guest = false) {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");
  await page.getByRole("button",{name:/Online spielen/}).click();
  await page.getByRole("button", {name: guest ? /^Raum beitreten/ : /^Raum erstellen/}).click();
  await selectEntryCharacter(page, "Morty Smith");
  await page.getByRole("radio", {name: guest ? /QR vom Handy-Host/ : /Dieses Handy/}).check();
}

test("Handy-Host startet ohne Internet aus der installierten PWA",async({page,browser})=>{
  const guest=await browser.newPage({viewport:page.viewportSize()!});
  try {
    for(const device of [page,guest]) {
      await device.goto("/");
      await device.evaluate(async()=>{await navigator.serviceWorker.ready;});
      await device.reload();
      await expect.poll(()=>device.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
      // Keep the LAN interface available for ICE. Browser "offline" emulation
      // disables that interface too; a hotspot without Internet does not.
      await device.context().route("**/*",route=>route.abort());
      await device.context().routeWebSocket("**/*",route=>route.close());
      await device.addInitScript(()=>Object.defineProperty(navigator,"onLine",{get:()=>false}));
    }
    await Promise.all([enter(page),enter(guest,true)]);
    await page.getByRole("button",{name:"Neuen Raum erstellen"}).click();
    await pair(page,guest);
    for(const device of [page,guest])await device.getByRole("button",{name:"Ich bin bereit",exact:true}).click();
    for(const device of [page,guest])await expect(device.locator(".qwixx-turn")).toBeVisible();
    await page.getByRole("button",{name:"Würfeln",exact:true}).click();
    await expect(guest.getByRole("button",{name:"Weiße Aktion auslassen",exact:true})).toBeVisible();
  }finally{await guest.close();}
});

test("Fünf Geräte steuern gemeinsam, ein zweiter Tisch bleibt unabhängig",async({page,browser},info)=>{
  test.skip(info.project.name==="desktop","Inselparty ist nur für Smartphones vorgesehen.");
  test.setTimeout(120000);
  const guests=await Promise.all(Array.from({length:4},()=>browser.newPage({viewport:page.viewportSize()!})));
  const other=await browser.newPage({viewport:page.viewportSize()!});
  const devices=[page,...guests];
  try {
    // Six software-rendered scenes share one CI machine. This checks transport
    // and simultaneous inputs, not the physical phones' rendering performance.
    for(const device of [...devices,other])await device.addInitScript(()=>{
      window.requestAnimationFrame=callback=>window.setTimeout(()=>callback(performance.now()),100);
      window.cancelAnimationFrame=id=>clearTimeout(id);
    });
    for(const device of [...devices,other])await enter(device, guests.includes(device));
    for(const host of [page,other])await host.getByRole("button",{name:"Neuen Raum erstellen"}).click();
    await selectLobbyGame(page, "party");
    await expect(page.getByRole("combobox",{name:"Spielerzahl",exact:true})).toBeEnabled();
    await page.getByRole("combobox",{name:"Spielerzahl",exact:true}).selectOption("5");
    await expect(page.getByRole("combobox",{name:"Spielerzahl",exact:true})).toHaveValue("5");
    for(const guest of guests)await pair(page,guest);
    for(const device of devices)await device.getByRole("button",{name:"Ich bin bereit",exact:true}).click();
    for(const device of devices) {
      await expect(device.locator(".party-mini-intro")).toBeVisible();
      await device.getByRole("button",{name:"Ich bin bereit",exact:true}).click();
    }
    for(const device of devices) {
      await expect(device.locator(".party-action-world")).toBeVisible();
      await expect(device.locator(".party-action-countdown")).toHaveCount(0,{timeout:10000});
    }
    const before=(await snapshot(page)).room.partyGame!.mini!.arena!;
    const key=before.id==="crates"?"ArrowRight":"ArrowUp";
    await Promise.all(devices.map(device=>device.keyboard.down(key)));
    await expect.poll(async()=>{
      const after=(await snapshot(page)).room.partyGame!.mini!.arena!;
      return after.actors.every(actor=>{
        const start=before.actors.find(a=>a.id===actor.id)!;
        return Math.hypot(actor.x-start.x,actor.z-start.z)>.1;
      });
    },{timeout:10000}).toBe(true);
    await Promise.all(devices.map(device=>device.keyboard.up(key)));
    for(const device of devices)await expect.poll(async()=>JSON.parse(await device.locator(".party-action-world").getAttribute("data-actors")??"[]").length).toBe(5);
    expect((await snapshot(other)).room.players).toHaveLength(1);
    expect((await snapshot(other)).room.phase).toBe("lobby");
    // A backgrounded host must pause the authoritative clock and notify guests.
    await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));});
    await expect.poll(async()=>!!(await snapshot(page)).room.partyGame!.pausedAt).toBe(true);
    const paused=(await snapshot(page)).room.partyGame!.mini!.arena!.time;
    await expect(guests[0].getByText(/Verbindung wird wiederhergestellt/)).toBeVisible({timeout:20000});
    expect((await snapshot(page)).room.partyGame!.mini!.arena!.time).toBe(paused);
    await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"));});
    await expect.poll(async()=>(await snapshot(page)).room.partyGame!.pausedAt).toBe(0);
    await expect(guests[0].locator(".party-action-world")).toBeVisible({timeout:15000});
  } finally {for(const device of [...guests,other])await device.close();}
});

test("Handy-Speicherfehler bestätigt keine ungespeicherte Raumänderung",async({page})=>{
  await enter(page);
  await page.getByRole("button",{name:"Neuen Raum erstellen"}).click();
  const before=await snapshot(page);
  await page.evaluate(async()=>{
    const session=JSON.parse(localStorage.getItem("spielraum.active-room.v1")!);
    await new Promise<void>((resolve,reject)=>{
      const open=indexedDB.open("gsg.table."+session.nearby.table);
      open.onsuccess=()=>{
        const db=open.result,tx=db.transaction("meta","readwrite");
        tx.objectStore("meta").put("storage-fault","owner");
        tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);
      };open.onerror=()=>reject(open.error);
    });
  });
  await selectLobbyGame(page, "durak");
  await expect.poll(async()=>(await snapshot(page)).room.config.gameId).toBe(before.room.config.gameId);
  await expect(selectedLobbyGame(page)).toHaveText(getGame(before.room.config.gameId).name);
  await page.reload();
  await expect(selectedLobbyGame(page)).toHaveText(getGame(before.room.config.gameId).name);
});

async function readQR(page:Page) {
  const canvas=page.getByLabel("Verbindungs-QR-Code");
  const parts:string[]=[];
  do {
    let qr:string|undefined;
    await expect.poll(async()=>{
      const img=PNG.sync.read(await canvas.screenshot());
      qr=jsQR(new Uint8ClampedArray(img.data),img.width,img.height)?.data;
      return !!qr && (qr.startsWith("GSG1.") || Number(qr.split("|")[2])===parts.filter(Boolean).length);
    }).toBe(true);
    if(qr!.startsWith("GSG1.")) return qr!;
    const [, ,part,count,chunk]=qr!.split("|");
    parts[Number(part)]=chunk;
    if(parts.filter(Boolean).length===Number(count))return parts.join("");
    await page.getByRole("button",{name:/Teil .*Weiter/}).click();
    await expect(page.getByRole("button",{name:new RegExp("Teil "+(Number(part)+2)+" von")})).toBeVisible();
  } while(parts.length<24);
  throw new Error("Unvollständiger QR-Code");
}

async function submit(page:Page,value:string) {
  await page.getByText("Textcode eingeben",{exact:true}).click();
  await page.getByLabel("Erhaltenen Verbindungscode einfügen").fill(value);
  await page.getByRole("button",{name:"Code übernehmen"}).click();
}
async function pair(host:Page, guest:Page) {
  await host.getByRole("button",{name:"Gerät verbinden"}).click();
  await submit(guest,await readQR(host));
  await submit(host,await readQR(guest));
  await expect(host.getByRole("dialog")).toHaveCount(0);
}

test("QR-Beitritt behält bei verweigerter Kamera die Textcode-Eingabe",async({page})=>{
  await page.addInitScript(()=>{
    navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException("denied","NotAllowedError");};
  });
  await enter(page,true);
  await page.getByRole("button",{name:"Einladung scannen",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("Kamera nicht verfügbar");
  await submit(page,"kein-gueltiger-code");
  await expect(page.getByRole("alert")).toContainText("Kein gültiger Tisch-Code");
  await expect(page.getByRole("button",{name:"Einladung scannen"})).toBeEnabled();
});

test("Handy-Host setzt seinen Tisch fort und entfernt geschlossene Partien",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:/Lokal spielen/}).click();
  await page.getByRole("button",{name:/^Inselparty 1–5 Bots/}).click();
  await page.getByLabel("Deine Spielfigur").selectOption({label:"Morty Smith"});
  await page.getByLabel("Bot-Mitspieler").selectOption("1");
  await page.getByRole("button",{name:"Testpartie mit Bots erstellen"}).click();
  await page.getByRole("button",{name:"Ich bin bereit",exact:true}).click();
  await expect(page.locator(".party-mini-intro")).toBeVisible();
  await expect(page.getByRole("button",{name:"Gerät verbinden"})).toHaveCount(0);
  await page.getByRole("button",{name:"Verlassen",exact:true}).click();
  await page.getByRole("button",{name:"Handy-Tisch fortsetzen",exact:true}).click();
  await expect(page.locator(".party-mini-intro")).toBeVisible();
  await page.getByRole("button",{name:"Spielmenü öffnen",exact:true}).click();
  await page.getByRole("button",{name:"Partie für alle beenden",exact:true}).click();
  await page.getByRole("button",{name:"Zum Startmenü",exact:true}).click();
  await expect(page.getByRole("button",{name:"Handy-Tisch fortsetzen",exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem("spielraum.last-host.v1"))).toBeNull();
});

for(const [game,marker] of [["qwixx",".qwixx-turn"],["kribbeln",".kribbel-score-strip"],["durak",".durak-players"],["party",".party-mini-intro"],["roll-it-up",".roll-it-up .party-mini-intro"],["free-minigame",".party-mini-intro"],["goldenschmidt",".minigame-betting"]]) {
  test(`Handy-Tisch spielt ${game} per direktem Datenkanal`,async({page,browser},info)=>{
    test.skip(!["qwixx","kribbeln","durak"].includes(game)&&info.project.name==="desktop","Party und Minispiele sind nur für Smartphones vorgesehen.");
    test.setTimeout(120000);
    const guest=await browser.newPage({viewport:page.viewportSize()!});
    try{
      await Promise.all([enter(page),enter(guest,true)]);
      await page.getByRole("button",{name:"Neuen Raum erstellen"}).click();
      await selectLobbyGame(page, game);
      await pair(page,guest);
      for(const device of [guest,page])await device.getByRole("button",{name:"Ich bin bereit",exact:true}).click();
      for(const device of [page,guest])await expect(device.locator(marker)).toBeVisible();
      if(game==="goldenschmidt") {
        await page.getByRole("button",{name:"5 Punkte setzen",exact:true}).click();
        await page.getByRole("button",{name:"Einsatz festlegen · 5",exact:true}).click();
        await expect(page.getByRole("status").filter({hasText:/Dein Einsatz/})).toContainText("5 Punkte");
        await expect(guest.getByRole("button",{name:"5 Punkte setzen",exact:true})).toBeEnabled();
      }
      if(game==="qwixx"){
        await page.getByRole("button",{name:"Würfeln",exact:true}).click();
        const white=guest.getByRole("button",{name:"Weiße Aktion auslassen",exact:true});
        await expect(white).toBeVisible();
        const sum=await guest.locator(".qwixx-white-sum strong").innerText();
        await page.reload();await guest.reload();
        await expect(page.locator(marker)).toBeVisible();
        await pair(page,guest);
        await expect(white).toBeVisible();
        await expect(guest.locator(".qwixx-white-sum strong")).toHaveText(sum);
        await white.click();
      } else {
        await page.reload();await guest.reload();
        await pair(page,guest);
        for(const device of [page,guest])await expect(device.locator(marker)).toBeVisible();
        if(game==="goldenschmidt") {
          await expect(page.getByRole("status").filter({hasText:/Dein Einsatz/})).toContainText("5 Punkte");
          await guest.getByRole("button",{name:"2 Punkte setzen",exact:true}).click();
          await guest.getByRole("button",{name:"Einsatz festlegen · 2",exact:true}).click();
          for(const device of [page,guest])await expect(device.locator(".party-mini-intro")).toBeVisible();
        }
      }
    } finally {await guest.close();}
  });
}
