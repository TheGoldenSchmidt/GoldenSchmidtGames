import { useEffect, useRef, useState } from "react";
import type { GuestProfile } from "../../shared/types";
import { InstallPrompt } from "../components/InstallPrompt";
import { AppUpdate } from "../components/AppUpdate";
import { AdventureChoice } from "../components/AdventureChoice";
import { MenuSound } from "../components/MenuSound";
import { displayName } from "../lib/profile";
import island from "../assets/expedition/island.webp";

import plaque from "../assets/expedition/plaque.webp";
import golden from "../assets/expedition/golden.webp";
import schmidt from "../assets/expedition/schmidt.webp";
import games from "../assets/expedition/games.webp";
import crown from "../assets/expedition/crown.webp";

const titleLayers = { plaque, golden, schmidt, games, crown };
let introShown = false;

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
  const hero = useRef<HTMLHeadingElement>(null);
  const [intro, setIntro] = useState<"loading" | "playing" | "complete">(() => introShown ? "complete" : "loading");
  useEffect(() => {
    if (intro !== "loading" || !hero.current) return;
    let active = true;
    const layers = Array.from(hero.current.querySelectorAll("img"));
    void Promise.allSettled(layers.map(layer => layer.decode())).then(() => {
      if (active) {
        introShown = true;
        setIntro("playing");
      }
    });
    return () => { active = false; };
  }, [intro]);
  return <main className="home expedition-home" data-intro={intro}>
    <div className="expedition-bar">
      <span className="expedition-status"><i data-online={online} />{online ? "Online" : "Offline"}</span>
      <div className="expedition-account"><MenuSound/><button className="expedition-profile" onClick={onProfile} aria-label={`Gastprofil: ${name}`}>
        <span aria-hidden="true">{name.slice(0,1).toUpperCase()}</span><b>{name}</b>
      </button></div>
    </div>
    <h1 className="expedition-hero" ref={hero}>
      <span className="expedition-scene" role="img" aria-label="GoldenSchmidtGames">
        <img className="expedition-island" src={island} alt="" fetchPriority="high"/>
        <span className="expedition-crest">
          {Object.entries(titleLayers).map(([part, src]) =>
            <img key={part} className={`crest-piece crest-${part}`} src={src} alt=""/>
          )}
        </span>
      </span>
    </h1>
    <div className="expedition-dock">
      <div className="expedition-motto"><span>Play like the GoldenSchmidt</span> - <span>Be like the GoldenSchmidt</span></div>
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
