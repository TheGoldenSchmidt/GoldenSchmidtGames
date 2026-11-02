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
  onResumeLocal,
  onResumeOnline,
  resumeError
}: {
  profile: GuestProfile;
  online: boolean;
  onProfile: () => void;
  onLocal: () => void;
  onOnline: () => void;
  onResumeLocal?: () => void;
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

        <button className="mode-card mode-card--online" onClick={onOnline} disabled={!online}>
          <span className="mode-card__signal" aria-hidden="true"><i /><i /><i /></span>
          <span className="mode-card__copy">
            <strong>Online spielen</strong>
            <small>{online ? "Raum erstellen oder beitreten" : "Keine Internetverbindung"}</small>
          </span>
          <span className="mode-card__chevron" aria-hidden="true">›</span>
        </button>
      </section>

      <InstallPrompt />
      {(onResumeLocal||onResumeOnline)&&<section className="party-resume" aria-label="Inselparty fortsetzen">{onResumeLocal&&<button className="button button--secondary button--wide" onClick={onResumeLocal}>Lokale Inselparty fortsetzen</button>}{onResumeOnline&&<button className="button button--secondary button--wide" onClick={onResumeOnline} disabled={!online}>Online-Inselparty wieder beitreten</button>}{resumeError&&<p role="alert">{resumeError}</p>}</section>}
      <AppUpdate />

      <footer className="home__footer">
        <span className={`connection-dot ${online ? "is-online" : ""}`} />
        {online ? "Online bereit" : "Offline – lokale Spiele sind verfügbar"}
      </footer>
    </main>
  );
}
