import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const dir=path.dirname(fileURLToPath(import.meta.url));
const destination=process.argv[2];
if(!destination||!path.isAbsolute(destination))throw Error('Pass an absolute output HTML path.');
const bytes=async(file,mime)=>`data:${mime};base64,${(await readFile(file)).toString('base64')}`;
const browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:{})});
try{
 const page=await browser.newPage();
 async function image(file,width,quality=.85){const input=await bytes(file,file.endsWith('.png')?'image/png':'image/webp');return page.evaluate(async({input,width,quality})=>{const image=new Image();image.src=input;await image.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=Math.round(width/image.width*image.height);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/webp',quality);},{input,width,quality});}
 let html=await readFile(path.join(dir,'hud.html'),'utf8');
 const values={};
 for(const name of ['world','outer','shortcut','purchase','arrival','overview'])values[name.toUpperCase()]=await image(path.join(dir,name+'.webp'),560);
 for(const [name,id] of [['RICK','alpha_rick_prime'],['MORTY','alpha_morty_smith'],['SUMMER','alpha_summer_smith']])values[name]=await image(path.resolve('public/characters',id+'.png'),70);
 for(const [name,file] of [['GOLD','slab-gold.webp'],['STONE','slab-stone.webp']])values[name]=await bytes(path.resolve('src/assets/home',file),'image/webp');
 values.LEXEND=await bytes(path.resolve('node_modules/@fontsource-variable/lexend/files/lexend-latin-wght-normal.woff2'),'font/woff2');
 values.LILITA=await bytes(path.resolve('node_modules/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2'),'font/woff2');
 values.PROJECTIONS=await readFile(path.join(dir,'projections.json'),'utf8');
 for(const [key,value] of Object.entries(values))html=html.replaceAll('__'+key+'__',value);
 if(/__[A-Z]+__/.test(html))throw Error('Unresolved placeholder');
 if(Buffer.byteLength(html)>1000000)throw Error('Inline preview exceeds 1 MB');
 await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,html);
 console.log('Packed preview:',Buffer.byteLength(html),'bytes');
}finally{await browser.close();}
