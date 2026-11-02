import assert from "node:assert/strict";
import { applyPwaUpdate, checkPwaUpdate } from "../src/lib/pwaUpdate";

const noUpdate = { update: async () => {}, installing: null, waiting: null } as unknown as ServiceWorkerRegistration;
assert.equal(await checkPwaUpdate(noUpdate), false);
assert.equal(await checkPwaUpdate({ ...noUpdate, waiting: {} } as ServiceWorkerRegistration), true);
await assert.rejects(checkPwaUpdate({ ...noUpdate, update: async () => { throw new Error("offline"); } } as ServiceWorkerRegistration), /offline/);

class Worker extends EventTarget { state = "installing"; }
const worker = new Worker();
const registration = {
  update: async () => {}, installing: worker, waiting: null as unknown
};
const checking = checkPwaUpdate(registration as unknown as ServiceWorkerRegistration);
await Promise.resolve();
registration.waiting = worker;
worker.state = "installed";
worker.dispatchEvent(new Event("statechange"));
assert.equal(await checking, true, "Wartet auf den vollständigen Download");

const broken = new Worker();
const checkingBroken = checkPwaUpdate({ update: async () => {}, installing: broken } as unknown as ServiceWorkerRegistration);
await Promise.resolve(); broken.state = "redundant"; broken.dispatchEvent(new Event("statechange"));
await assert.rejects(checkingBroken, /heruntergeladen/);

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
await assert.rejects(applyPwaUpdate({ waiting: { postMessage: () => { throw new Error("blocked"); } } } as unknown as ServiceWorkerRegistration, container as ServiceWorkerContainer), /blocked/);
console.log("PWA-Update erfolgreich: Download, Aktivierung nur auf Wunsch, Übernahme, Netzwerk- und Workerfehler");
