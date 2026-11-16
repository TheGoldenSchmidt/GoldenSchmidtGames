import { useEffect, useRef, useState } from "react";
import { applyPwaUpdate, checkPwaUpdate } from "../lib/pwaUpdate";

type Status = "idle" | "checking" | "ready" | "applying" | "current" | "error" | "unsupported";

export function AppUpdate() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const registration = useRef<Promise<ServiceWorkerRegistration> | undefined>(undefined);

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
      const inspect = () => { if (active && reg.active && reg.waiting) setStatus("ready"); };
      const found = () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", inspect);
        cleanup = () => { reg.removeEventListener("updatefound", found); worker?.removeEventListener("statechange", inspect); };
      };
      reg.addEventListener("updatefound", found);
      cleanup = () => reg.removeEventListener("updatefound", found);
      found(); inspect();
    }).catch(() => { if (active) { setStatus("error"); setMessage("Update-Prüfung derzeit nicht verfügbar. Bitte mit Internetverbindung erneut versuchen."); } });
    return () => { active = false; cleanup(); };
  }, []);

  async function check() {
    if (!navigator.onLine) { setStatus("error"); setMessage("Zum Prüfen auf Updates ist eine Internetverbindung nötig."); return; }
    setStatus("checking"); setMessage("");
    try {
      const ready = await checkPwaUpdate(await getRegistration());
      setStatus(ready ? "ready" : "current");
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Update-Prüfung fehlgeschlagen."); }
  }

  async function apply() {
    setStatus("applying"); setMessage("");
    try { await applyPwaUpdate(await getRegistration(), navigator.serviceWorker); window.location.reload(); }
    catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Aktualisierung fehlgeschlagen."); }
  }

  return <aside className="app-update" aria-label="App aktualisieren" data-status={status}>
    <button className="dock-tool" onClick={status === "ready" ? apply : check} disabled={["checking", "applying", "unsupported"].includes(status)}>
      <span className="dock-tool__contents">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19.5 11a7.6 7.6 0 0 0-13.6-3.6M5.4 3.6v4.2h4.2M4.5 13a7.6 7.6 0 0 0 13.6 3.6M18.6 20.4v-4.2h-4.2" /></svg>
        <span>{status === "ready" ? "Neue Version laden" : status === "checking" ? "Suche nach Updates …" : status === "applying" ? "Update wird geladen …" : "Updates prüfen"}</span>
      </span>
    </button>
    <p role="status">{status === "ready" ? "Eine neue Version ist bereit. Beim Aktualisieren wird die App neu gestartet." : status === "current" ? "Diese Ansicht ist aktuell. Die Update-Prüfung installiert keine App." : status === "unsupported" ? "Updates sind in dieser Umgebung nicht verfügbar." : message || "Hier prüfst du auf neue Spielversionen. Installation und Updates sind unabhängig voneinander."}</p>
  </aside>;
}
