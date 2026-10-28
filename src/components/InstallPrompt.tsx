import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent>();
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installed, setInstalled] = useState(() => isStandalone());
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const appInstalled = () => {
      setInstalled(true);
      setInstallEvent(undefined);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  if (installed || (!installEvent && !isIos)) return null;

  async function install() {
    if (!installEvent) return setShowIosHelp((current) => !current);
    await installEvent.prompt();
    const result = await installEvent.userChoice;
    if (result.outcome === "accepted") setInstallEvent(undefined);
  }

  return (
    <aside className="install-card">
      <button onClick={install}>
        <span className="install-card__icon" aria-hidden="true">↓</span>
        <span><strong>Als App installieren</strong><small>Offline spielen und direkt starten</small></span>
        <span aria-hidden="true">{showIosHelp ? "−" : "+"}</span>
      </button>
      {showIosHelp && (
        <p>In Safari auf <strong>Teilen</strong> tippen, dann <strong>Zum Home-Bildschirm</strong> und <strong>Als Web-App öffnen</strong> wählen.</p>
      )}
    </aside>
  );
}
