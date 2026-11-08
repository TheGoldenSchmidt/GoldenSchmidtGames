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
  assert.match(await page.text(), /<title>GoldenSchmidtGames<\/title>/);
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
  assert.equal(health.status, 200);
  assert.equal((await health.json() as { ok?: boolean }).ok, true);
  console.log(`Produktionsprüfung erfolgreich: HTML, Manifest, Service Worker, 3D-Module im PWA-Cache und Health-Check auf Port ${port}`);
} finally {
  await server.close();
}
