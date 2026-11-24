import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GuestProfile } from "../../shared/types";
import { InstallPrompt } from "../components/InstallPrompt";
import { AppUpdate } from "../components/AppUpdate";
import { AdventureChoice } from "../components/AdventureChoice";
import { MenuIcon } from "../components/MenuIcon";
import { UNIVERSE_TITLE } from "../richs-universe/experiments";
import { MenuSound } from "../components/MenuSound";
import { displayName } from "../lib/profile";
import island from "../assets/expedition/island.webp";

import plaque from "../assets/expedition/plaque.webp";
import golden from "../assets/expedition/golden.webp";
import schmidt from "../assets/expedition/schmidt.webp";
import games from "../assets/expedition/games.webp";
import crown from "../assets/expedition/crown.webp";

const titleLayers = { plaque, golden, schmidt, games };
let introShown = false;
/** Version of the build this device displays, written into index.html by the server ("PR #48"). */
const BUILD_VERSION = typeof document === "undefined" ? "" : document.querySelector<HTMLMetaElement>('meta[name="gsg-build"]')?.content ?? "";

interface HomeProps {
  profile: GuestProfile;
  signedIn?: boolean;
  /** Admins and developers see which merged pull request the server runs. */
  showVersion?: boolean;
  online: boolean;
  onProfile: () => void;
  onLocal: () => void;
  onOnline: () => void;
  onUniverse: () => void;
  onResumeHost?: () => void;
  onResumeOnline?: () => void;
  resumeGameName?: string;
  resumeError?: string;
}

export function HomeScreen({profile, signedIn, showVersion, online, onProfile, onLocal, onOnline, onUniverse, onResumeHost, onResumeOnline, resumeGameName = "Inselparty", resumeError}: HomeProps) {
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
      <span className="expedition-status"><i data-online={online} />{online ? "Online" : "Offline"}{showVersion && BUILD_VERSION && <span className="expedition-version">{BUILD_VERSION}</span>}</span>
      <div className="expedition-account"><MenuSound/><button className="expedition-profile" onClick={onProfile} aria-label={`${signedIn ? "Konto" : "Gastprofil"}: ${name}`}>
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
          <span className="crest-piece crest-crown">
            <img src={crown} alt=""/>
            <span className="crown-reflection" aria-hidden="true"/>
          </span>
        </span>
      </span>
    </h1>
    <div className="expedition-dock">
      <figure className="expedition-motto">
        <blockquote lang="en">
          <span>Play like the <em>GoldenSchmidt</em></span>
          <span className="motto-divider"> - </span>
          <span>Be like the <em>GoldenSchmidt</em></span>
        </blockquote>
        <figcaption>— TheGoldenSchmidt</figcaption>
      </figure>
      <div className="expedition-controls">
        <nav className="expedition-actions" aria-label="Spielmodus wählen">
          <AdventureChoice title="Lokal spielen" detail="Mit Bots oder an einem Handy" icon="group" onClick={onLocal}/>
          <AdventureChoice title="Online spielen" detail="Jeder am eigenen Gerät" icon="globe" violet onClick={onOnline}/>
        </nav>
        <button className="iw-slab iw-slab--stone expedition-universe" onClick={onUniverse}>
          <span className="iw-slab__face"><MenuIcon name="planet"/><span className="expedition-universe__copy"><strong>{UNIVERSE_TITLE}</strong><small>Experimente und neue Ideen</small></span><MenuIcon name="next"/></span>
        </button>
        {resumeError && <p className="expedition-resume-error" role="alert">{resumeError}</p>}
        <footer className="expedition-utilities">
          {onResumeHost && <ResumeButton onClick={onResumeHost}>Handy-Tisch fortsetzen</ResumeButton>}
          {onResumeOnline && <ResumeButton disabled={!online} onClick={onResumeOnline}>{resumeGameName === "Inselparty" ? "Online-Inselparty" : resumeGameName} wieder beitreten</ResumeButton>}
          <InstallPrompt/><AppUpdate/>
        </footer>
      </div>
    </div>
  </main>;
}

function ResumeButton({children, disabled, onClick}: {children: ReactNode; disabled?: boolean; onClick: () => void}) {
  return <button className="dock-tool expedition-resume" disabled={disabled} onClick={onClick}>
    <span className="dock-tool__contents">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10-6.5z"/></svg>
      <span>{children}</span>
    </span>
  </button>;
}
