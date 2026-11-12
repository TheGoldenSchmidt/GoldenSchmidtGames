import {CHARACTERS} from "../shared/characters";
import assert from "node:assert/strict";
import { createSpielraumServer } from "../server/index";

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
  for(const response of await Promise.all(worldModules.map(module=>fetch(`${origin}/${module}`)))){
    assert.equal(response.status,200);assert.match(response.headers.get("content-type")??"",/javascript/);assert.ok((await response.text()).length>1000);
  }
  for(const entry of CHARACTERS){
    assert.ok(workerSource.includes(`characters/${entry.id}.png`),`${entry.name}: portrait in offline cache`);
    assert.match(workerSource,new RegExp(`assets/${entry.id}-[A-Za-z0-9_-]+\\.js`),`${entry.name}: model in offline cache`);
    const portrait=await fetch(`${origin}/characters/${entry.id}.png`);assert.equal(portrait.status,200);assert.match(portrait.headers.get("content-type")??"",/image\/png/);
  }
  assert.equal(health.status, 200);
  assert.equal((await health.json() as { ok?: boolean }).ok, true);
  console.log(`Produktionsprüfung erfolgreich: HTML, Manifest, Service Worker, 3D-Module im PWA-Cache und Health-Check auf Port ${port}`);
} finally {
  await server.close();
}
