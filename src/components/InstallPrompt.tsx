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
  const [showHelp, setShowHelp] = useState(false);
  const [installError, setInstallError] = useState("");
  const [installed, setInstalled] = useState(() => isStandalone());
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setInstalled(false);
      setInstallError("");
    };
    const appInstalled = () => {
      setInstalled(true);
      setInstallEvent(undefined);
    };
    // Ein Browser-Tab kann nach Deinstallation weiterhin geöffnet sein.
    // Die Startbildschirm-Ansicht ist die einzige zuverlässige lokale Anzeige.
    const refreshDisplayMode = () => setInstalled(isStandalone());
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    window.addEventListener("focus", refreshDisplayMode);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
      window.removeEventListener("focus", refreshDisplayMode);
    };
  }, []);

  if (installed) return null;

  async function install() {
    setInstallError("");
    if (!installEvent) return setShowHelp((current) => !current);
    // Browser-Installationsereignisse können nur einmal verwendet werden.
    const currentEvent = installEvent;
    setInstallEvent(undefined);
    try {
      await currentEvent.prompt();
      const result = await currentEvent.userChoice;
      if (result.outcome === "dismissed") setShowHelp(true);
    } catch {
      setInstallError("Der Browser hat den Installationsdialog nicht geöffnet. Nutze bitte die Schritte unten.");
      setShowHelp(true);
    }
  }

  return (
    <aside className="install-card" aria-label="App installieren">
      <button className="dock-tool" onClick={install} aria-expanded={installEvent ? undefined : showHelp}>
        <span className="dock-tool__contents">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4v10.5M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></svg>
          <span>App installieren</span>
        </span>
      </button>
      {showHelp && (
        <div className="install-help">
          <button data-menu-direction="back" className="install-help__close" onClick={() => setShowHelp(false)} aria-label="Installationshilfe schließen">×</button>
          {installError && <p role="alert">{installError}</p>}
          {isIos ? <p>Öffne diesen Link in <strong>Safari</strong>. Wähle <strong>Teilen → Zum Home-Bildschirm</strong> und, falls angezeigt, <strong>Als Web-App öffnen → Hinzufügen</strong>.</p>
            : <p>Öffne diesen Link direkt in <strong>Chrome</strong> oder deinem normalen Browser. Wähle im <strong>⋮-Menü</strong> den Eintrag <strong>App installieren</strong> oder <strong>Zum Startbildschirm hinzufügen</strong>. Auf dem PC findest du die Installation meist oben in der Adressleiste.</p>}
          <p>„Aktuelle Version“ bedeutet nur, dass diese Webseite aktuell ist. Du kannst sie trotzdem als App installieren.</p>
          {!isIos && <p>Falls der Browser „Öffnen“ statt „Installieren“ anbietet: Prüfe in den Handy-Einstellungen unter <strong>Apps → GoldenSchmidtGames</strong>, ob die App noch installiert ist. Ein entferntes Startbildschirm-Symbol deinstalliert sie nicht unbedingt.</p>}
        </div>
      )}
    </aside>
  );
}
