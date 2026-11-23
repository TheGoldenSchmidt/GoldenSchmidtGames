import assert from "node:assert/strict";
import { mock } from "node:test";
import { applyPwaUpdate, checkPwaUpdate, type PwaUpdateProgress } from "../src/lib/pwaUpdate";

mock.timers.enable({ apis: ["setTimeout"] });
mock.method(console, "warn", () => {});
const healthFetch = mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, _init?: RequestInit) =>
  Response.json({ ok: true }));
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
async function tick(ms: number) {
  await flush();
  mock.timers.tick(ms);
  await flush();
}

const noUpdate = { update: async () => {}, installing: null, waiting: null } as unknown as ServiceWorkerRegistration;
const check = (registration: ServiceWorkerRegistration, onProgress = (_progress: PwaUpdateProgress) => {}) =>
  checkPwaUpdate(async () => registration, onProgress);
assert.equal(await check(noUpdate), false);
assert.equal(await check({ ...noUpdate, waiting: {} } as ServiceWorkerRegistration), true);
assert.equal(healthFetch.mock.callCount(), 0, "Bei Erfolg ist kein Servercheck nötig");

class Worker extends EventTarget { state = "installing"; }
const worker = new Worker();
const registration = {
  update: async () => {}, installing: worker, waiting: null as unknown
};
const checking = check(registration as unknown as ServiceWorkerRegistration);
await Promise.resolve();
registration.waiting = worker;
worker.state = "installed";
worker.dispatchEvent(new Event("statechange"));
assert.equal(await checking, true, "Wartet auf den vollständigen Download");

const broken = new Worker();
const checkingBroken = check({ ...noUpdate, installing: broken } as unknown as ServiceWorkerRegistration);
const downloadFailure = assert.rejects(checkingBroken, /Server ist erreichbar.*Dateien für das Update/);
await Promise.resolve(); broken.state = "redundant"; broken.dispatchEvent(new Event("statechange"));
await tick(1000);
await downloadFailure;
assert.equal(healthFetch.mock.calls[0]?.arguments[0], "/api/health");
assert.equal(healthFetch.mock.calls[0]?.arguments[1]?.cache, "no-store");

let attempts = 0;
const progress: PwaUpdateProgress[] = [];
const scriptFailure = new TypeError("An unknown error occurred when fetching the script.");
const temporaryFailure = { ...noUpdate, update: async () => { if (++attempts === 1) throw scriptFailure; } };
healthFetch.mock.mockImplementationOnce(async () => new Response(null, { status: 503 }));
const retried = check(temporaryFailure, phase => progress.push(phase));
await tick(1000);
assert.equal(attempts, 1, "Während der Server startet, wartet die App mit dem zweiten Versuch");
await tick(2000);
assert.equal(await retried, false, "Das Update kann sich nach einem Skriptfehler erholen");
assert.equal(attempts, 2);
assert.deepEqual(progress, ["checking", "server", "retrying"]);

let registrationAttempts = 0;
const rejectedRegistration = checkPwaUpdate(async () => {
  registrationAttempts++;
  throw scriptFailure;
}, () => {});
const scriptError = assert.rejects(rejectedRegistration, /Server ist erreichbar.*Update-Skript konnte nicht abgerufen werden/);
await tick(1000);
await scriptError;
assert.equal(registrationAttempts, 2, "Auch die Registrierung wird einmal wiederholt");

const stuckUpdate = mock.fn(() => new Promise<ServiceWorkerRegistration>(() => {}));
const timeout = assert.rejects(check({ ...noUpdate, update: stuckUpdate }), /Server ist erreichbar.*zu lange gedauert/);
await tick(20_000);
await tick(1000);
await tick(20_000);
await timeout;
assert.equal(stuckUpdate.mock.callCount(), 2, "Das Zeitlimit gilt auch für den Browser-Aufruf selbst");

const brokenUpdate = { ...noUpdate, update: async () => { throw scriptFailure; } };
let serverSignal: AbortSignal | null | undefined;
healthFetch.mock.mockImplementationOnce(async (_url, options) => {
  serverSignal = options?.signal;
  return new Promise<Response>(() => {});
});
const serverTimeout = assert.rejects(check(brokenUpdate), /Servercheck hat zu lange gedauert.*Update-Skript/);
await tick(60_000);
await serverTimeout;
assert.ok(serverSignal?.aborted, "Beim Server-Timeout wird der HTTP-Abruf abgebrochen");

healthFetch.mock.mockImplementationOnce(async () => { throw new TypeError("Failed to fetch"); });
const serverUnreachable = assert.rejects(check(brokenUpdate), /Server war beim Prüfen nicht erreichbar/);
await tick(1000);
await serverUnreachable;

const container = new EventTarget();
let requested = 0;
const ready = { waiting: { postMessage: (message: unknown) => {
  assert.deepEqual(message, { type: "SKIP_WAITING" }); requested++;
} } } as unknown as ServiceWorkerRegistration;
assert.equal(requested, 0, "Kein automatisches Aktivieren");
let activated = false;
const applying = applyPwaUpdate(ready, container as ServiceWorkerContainer).then(() => { activated = true; });
await Promise.resolve();
assert.equal(requested, 1);
assert.equal(activated, false, "Vor Übernahme darf nicht neu geladen werden");
container.dispatchEvent(new Event("controllerchange")); await applying;
assert.equal(activated, true);
await assert.rejects(applyPwaUpdate(noUpdate, container as ServiceWorkerContainer), /Kein Update/);
await assert.rejects(applyPwaUpdate({ waiting: { postMessage: () => { throw new Error("blocked"); } } } as unknown as ServiceWorkerRegistration, container as ServiceWorkerContainer), /nicht gestartet/);
mock.timers.reset();
mock.restoreAll();
console.log("PWA-Update erfolgreich: Download, Wiederholung, Servercheck, Zeitlimits und manuelle Aktivierung");
