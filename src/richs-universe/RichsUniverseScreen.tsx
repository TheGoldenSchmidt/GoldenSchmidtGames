import { Component, Suspense, useState, type ReactNode } from "react";
import type { GuestProfile } from "../../shared/types";
import { IslandWorld } from "../components/IslandWorld";
import { MenuIcon } from "../components/MenuIcon";
import { ScreenHeader } from "../components/ScreenHeader";
import { EXPERIMENTS, UNIVERSE_TITLE, type UniverseExperiment } from "./experiments";
import "./richsUniverse.css";

export function RichsUniverseScreen({ profile, onBack }: { profile: GuestProfile; onBack: () => void }) {
  const [openId, setOpenId] = useState<string>();
  const experiment = EXPERIMENTS.find(entry => entry.id === openId);
  if (experiment) return <ExperimentHost key={experiment.id} experiment={experiment} profile={profile} onExit={() => setOpenId(undefined)}/>;

  return <main className="page iw-menu route-selection richs-universe screen-enter">
    <IslandWorld/>
    <ScreenHeader title={UNIVERSE_TITLE} onBack={onBack}/>
    <section className="page__content">
      <div className="iw-card">
        <h2 className="iw-plank iw-card__title">Experimente</h2>
        <p className="iw-card__lead">Neue Spiele und Ideen zum Ausprobieren. Hier darf noch etwas wackeln.</p>
        {EXPERIMENTS.length
          ? <ul className="universe-list">
            {EXPERIMENTS.map(entry => <li key={entry.id}>
              <button className="universe-entry" onClick={() => setOpenId(entry.id)}>
                <span className="universe-entry__copy"><strong>{entry.title}</strong><small>{entry.detail}</small></span>
                <MenuIcon name="next"/>
              </button>
            </li>)}
          </ul>
          : <p className="universe-empty">Noch keine Experimente. Das erste entsteht in <code>src/richs-universe/</code>.</p>}
      </div>
    </section>
  </main>;
}

function ExperimentHost({ experiment, profile, onExit }: { experiment: UniverseExperiment; profile: GuestProfile; onExit: () => void }) {
  const Experiment = experiment.component;
  return <ExperimentBoundary title={experiment.title} onExit={onExit}>
    <Suspense fallback={<main className="page iw-menu richs-universe"><IslandWorld/><p className="iw-note" role="status">{experiment.title} wird geladen …</p></main>}>
      <Experiment profile={profile} onExit={onExit}/>
    </Suspense>
  </ExperimentBoundary>;
}

/** Keeps a crashing experiment from taking the rest of the app down with it. */
class ExperimentBoundary extends Component<{ title: string; onExit: () => void; children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <main className="page iw-menu route-selection richs-universe">
      <IslandWorld/>
      <ScreenHeader title={UNIVERSE_TITLE} onBack={this.props.onExit}/>
      <section className="page__content">
        <div className="iw-card universe-crash" role="alert">
          <h2 className="iw-plank iw-card__title">{this.props.title} ist abgestürzt</h2>
          <p className="iw-card__lead">Die übrige App läuft weiter. Fehlermeldung für die Fehlersuche:</p>
          <pre>{error.message || String(error)}</pre>
          <button className="button button--ghost" data-menu-direction="back" onClick={this.props.onExit}>Zurück zu den Experimenten</button>
        </div>
      </section>
    </main>;
  }
}
