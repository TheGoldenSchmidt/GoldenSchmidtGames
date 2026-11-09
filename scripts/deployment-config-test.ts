import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { deploymentDatabase } from "../server/roomStore";

const keys = ["RENDER", "GSG_DATABASE_FILE", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"] as const;
const original = keys.map(key => [key, process.env[key]] as const);
const cwd = process.cwd();
const directory = await mkdtemp(path.join(tmpdir(), "gsg-config-"));

function configure(env: Partial<Record<typeof keys[number], string>>) {
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, env);
  return deploymentDatabase();
}

try {
  process.chdir(directory);
  const local = { url: "file:.gsg-data/rooms.db" };
  assert.deepEqual(configure({}), local);
  assert.deepEqual(configure({ RENDER: "true" }), local, "Render startet auch ohne Turso mit lokalem Speicher");
  assert.deepEqual(configure({ RENDER: "true", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "" }), local);
  assert.deepEqual(configure({ RENDER: "true", GSG_DATABASE_FILE: "custom.db" }), { url: "file:custom.db" });

  for (const render of ["", "true"]) {
    const url = "libsql://test-db.example.invalid";
    const cloud = configure({ RENDER: render, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "test-token" });
    assert.equal(cloud.url, url);
    assert.equal(cloud.authToken, "test-token");
    assert.equal(typeof cloud.fetch, "function");
    assert.throws(() => configure({ RENDER: render, TURSO_DATABASE_URL: url }), /sowohl/);
    assert.throws(() => configure({ RENDER: render, TURSO_AUTH_TOKEN: "test-token" }), /sowohl/);
    assert.throws(() => configure({ RENDER: render, TURSO_DATABASE_URL: "file:other.db", TURSO_AUTH_TOKEN: "test-token" }), /sowohl/);
    assert.throws(() => configure({ RENDER: render, TURSO_DATABASE_URL: url + "?tls=0", TURSO_AUTH_TOKEN: "test-token" }), /TLS/);
  }
  console.log("Deployment-Konfiguration: Render ohne Turso, lokale Datei, optionale Cloud und Ablehnung unvollständiger/unsicherer Zugangsdaten geprüft.");
} finally {
  process.chdir(cwd);
  for (const [key, value] of original) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  assert.equal(path.dirname(directory), path.resolve(tmpdir()));
  assert.ok(path.basename(directory).startsWith("gsg-config-"));
  await rm(directory, { recursive: true, force: true });
}
