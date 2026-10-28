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
  assert.match(await page.text(), /<title>Spielraum<\/title>/);
  assert.equal(manifest.status, 200);
  const manifestData = await manifest.json() as { name?: string; icons?: unknown[]; display?: string };
  assert.equal(manifestData.name, "Spielraum");
  assert.equal(manifestData.display, "standalone");
  assert.ok((manifestData.icons?.length ?? 0) >= 3);
  assert.equal(serviceWorker.status, 200);
  assert.match(serviceWorker.headers.get("content-type") ?? "", /javascript/);
  assert.equal(health.status, 200);
  assert.equal((await health.json() as { ok?: boolean }).ok, true);
  console.log(`Produktionsprüfung erfolgreich: HTML, Manifest, Service Worker und Health-Check auf Port ${port}`);
} finally {
  await server.close();
}
