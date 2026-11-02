/** Warten, bis der Browser den neuen Worker vollständig heruntergeladen hat. */
export async function checkPwaUpdate(registration: ServiceWorkerRegistration): Promise<boolean> {
  await registration.update();
  const worker = registration.installing;
  if (!worker) return Boolean(registration.waiting);
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); worker.removeEventListener("statechange", changed); };
    const changed = () => {
      if (worker.state === "installed" || worker.state === "activated") { cleanup(); resolve(); }
      else if (worker.state === "redundant") { cleanup(); reject(new Error("Das Update konnte nicht heruntergeladen werden.")); }
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error("Die Update-Prüfung dauert zu lange. Bitte erneut versuchen.")); }, 30000);
    worker.addEventListener("statechange", changed);
    changed();
  });
  return Boolean(registration.waiting);
}

/** Nur nach explizitem Klick aktivieren. Das Neuladen erfolgt erst nach Übernahme. */
export async function applyPwaUpdate(registration: ServiceWorkerRegistration, container: ServiceWorkerContainer): Promise<void> {
  const waiting = registration.waiting;
  if (!waiting) throw new Error("Kein Update verfügbar. Bitte erneut prüfen.");
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); container.removeEventListener("controllerchange", changed); };
    const changed = () => { cleanup(); resolve(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error("Das Update konnte noch nicht aktiviert werden. Bitte die App vollständig schließen und erneut öffnen.")); }, 15000);
    container.addEventListener("controllerchange", changed);
    try { waiting.postMessage({ type: "SKIP_WAITING" }); }
    catch (error) { cleanup(); reject(error); }
  });
}
