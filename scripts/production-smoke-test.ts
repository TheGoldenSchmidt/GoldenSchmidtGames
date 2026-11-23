import {CHARACTERS,isRiggedCharacter} from "../shared/characters";
import assert from "node:assert/strict";
import { createSpielraumServer } from "../server/index";
import { UNITY_BUILD, UNITY_GAMES } from "../src/unityGames";

const server = createSpielraumServer();
const port = await server.listen(0);
const origin = `http://127.0.0.1:${port}`;

try {
  const [page, manifest, serviceWorker, health] = await Promise.all([
    fetch(`${origin}/`),
    fetch(`${origin}/manifest.webmanifest`),
    fetch(`${origin}/sw.js`),
    fetch(`${origin}/api/health`)
  ]);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<title>GoldenSchmidtGames<\/title>/);
  // Messenger lesen das HTML ohne JavaScript und laden das Vorschaubild separat.
  const metadata = Object.fromEntries([...html.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g)].map(([, key, value]) => [key, value]));
  assert.equal(metadata["og:title"], "GoldenSchmidtGames");
  assert.equal(metadata["og:site_name"], "GoldenSchmidtGames");
  const shareImageUrl = new URL(metadata["og:image"]);
  assert.equal(shareImageUrl.protocol, "https:");
  assert.equal(shareImageUrl.origin, new URL(metadata["og:url"]).origin);
  const shareImage = await fetch(`${origin}${shareImageUrl.pathname}`, { headers: { "User-Agent": "WhatsApp/2.0" } });
  assert.equal(shareImage.status, 200);
  assert.match(shareImage.headers.get("content-type") ?? "", /image\/png/);
  const imageData = Buffer.from(await shareImage.arrayBuffer());
  assert.equal(imageData.readUInt32BE(16), Number(metadata["og:image:width"]));
  assert.equal(imageData.readUInt32BE(20), Number(metadata["og:image:height"]));
  assert.ok(imageData.readUInt32BE(16) >= 200, "Das Vorschaubild muss auch als Messenger-Miniatur lesbar sein");
  assert.equal(manifest.status, 200);
  const manifestData = await manifest.json() as { name?: string; short_name?: string; icons?: unknown[]; display?: string };
  assert.equal(manifestData.name, "GoldenSchmidtGames");
  assert.equal(manifestData.short_name, "GSG");
  assert.equal(manifestData.display, "standalone");
  assert.ok((manifestData.icons?.length ?? 0) >= 3);
  assert.equal(serviceWorker.status, 200);
  assert.match(serviceWorker.headers.get("content-type") ?? "", /javascript/);
  const workerSource = await serviceWorker.text();
  assert.match(workerSource, /SKIP_WAITING/, "Manuelle Update-Aktivierung muss im Worker vorhanden sein");
  const worldModules=[...new Set(workerSource.match(/assets\/(?:sceneKit|boardWorld|arenaWorld)-[A-Za-z0-9_-]+\.js/g)??[])];
  assert.equal(worldModules.length,3,"Alle nachgeladenen 3D-Module müssen im PWA-Cache liegen");
  assert.match(workerSource,/assets\/characterPreview-[A-Za-z0-9_-]+\.js/,"Auch die Figuren-Vorschau muss im PWA-Cache liegen");
  for(const file of ["body_m.glb","body_f.glb","anims.glb","hair_long.glb","tex/body_m_light.jpg","tex/outfit_f.png"]){
    assert.ok(workerSource.includes(`models/${file}`),`Figurendatei ${file} muss im PWA-Cache liegen`);
    const response=await fetch(`${origin}/models/${file}`);assert.equal(response.status,200,`${file} wird ausgeliefert`);assert.ok((await response.arrayBuffer()).byteLength>500);
  }
  for(const response of await Promise.all(worldModules.map(module=>fetch(`${origin}/${module}`)))){
    assert.equal(response.status,200);assert.match(response.headers.get("content-type")??"",/javascript/);assert.ok((await response.text()).length>1000);
  }
  for(const entry of CHARACTERS){
    assert.ok(workerSource.includes(`characters/${entry.id}.png`),`${entry.name}: portrait in offline cache`);
    // Classic figures ship one data module each; rigged ones share the files in models/ (checked above).
    if(!isRiggedCharacter(entry.id))assert.match(workerSource,new RegExp(`assets/${entry.id}-[A-Za-z0-9_-]+\\.js`),`${entry.name}: model in offline cache`);
    const portrait=await fetch(`${origin}/characters/${entry.id}.png`);assert.equal(portrait.status,200);assert.match(portrait.headers.get("content-type")??"",/image\/png/);
  }
  assert.equal(health.status, 200);
  assert.equal((await health.json() as { ok?: boolean }).ok, true);

  // The app itself stays strict: no WebAssembly compilation, no blob scripts, no framing.
  const appPolicy = page.headers.get("content-security-policy") ?? "";
  assert.match(appPolicy, /script-src 'self';/);
  assert.match(appPolicy, /frame-ancestors 'none'/);
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  // Unity test games: separate builds, relaxed policy only below /unity/, never in the offline cache.
  assert.ok(!/["']unity\//.test(workerSource), "Unity-Builds gehören nicht in den PWA-Cache");
  assert.match(workerSource, /unity/, "Navigationen nach /unity/ dürfen nicht auf die App umgeleitet werden");
  // One shared Unity build for all Unity games and the Roll It Up! board; ?spiel= picks the game.
  const entry = await fetch(`${origin}${UNITY_BUILD}?spiel=${UNITY_GAMES[0].id}`);
  assert.equal(entry.status, 200, "Unity-Seite wird ausgeliefert");
  const policy = entry.headers.get("content-security-policy") ?? "";
  assert.match(policy, /script-src 'self' blob: 'wasm-unsafe-eval'/, "Unity: WebAssembly erlaubt");
  assert.match(policy, /frame-ancestors 'self'/, "Unity: nur im eigenen App-Rahmen");
  assert.equal(entry.headers.get("x-frame-options"), "SAMEORIGIN");
  const unityHtml = await entry.text();
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(unityHtml), "Unity: kein Inline-Skript (CSP)");
  const files = [...unityHtml.matchAll(/data-(?:loader|data|framework|code)="(Build\/[^"]+)"/g)].map(match => match[1]);
  assert.equal(files.length, 4, "Unity: Loader, Daten, Framework und Code verlinkt");
  const folder = UNITY_BUILD.slice(0, UNITY_BUILD.lastIndexOf("/") + 1);
  for (const file of [...files, "TemplateData/boot.js"]) {
    const response = await fetch(`${origin}${folder}${file}`, { method: "HEAD" });
    assert.equal(response.status, 200, `Unity: ${file} vorhanden`);
    if (file.startsWith("Build/")) assert.match(response.headers.get("cache-control") ?? "", /immutable/, `Unity: ${file} mit Inhalts-Hash dauerhaft cachebar`);
    // gzip files are unpacked by the browser itself; WebAssembly compiles while it streams in.
    if (file.endsWith(".unityweb")) assert.equal(response.headers.get("content-encoding"), "gzip", `Unity: ${file} mit Content-Encoding gzip`);
    if (file.endsWith(".wasm.unityweb")) assert.equal(response.headers.get("content-type"), "application/wasm", `Unity: ${file} als WebAssembly`);
  }
  console.log(`Produktionsprüfung erfolgreich: HTML, Manifest, Service Worker, 3D-Module im PWA-Cache, Unity-Tests und Health-Check auf Port ${port}`);
} finally {
  await server.close();
}
