import type { CSSProperties } from "react";
import type { GuestProfile } from "../../shared/types";
import { InstallPrompt } from "../components/InstallPrompt";
import { AppUpdate } from "../components/AppUpdate";
import { HomeHeroProps, HomePlayProps, HomeSpread } from "../components/HomeTable";
import { displayName } from "../lib/profile";

// Same drawing as public/gsg-icon.svg, inlined so the emblem is ready for its entrance.
function GsgEmblem() {
  return (
    <svg className="home__emblem-art" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <rect width="512" height="512" rx="112" fill="#12172f" />
      <rect x="64" y="78" width="384" height="370" rx="94" fill="#b77a28" />
      <rect x="64" y="64" width="384" height="370" rx="94" fill="#ffe2a0" />
      <rect x="64" y="72" width="384" height="362" rx="94" fill="#f2c35b" />
      <circle cx="144" cy="140" r="14" fill="#12172f" />
      <circle cx="368" cy="372" r="14" fill="#12172f" />
      <polygon points="196,215 174,193 126,193 104,215 104,307 126,329 196,329 196,259 151,259 151,284 171,284 171,304 137,304 129,296 129,226 137,218 171,218 171,235 196,235" fill="#12172f" />
      <polygon points="302,193 232,193 210,215 210,251 232,273 277,273 277,304 210,304 210,329 280,329 302,307 302,270 280,248 235,248 235,226 243,218 302,218" fill="#12172f" />
      <polygon points="408,215 386,193 338,193 316,215 316,307 338,329 408,329 408,259 363,259 363,284 383,284 383,304 349,304 341,296 341,226 349,218 383,218 383,235 408,235" fill="#12172f" />
    </svg>
  );
}

const IMPACT_PIPS = [0, 1, 2, 3, 4, 5];

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
        <span className={`home__status ${online ? "is-online" : ""}`}>
          <span className="connection-dot" aria-hidden="true" />
          {online ? "Online bereit" : "Offline"}
        </span>
        <button className="profile-chip" onClick={onProfile} aria-label={`Gastprofil: ${displayName(profile)}`}>
          <span className="profile-chip__avatar" aria-hidden="true">
            {displayName(profile).slice(0, 1).toUpperCase()}
          </span>
          <span>{displayName(profile)}</span>
        </button>
      </div>

      <div className="home__main">
        <section className="home__hero" aria-label="Willkommen bei GoldenSchmidtGames">
          <div className="home__lockup">
            <HomeHeroProps />
            <div className="home__emblem">
              <span className="home__emblem-toss"><GsgEmblem /></span>
              {IMPACT_PIPS.map(index => (
                <span key={index} className="home__pip" style={{ "--pip": index } as CSSProperties} aria-hidden="true" />
              ))}
            </div>
            <h1 className="home__wordmark" aria-label="GoldenSchmidtGames">
              <span className="home__word home__word--golden" aria-hidden="true">Golden</span>
              <span className="home__word home__word--schmidt" aria-hidden="true">Schmidt</span>
              <span className="home__word home__word--games" aria-hidden="true">Games</span>
            </h1>
          </div>
          <p className="home__tagline">Die Spielesammlung für eure Runde</p>
        </section>

        <section className="home__play" aria-labelledby="home-play-title">
          <HomePlayProps />
          <h2 id="home-play-title" className="home__play-title">Wie spielt ihr heute?</h2>
          <div className="mode-stack" aria-label="Spielmodus wählen">
            <button className="mode-card mode-card--local" onClick={onLocal}>
              <span className="mode-card__icon" aria-hidden="true">
                <svg viewBox="0 0 32 32" focusable="false">
                  <rect x="8.5" y="3" width="15" height="26" rx="3.5" />
                  <circle cx="12.6" cy="10" r="1.9" className="is-filled" />
                  <circle cx="16" cy="16" r="1.9" className="is-filled" />
                  <circle cx="19.4" cy="22" r="1.9" className="is-filled" />
                </svg>
              </span>
              <span className="mode-card__copy">
                <strong>Lokal spielen</strong>
                <small>Gemeinsam an einem Gerät</small>
              </span>
              <span className="mode-card__chevron" aria-hidden="true">
                <svg viewBox="0 0 16 16" focusable="false"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
              </span>
            </button>

            <button className="mode-card mode-card--online" onClick={onOnline}>
              <span className="mode-card__icon" aria-hidden="true">
                <svg viewBox="0 0 32 32" focusable="false">
                  <rect x="2.5" y="12" width="10" height="17" rx="2.5" />
                  <rect x="19.5" y="12" width="10" height="17" rx="2.5" />
                  <path d="M10.5 7.5a7.8 7.8 0 0 1 11 0" />
                  <path d="M13.4 10.8a3.6 3.6 0 0 1 5.2 0" />
                </svg>
              </span>
              <span className="mode-card__copy">
                <strong>Online spielen</strong>
                <small>Alle am eigenen Gerät</small>
              </span>
              <span className="mode-card__chevron" aria-hidden="true">
                <svg viewBox="0 0 16 16" focusable="false"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
              </span>
            </button>
          </div>
          {onResumeHost && <button className="button button--secondary button--wide home__resume" onClick={onResumeHost}>Handy-Tisch fortsetzen</button>}
          {onResumeOnline && <section className="party-resume" aria-label={resumeGameName + " fortsetzen"}><button className="button button--secondary button--wide home__resume" onClick={onResumeOnline} disabled={!online}>{resumeGameName === "Inselparty" ? "Online-Inselparty" : resumeGameName} wieder beitreten</button></section>}
          {resumeError && <p className="home__error" role="alert">{resumeError}</p>}
        </section>
      </div>

      <HomeSpread />

      <div className="home__utilities">
        <InstallPrompt />
        <AppUpdate />
      </div>

      {!online && <footer className="home__footer">Handy-Hosting im WLAN oder Hotspot ist weiterhin verfügbar.</footer>}
    </main>
  );
}
