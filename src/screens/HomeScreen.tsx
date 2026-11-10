import type { GuestProfile } from "../../shared/types";
import { HomeParty } from "../components/HomeParty";
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
  resumeGameName = "Inselparty",
  resumeError
}: {
  profile: GuestProfile;
  online: boolean;
  onProfile: () => void;
  onLocal: () => void;
  onOnline: () => void;
  onResumeHost?: () => void;
  onResumeOnline?: () => void;
  resumeGameName?: string;
  resumeError?: string;
}) {
  return (
    <main className="home">
      <div className="home__topbar">
        <span className="home__greeting"><span aria-hidden="true">✳</span> Die Runde gehört euch.</span>
        <button className="profile-chip" onClick={onProfile} aria-label={`Gastprofil: ${displayName(profile)}`}>
          <span className="profile-chip__avatar" aria-hidden="true">
            {displayName(profile).slice(0, 1).toUpperCase()}
          </span>
          <span>{displayName(profile)}</span>
        </button>
      </div>

      <div className="home__main">
        <section className="home__hero" aria-label="Willkommen bei GoldenSchmidtGames">
          <div className="home__wordmark-wrap">
            <span className="home__spark home__spark--left" aria-hidden="true">✦</span>
            <h1 className="home__wordmark" aria-label="GoldenSchmidtGames">
              <span className="home__word home__word--golden" aria-hidden="true">Golden</span>
              <span className="home__word home__word--schmidt" aria-hidden="true">Schmidt</span>
              <span className="home__word home__word--games" aria-hidden="true">Games<span className="home__word-dot">!</span></span>
            </h1>
            <span className="home__spark home__spark--right" aria-hidden="true">✳</span>
          </div>
          <HomeParty />
        </section>

        <section className="home__play" aria-labelledby="home-play-title">
          <div className="home__invitation">
            <p>Alle da?</p>
            <h2 id="home-play-title">Dann los!</h2>
          </div>
          <div className="mode-stack" aria-label="Spielmodus wählen">
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
                <small>Alle am eigenen Gerät</small>
              </span>
              <span className="mode-card__chevron" aria-hidden="true">›</span>
            </button>
          </div>
          {onResumeHost && <button className="button button--secondary button--wide home__resume" onClick={onResumeHost}>Handy-Tisch fortsetzen</button>}
          {onResumeOnline && <section className="party-resume" aria-label={resumeGameName + " fortsetzen"}><button className="button button--secondary button--wide home__resume" onClick={onResumeOnline} disabled={!online}>{resumeGameName === "Inselparty" ? "Online-Inselparty" : resumeGameName} wieder beitreten</button></section>}
          {resumeError && <p className="home__error" role="alert">{resumeError}</p>}
        </section>
      </div>

      <div className="home__utilities">
        <InstallPrompt />
        <AppUpdate />
      </div>

      <footer className="home__footer">
        <span className={`connection-dot ${online ? "is-online" : ""}`} />
        {online ? "Online bereit" : "Offline · Handy-Hosting im WLAN oder Hotspot verfügbar"}
      </footer>
    </main>
  );
}
