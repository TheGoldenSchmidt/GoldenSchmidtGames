import type { GuestProfile } from "../../shared/types";
import { Brand } from "../components/Brand";
import { InstallPrompt } from "../components/InstallPrompt";
import { AppUpdate } from "../components/AppUpdate";
import { displayName } from "../lib/profile";

export function HomeScreen({
  profile,
  online,
  onProfile,
  onLocal,
  onOnline,
  onResumeHost,
  onResumeOnline,
  resumeError
}: {
  profile: GuestProfile;
  online: boolean;
  onProfile: () => void;
  onLocal: () => void;
  onOnline: () => void;
  onResumeHost?: () => void;
  onResumeOnline?: () => void;
  resumeError?: string;
}) {
  return (
    <main className="home screen-enter">
      <div className="home__topbar">
        <Brand />
        <button className="profile-chip" onClick={onProfile}>
          <span className="profile-chip__avatar" aria-hidden="true">
            {displayName(profile).slice(0, 1).toUpperCase()}
          </span>
          <span>{displayName(profile)}</span>
        </button>
      </div>

      <section className="home__intro">
        <p>Was spielen wir?</p>
        <h1>Ein Tisch.<br />Viele Spiele.</h1>
      </section>

      <section className="mode-stack" aria-label="Spielmodus wählen">
        <button className="mode-card mode-card--local" onClick={onLocal}>
          <span className="mode-card__icon" aria-hidden="true">
            <span>●</span><span>●</span><span>●</span>
          </span>
          <span className="mode-card__copy">
            <strong>Lokal spielen</strong>
            <small>Gemeinsam an einem Gerät</small>
          </span>
          <span className="mode-card__chevron" aria-hidden="true">›</span>
        </button>

        <button className="mode-card mode-card--online" onClick={onOnline}>
          <span className="mode-card__signal" aria-hidden="true"><i /><i /><i /></span>
          <span className="mode-card__copy">
            <strong>Online spielen</strong>
            <small>Node-Server oder Handy-Hosting</small>
          </span>
          <span className="mode-card__chevron" aria-hidden="true">›</span>
        </button>
      </section>

      <InstallPrompt />
      {onResumeHost && <button className="button button--secondary button--wide" onClick={onResumeHost}>Handy-Tisch fortsetzen</button>}
      {onResumeOnline&&<section className="party-resume" aria-label="Inselparty fortsetzen"><button className="button button--secondary button--wide" onClick={onResumeOnline} disabled={!online}>Online-Inselparty wieder beitreten</button></section>}
      {resumeError && <p role="alert">{resumeError}</p>}
      <AppUpdate />

      <footer className="home__footer">
        <span className={`connection-dot ${online ? "is-online" : ""}`} />
        {online ? "Online bereit" : "Offline · Handy-Hosting im WLAN oder Hotspot verfügbar"}
      </footer>
    </main>
  );
}
