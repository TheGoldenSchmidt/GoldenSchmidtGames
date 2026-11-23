import { useEffect, useRef, useState } from "react";
import { applyPwaUpdate, checkPwaUpdate, type PwaUpdateProgress } from "../lib/pwaUpdate";

type Status = "idle" | "checking" | "ready" | "applying" | "current" | "error" | "unsupported";
const progressMessage: Record<PwaUpdateProgress, string> = {
  checking: "Die App sucht nach einer neuen Version …",
  server: "Die App prüft, ob der Spielserver antwortet …",
  retrying: "Die App versucht das Update erneut …"
};

export function AppUpdate() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState(false);
  const registration = useRef<Promise<ServiceWorkerRegistration> | undefined>(undefined);

  // The note floats above the tool row without taking layout space.
  useEffect(() => {
    if (status === "checking") { setNote(true); return; }
    if (!["ready", "current", "error"].includes(status)) { setNote(false); return; }
    setNote(true);
    const timer = setTimeout(() => setNote(false), status === "error" ? 12000 : 5000);
    return () => clearTimeout(timer);
  }, [status, message]);

  function getRegistration() {
    if (!registration.current) {
      registration.current = navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(error => {
        registration.current = undefined;
        throw error;
      });
    }
    return registration.current;
  }

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) { setStatus("unsupported"); return; }
    let active = true;
    let cleanup = () => {};
    getRegistration().then(reg => {
      if (!active) return;
      let worker: ServiceWorker | null;
      const inspect = () => {
        if (reg.active && reg.waiting) {
          setStatus(current => current === "checking" || current === "applying" ? current : "ready");
        }
      };
      const found = () => {
        worker?.removeEventListener("statechange", inspect);
        worker = reg.installing;
        worker?.addEventListener("statechange", inspect);
      };
      reg.addEventListener("updatefound", found);
      cleanup = () => { reg.removeEventListener("updatefound", found); worker?.removeEventListener("statechange", inspect); };
      found(); inspect();
    }).catch(error => {
      if (active) console.warn("App-Update: Initialisierung fehlgeschlagen.", error);
    });
    return () => { active = false; cleanup(); };
  }, []);

  async function check() {
    if (!navigator.onLine) { setStatus("error"); setMessage("Zum Prüfen auf Updates ist eine Internetverbindung nötig."); return; }
    setStatus("checking");
    try {
      const ready = await checkPwaUpdate(getRegistration, progress => setMessage(progressMessage[progress]));
      setStatus(ready ? "ready" : "current");
    } catch (error) {
      console.warn("App-Update: Wiederholung fehlgeschlagen.", error);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Die Update-Prüfung ist fehlgeschlagen. Bitte erneut prüfen.");
    }
  }

  async function apply() {
    setStatus("applying"); setMessage("");
    try { await applyPwaUpdate(await getRegistration(), navigator.serviceWorker); window.location.reload(); }
    catch (error) {
      console.warn("App-Update: Aktivierung fehlgeschlagen.", error);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Das Update konnte nicht gestartet werden. Bitte erneut prüfen.");
    }
  }

  return <aside className="app-update" aria-label="App aktualisieren" data-status={status} data-note={note}>
    <button className="dock-tool" onClick={status === "ready" ? apply : check} disabled={["checking", "applying", "unsupported"].includes(status)}>
      <span className="dock-tool__contents">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19.5 11a7.6 7.6 0 0 0-13.6-3.6M5.4 3.6v4.2h4.2M4.5 13a7.6 7.6 0 0 0 13.6 3.6M18.6 20.4v-4.2h-4.2" /></svg>
        <span>{status === "ready" ? "Neue Version laden" : status === "checking" ? "Suche nach Updates …" : status === "applying" ? "Update wird geladen …" : "Updates prüfen"}</span>
      </span>
    </button>
    <p role="status">{status === "ready" ? "Eine neue Version ist bereit. Beim Aktualisieren wird die App neu gestartet." : status === "current" ? "Diese Ansicht ist aktuell. Die Update-Prüfung installiert keine App." : status === "unsupported" ? "Updates sind in dieser Umgebung nicht verfügbar." : message || "Hier prüfst du auf neue Spielversionen. Installation und Updates sind unabhängig voneinander."}</p>
  </aside>;
}
