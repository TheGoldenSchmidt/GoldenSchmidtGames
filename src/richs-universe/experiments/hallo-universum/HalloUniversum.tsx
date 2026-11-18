import { useState } from "react";
import { IslandWorld } from "../../../components/IslandWorld";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { displayName } from "../../../lib/profile";
import type { ExperimentProps } from "../../experiments";
import "./halloUniversum.css";

/**
 * Template for a new experiment: copy this folder, rename it and register it in
 * `../../experiments.ts`. Everything inside the folder may be changed freely.
 */
export default function HalloUniversum({ profile, onExit }: ExperimentProps) {
  const [taps, setTaps] = useState(0);
  return <main className="page iw-menu route-selection ru-hallo">
    <IslandWorld/>
    <ScreenHeader title="Hallo Universum" onBack={onExit}/>
    <section className="page__content">
      <div className="iw-card">
        <h2 className="iw-plank iw-card__title">Hallo, {displayName(profile)}!</h2>
        <p className="iw-card__lead">Dieses Experiment ist eine Vorlage. Kopiere den Ordner und baue daraus dein eigenes Spiel.</p>
        <button className="button button--primary ru-hallo__tap" onClick={() => setTaps(count => count + 1)}>Antippen</button>
        <p className="ru-hallo__count" aria-live="polite">{taps === 1 ? "1 Mal angetippt" : `${taps} Mal angetippt`}</p>
      </div>
    </section>
  </main>;
}
