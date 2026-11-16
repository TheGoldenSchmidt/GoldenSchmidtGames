import {test,expect,type Locator,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {onlineSession} from './party-session';

async function expectInsideViewport(page:Page,locator:Locator) {
  await expect(locator).toBeVisible();
  const box=await locator.boundingBox(),viewport=page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width+1);
  expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height+1);
}

for(const motion of ['no-preference','reduce'] as const) {
  test(`HUD: Zugstatus und Würfeln bleiben gemeinsam erreichbar (${motion})`,async({page},info)=>{
    await page.emulateMedia({reducedMotion:motion});
    const session=await onlineSession(page,true);
    try {
      await expect(page.locator('.party-world')).toHaveAttribute('data-webgl','ready');
      const sizes=info.project.name==='phone'?[{width:390,height:844},{width:320,height:740}]:[{width:1280,height:900}];
      for(const size of sizes){
        await page.setViewportSize(size);
        const status=page.locator('.party-roll-status');
        const roll=page.getByRole('button',{name:'Würfeln & losziehen',exact:true});
        await expectInsideViewport(page,status);await expectInsideViewport(page,roll);
        const a=(await status.boundingBox())!,b=(await roll.boundingBox())!;
        expect(a.y+a.height).toBeLessThanOrEqual(b.y);
        // Scrolling secondary content must not hide the phone's turn status.
        await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
        if(size.width<900){await expectInsideViewport(page,status);await expectInsideViewport(page,roll);}
        await page.evaluate(()=>scrollTo(0,0));
      }
      await page.screenshot({path:info.outputPath('board-hud.png'),fullPage:false});
      const roll=page.getByRole('button',{name:'Würfeln & losziehen',exact:true});
      await roll.focus();await page.keyboard.press('Enter');
      await expect.poll(async()=>(await session.state()).partyGame!.dice.length).toBeGreaterThan(0);
    }finally{session.close();}
  });

  test(`HUD: Steuerknöpfe passen im laufenden Querformat (${motion})`,async({page},info)=>{
    await page.emulateMedia({reducedMotion:motion});
    await page.addInitScript(profile=>localStorage.setItem('spielraum.profile.v1',JSON.stringify(profile)),{id:randomUUID(),username:'Anna'});
    await page.goto('/');await page.getByRole("button", {name: /Lokal spielen/}).click();
    await page.getByRole("button", {name: /^Minispiele testen/}).click();
    await expect(page.getByRole("button", {name: "Testpartie mit Bots erstellen"})).toBeDisabled();
    await expect(page.getByLabel("Deine Spielfigur").locator("option")).toHaveCount(14);
    await page.getByLabel("Deine Spielfigur").selectOption({label: "Prime Rick"});
    await page.getByLabel("Testspiel").selectOption("party");
    await page.getByLabel('Bot-Mitspieler').selectOption('2');
    await page.getByRole('button',{name:'Testpartie mit Bots erstellen'}).click();
    await page.getByRole('button',{name:'Ich bin bereit',exact:true}).click();
    const intro=page.getByRole('button',{name:'Intro überspringen'});
    if(await intro.count())await intro.click();
    await expect(page.locator('.party-mini-intro')).toBeVisible();
    for(const mini of ['crates','balance']) {
      await page.locator('.party-test-tools>summary').click();
      await page.getByLabel('Minispiel auswählen').selectOption(mini);
      await page.getByRole('button',{name:'Minispiel starten',exact:true}).click();
      await page.getByRole('button',{name:'Ich bin bereit',exact:true}).click();
      await expect(page.locator('.party-action-world')).toHaveAttribute('data-webgl','ready');
      for(const size of [{width:844,height:390},{width:740,height:360},{width:1024,height:560}]){
        await page.setViewportSize(size);
        await expectInsideViewport(page,page.getByRole('group',{name:'Bewegungsstick'}));
        for(const button of await page.locator('.party-action-buttons button').all())await expectInsideViewport(page,button);
        if(mini==='balance')await expectInsideViewport(page,page.getByRole('button',{name:'Neigung aktivieren',exact:true}));
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(size.width);
        await page.screenshot({path:info.outputPath(`${mini}-${size.width}.png`),fullPage:false});
      }
      if(mini==='crates'){
        await expect(page.locator('.party-action-countdown')).toHaveCount(0,{timeout:10000});
        const viewer=await page.evaluate(()=>JSON.parse(localStorage.getItem('spielraum.profile.v1')!).id as string);
        const read=()=>page.locator('.party-action-world').getAttribute('data-actors').then(v=>JSON.parse(v??'[]').find((a:{id:string})=>a.id===viewer));
        const before=(await read()).punchAt;
        const punch=page.getByRole('button',{name:'Schlagen',exact:true});
        if(info.project.name==='phone'){
          // Bots can stun the player; retry separate presses so the rising-edge
          // action can occur after the existing gameplay lock has expired.
          await expect.poll(async()=>{await punch.tap();return (await read()).punchAt;},{timeout:8000,intervals:[200]}).toBeGreaterThan(before);
        }else {
          await punch.focus();await page.keyboard.press('Enter');
          await expect.poll(async()=>(await read()).punchAt).toBeGreaterThan(before);
        }
      }
    }
  });
}
