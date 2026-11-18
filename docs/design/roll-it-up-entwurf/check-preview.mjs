// Interaction and layout checks for the draft only, not a live-game test suite.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const preview=process.argv[2];if(!preview)throw Error('Pass the rendered preview HTML.');
const dir=path.dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:{})});
try{
 for(const [width,reduced] of [[390,false],[320,true]]){
  const page=await browser.newPage({viewport:{width,height:880},isMobile:true,hasTouch:true,reducedMotion:reduced?'reduce':'no-preference'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve(preview)).href);await page.locator('body').evaluate(el=>el.style.padding='0');
  const frame=page.frameLocator('iframe');
  await frame.locator('#ri-count').waitFor();
  await frame.locator('#roll-draft').evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
  const tap=action=>frame.locator(`[data-do="${action}"]`).first().tap();
  const value=selector=>frame.locator(selector).textContent();
  const shot=name=>frame.locator('.ri-stage').screenshot({path:path.join(dir,`preview-${width}-${name}.png`)});
  await shot('turn');
  await tap('set');assert.equal(await frame.locator('.ri-collection li').count(),6);await tap('close');
  assert.equal(await frame.locator('[data-do="set"]').evaluate(e=>e===document.activeElement),true);
  await tap('view');assert.equal(await frame.locator('.ri-marker').count(),7);await shot('overview');await tap('view');
  await tap('roll');assert.match(await value('#ri-dock'),/Noch 4 Schritte/);await shot('path');
  await tap('shortcut');assert.equal(await frame.locator('[data-do="shortcut"]').getAttribute('aria-pressed'),'true');
  await tap('travel');assert.match(await value('#ri-dock'),/15 Münzen/);await shot('purchase');
  await tap('buy');assert.equal(await value('#ri-money'),'12');assert.equal(await value('#ri-count'),'4 / 6');
  await tap('restart');await tap('roll');await tap('travel');await tap('buy');
  assert.equal(await value('#ri-money'),'15');assert.equal(await value('#ri-count'),'4 / 6');
  assert.match(await value('#ri-dock'),/Ein Geschenk für dich/);await tap('take-gift');await tap('end');assert.match(await value('#ri-dock'),/Ben ist am Zug/);
  await tap('restart');await tap('roll');await tap('travel');await tap('skip');assert.equal(await value('#ri-money'),'18');assert.equal(await value('#ri-count'),'3 / 6');
  await tap('restart');
  await frame.locator('#roll-draft').evaluate(()=>window.dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:{widgetState:{privateContent:{state:{phase:'turn'},options:{name:'AlexandertheGoldenSchmidt',guided:true}}}}}})));
  assert.match(await value('#ri-dock'),/AlexandertheGoldenSchmidt/);await shot('long-name');
  const layout=await frame.locator('#roll-draft').evaluate(root=>({overflow:document.documentElement.scrollWidth>window.innerWidth,smallTargets:[...root.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).filter(e=>e.getBoundingClientRect().width<44||e.getBoundingClientRect().height<44).map(e=>e.textContent),stageOverflow:root.querySelector('.ri-stage').scrollWidth>root.querySelector('.ri-stage').clientWidth}));
  assert.deepEqual(layout,{overflow:false,smallTargets:[],stageOverflow:false});assert.deepEqual(errors,[]);
  console.log(`${width}px touch, reduced motion ${reduced}: paths, buy/skip, gift, collection, focus, long name, target sizes and overflow passed`);
  await page.close();
 }
}finally{await browser.close();}
