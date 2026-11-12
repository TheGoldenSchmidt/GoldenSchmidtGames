import type { GuestProfile } from "../../shared/types";
import { InstallPrompt } from "../components/InstallPrompt";
import { AppUpdate } from "../components/AppUpdate";
import { HomeBackdrop, HomeIsland } from "../components/HomeScene";
import { displayName } from "../lib/profile";

function ModeChevron() {
  return (
    <span className="home-mode__go" aria-hidden="true">
      <svg viewBox="0 0 16 16" focusable="false"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
    </span>
  );
}

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
      <HomeBackdrop />

      <div className="home__topbar">
        <span className={`iw-chip home__status ${online ? "is-online" : ""}`}>
          <span className="connection-dot" aria-hidden="true" />
          {online ? "Online" : "Offline"}
        </span>
        <button className="iw-chip iw-chip--light profile-chip" onClick={onProfile} aria-label={`Gastprofil: ${displayName(profile)}`}>
          <span className="profile-chip__avatar" aria-hidden="true">
            {displayName(profile).slice(0, 1).toUpperCase()}
          </span>
          <span>{displayName(profile)}</span>
        </button>
      </div>

      <div className="home__main">
        <section className="home__hero" aria-label="Willkommen bei GoldenSchmidtGames">
          <h1 className="home__title" aria-label="GoldenSchmidtGames">
            <HomeIsland />
          </h1>
        </section>

        <section className="home__play" aria-label="Spielmodus wählen">
          <button className="iw-slab iw-slab--gold home-mode" onClick={onLocal}>
            <span className="iw-slab__face">
              <svg className="home-mode__icon" viewBox="0 0 48 40" aria-hidden="true" focusable="false">
                <circle cx="24" cy="11" r="8.5" />
                <path d="M9.5 40c0-9.4 6.2-15.5 14.5-15.5S38.5 30.6 38.5 40z" />
                <circle cx="7.5" cy="16.5" r="5.5" />
                <path d="M0 38c0-7 3.6-11 8-11 1.5 0 2.8.4 4 1.100C8.7 30.9 7 34.2 6.6 38z" />
                <circle cx="40.5" cy="16.5" r="5.5" />
                <path d="M48 38c0-7-3.6-11-8-11-1.5 0-2.8.4-4 1.1 3.3 2.8 5 6.1 5.4 9.900z" />
              </svg>
              <span className="home-mode__copy">
                <strong>Lokal spielen</strong>
                <small>Zusammen an einem Gerät</small>
              </span>
              <ModeChevron />
            </span>
          </button>

          <button className="iw-slab iw-slab--violet home-mode" onClick={onOnline}>
            <span className="iw-slab__face">
              <svg className="home-mode__icon home-mode__icon--line" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                <circle cx="24" cy="24" r="19.5" />
                <ellipse cx="24" cy="24" rx="8.5" ry="19.5" />
                <path d="M4.5 24h39M7.5 14h33M7.5 34h33" />
              </svg>
              <span className="home-mode__copy">
                <strong>Online spielen</strong>
                <small>Gemeinsam über das Internet</small>
              </span>
              <ModeChevron />
            </span>
          </button>

          {onResumeHost && (
            <button className="iw-slab iw-slab--stone home__resume" onClick={onResumeHost}>
              <span className="iw-slab__face">Handy-Tisch fortsetzen</span>
            </button>
          )}
          {onResumeOnline && (
            <section className="party-resume" aria-label={resumeGameName + " fortsetzen"}>
              <button className="iw-slab iw-slab--stone home__resume" onClick={onResumeOnline} disabled={!online}>
                <span className="iw-slab__face">{resumeGameName === "Inselparty" ? "Online-Inselparty" : resumeGameName} wieder beitreten</span>
              </button>
            </section>
          )}
          {resumeError && <p className="home__error" role="alert">{resumeError}</p>}
        </section>
      </div>

      <div className="home__base">
        <div className="home__utilities">
          <InstallPrompt />
          <AppUpdate />
        </div>
        {!online && <footer className="home__footer">Handy-Hosting im WLAN oder Hotspot ist weiterhin verfügbar.</footer>}
      </div>
    </main>
  );
}
