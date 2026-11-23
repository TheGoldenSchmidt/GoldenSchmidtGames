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

// Live-Version im Startmenü: PR-Nummer aus dem Commit-Titel auf main.
{
  const { pullRequestFromSubject, resolveBuildVersion } = await import("../server/version");
  assert.equal(pullRequestFromSubject("Unity: Rückmeldung zu Tower Tumble (#48)"), 48);
  assert.equal(pullRequestFromSubject("Merge pull request #12 from someone/branch"), 12);
  assert.equal(pullRequestFromSubject("Würfel (#3) neu sortiert"), undefined);
  assert.equal(pullRequestFromSubject(""), undefined);
  const realFetch = globalThis.fetch;
  try {
    let requested = "";
    globalThis.fetch = (async (url: string | URL | Request) => {
      requested = String(url);
      return new Response(JSON.stringify({ commit: { message: "Startmenü zeigt Version (#49)\n\nDetails (#1)" } }));
    }) as typeof fetch;
    const sha = "0123456789abcdef0123456789abcdef01234567";
    assert.deepEqual(await resolveBuildVersion({ RENDER_GIT_COMMIT: sha, RENDER_GIT_REPO_SLUG: "owner/repo" }), { pr: 49, commit: "0123456" });
    assert.equal(requested, `https://api.github.com/repos/owner/repo/commits/${sha}`);
    globalThis.fetch = (async () => new Response("", { status: 403 })) as typeof fetch;
    assert.deepEqual(await resolveBuildVersion({ RENDER_GIT_COMMIT: sha }), { commit: "0123456" }, "Ohne GitHub-Antwort bleibt der kurze Commit");
    globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
    assert.deepEqual(await resolveBuildVersion({ RENDER_GIT_COMMIT: sha }), { commit: "0123456" });
  } finally { globalThis.fetch = realFetch; }
}
