const UPDATE_TIMEOUT_MS = 20_000;
const SERVER_TIMEOUT_MS = 60_000;

export type PwaUpdateProgress = "checking" | "server" | "retrying";

async function withDeadline<T>(ms: number, timeout: Error, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(timeout);
      controller.abort(timeout);
    }, ms);
  });
  try { return await Promise.race([deadline, run(controller.signal)]); }
  finally { clearTimeout(timer); }
}

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function checkServer(): Promise<string> {
  let startupStatus: number | undefined;
  const timeout = new Error("Keine rechtzeitige Serverantwort");
  try {
    return await withDeadline(SERVER_TIMEOUT_MS, timeout, async signal => {
      while (true) {
        signal.throwIfAborted();
        const response = await fetch("/api/health", {
          cache: "no-store", headers: { Accept: "application/json" }, signal
        });
        if ([502, 503, 504].includes(response.status)) {
          // Ein startender Dienst kann schon antworten, bevor der Spielserver bereit ist.
          startupStatus = response.status;
          await wait(3000);
          continue;
        }
        if (response.ok) {
          const health = await response.json().catch(() => null);
          if (health?.ok === true) return "Der Server ist erreichbar.";
        }
        return `Der Server antwortet, aber sein Status ist unklar (HTTP ${response.status}).`;
      }
    });
  } catch (error) {
    if (error === timeout) {
      return startupStatus === undefined
        ? "Der Servercheck hat zu lange gedauert."
        : `Der Server wurde beim Prüfen nicht bereit (zuletzt HTTP ${startupStatus}).`;
    }
    console.warn("App-Update: Servercheck fehlgeschlagen.", error);
    return "Der Server war beim Prüfen nicht erreichbar.";
  }
}

async function loadUpdate(getRegistration: () => Promise<ServiceWorkerRegistration>, signal: AbortSignal): Promise<boolean> {
  let registration: ServiceWorkerRegistration;
  try {
    registration = await getRegistration();
    signal.throwIfAborted();
    if (!registration.waiting && !registration.installing) await registration.update();
  } catch (cause) {
    throw new Error("Das Update-Skript konnte nicht abgerufen werden.", { cause });
  }
  signal.throwIfAborted();
  if (registration.waiting) return true;
  const worker = registration.installing;
  if (!worker) return false;

  await new Promise<void>((resolve, reject) => {
    const changed = () => {
      if (worker.state === "installed" || worker.state === "activated") {
        worker.removeEventListener("statechange", changed);
        resolve();
      } else if (worker.state === "redundant") {
        worker.removeEventListener("statechange", changed);
        reject(new Error("Die Dateien für das Update konnten nicht vollständig geladen werden."));
      }
    };
    worker.addEventListener("statechange", changed, { signal });
    changed();
  });
  return Boolean(registration.waiting);
}

/** Bei einem Fehler den Server prüfen und den Download genau einmal erneut versuchen. */
export async function checkPwaUpdate(
  getRegistration: () => Promise<ServiceWorkerRegistration>,
  onProgress: (progress: PwaUpdateProgress) => void
): Promise<boolean> {
  const attempt = () => withDeadline(UPDATE_TIMEOUT_MS, new Error("Das Laden des Updates hat zu lange gedauert."),
    signal => loadUpdate(getRegistration, signal));
  onProgress("checking");
  try { return await attempt(); }
  catch (error) { console.warn("App-Update: Erster Versuch fehlgeschlagen.", error); }

  onProgress("server");
  const [server] = await Promise.all([checkServer(), wait(1000)]);
  onProgress("retrying");
  try { return await attempt(); }
  catch (cause) {
    const detail = cause instanceof Error ? cause.message : "Das Update konnte nicht geladen werden.";
    throw new Error(`${server} ${detail} Bitte erneut prüfen.`, { cause });
  }
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
    catch (cause) {
      cleanup();
      reject(new Error("Das Update konnte nicht gestartet werden. Bitte erneut prüfen.", { cause }));
    }
  });
}
