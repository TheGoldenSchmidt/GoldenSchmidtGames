import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
const dir=path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
// Vite serves imported JSON as JS in dev. Remove import attributes only in this
// render harness; the production build already compiles those imports correctly.
const server=await createServer({configFile:false,root:process.cwd(),logLevel:'error',plugins:[{name:'draft-json-imports',enforce:'pre',transform(code,id){if(id.endsWith('/src/figures/catalog.ts'))return code.replaceAll(',{with:{type:"json"}}','');}}],server:{host:'127.0.0.1',port:5196,strictPort:true}});
await server.listen();
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'],...(process.env.PLAYWRIGHT_CHROMIUM_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:{})});
try{
 const page=await browser.newPage({viewport:{width:390,height:700},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
 console.log('Opening scene');
 await page.goto('http://127.0.0.1:5196/docs/design/roll-it-up-entwurf/scene.html');
 await page.waitForFunction(()=>window.__draft?.ready,{},{timeout:30000});
 const projections={};
 for(const [name,view,route,position] of [['world','focus','',8],['outer','focus','outer',8],['shortcut','focus','shortcut',8],['purchase','purchase','',12],['arrival','purchase','',13],['overview','overview','',8]]){
  const result=await page.evaluate(([v,r,p])=>window.__draft.render(v,r,p),[view,route,position]);
  await writeFile(path.join(dir,name+'.webp'),Buffer.from(result.image.split(',')[1],'base64'));projections[name]=result.projection;
  console.log(name,result.triangles+' triangles (static concept render)');
 }
 await writeFile(path.join(dir,'projections.json'),JSON.stringify(projections,null,2)+'\n');
 if(errors.length)throw Error(errors.join('\n'));
}finally{await browser.close();await server.close();}
