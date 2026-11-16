import type { GuestProfile } from "../../shared/types";
import { InstallPrompt } from "../components/InstallPrompt";
import { AppUpdate } from "../components/AppUpdate";
import { AdventureChoice } from "../components/AdventureChoice";
import { MenuSound } from "../components/MenuSound";
import { displayName } from "../lib/profile";
import island from "../assets/expedition/island.webp";

interface HomeProps {
  profile: GuestProfile;
  online: boolean;
  onProfile: () => void;
  onLocal: () => void;
  onOnline: () => void;
  onResumeHost?: () => void;
  onResumeOnline?: () => void;
  resumeGameName?: string;
  resumeError?: string;
}

export function HomeScreen({profile, online, onProfile, onLocal, onOnline, onResumeHost, onResumeOnline, resumeGameName = "Inselparty", resumeError}: HomeProps) {
  const name = displayName(profile);
  return <main className="home expedition-home">
    <div className="expedition-bar">
      <span className="expedition-status"><i data-online={online} />{online ? "Online" : "Offline"}</span>
      <div className="expedition-account"><MenuSound/><button className="expedition-profile" onClick={onProfile} aria-label={`Gastprofil: ${name}`}>
        <span aria-hidden="true">{name.slice(0,1).toUpperCase()}</span><b>{name}</b>
      </button></div>
    </div>
    <h1 className="expedition-hero"><img src={island} alt="GoldenSchmidtGames" fetchPriority="high"/></h1>
    <div className="expedition-dock">
      <div className="expedition-motto"><i aria-hidden="true"/>Minispiele · Party · Gemeinsam<i aria-hidden="true"/></div>
      <nav className="expedition-actions" aria-label="Spielmodus wählen">
        <AdventureChoice title="Lokal spielen" detail="Zusammen an einem Gerät" icon="group" onClick={onLocal}/>
        <AdventureChoice title="Online spielen" detail="Jeder am eigenen Gerät" icon="globe" violet onClick={onOnline}/>
      </nav>
      {onResumeHost && <button className="expedition-resume" onClick={onResumeHost}>Handy-Tisch fortsetzen</button>}
      {onResumeOnline && <button className="expedition-resume" disabled={!online} onClick={onResumeOnline}>{resumeGameName === "Inselparty" ? "Online-Inselparty" : resumeGameName} wieder beitreten</button>}
      {resumeError && <p role="alert">{resumeError}</p>}
      <footer className="expedition-utilities"><InstallPrompt/><AppUpdate/></footer>
    </div>
  </main>;
}
