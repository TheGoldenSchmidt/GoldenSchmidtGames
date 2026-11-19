import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { GuestProfile } from "../../shared/types";

/** Name of the sandbox as it appears on the start screen and as the submenu title. */
export const UNIVERSE_TITLE = "Rich’s Universe";

/** Everything an experiment receives from the app. */
export interface ExperimentProps {
  /** Guest profile of the person on this phone (name, chosen character). */
  profile: GuestProfile;
  /** Returns to the list of experiments in Rich’s Universe. */
  onExit: () => void;
}

export interface UniverseExperiment {
  /** Stable, unique id in kebab case. Also the folder name below `experiments/`. */
  id: string;
  /** Title of the entry in the submenu. */
  title: string;
  /** One short line about what the experiment does. */
  detail: string;
  /** Loaded only when the experiment is opened, so it never slows down the start screen. */
  component: LazyExoticComponent<ComponentType<ExperimentProps>>;
}

/**
 * Entries of the submenu, in display order. Add a new experiment by creating
 * `experiments/<id>/` with a default-exported component and listing it here.
 */
export const EXPERIMENTS: UniverseExperiment[] = [
  {
    id: "hasenspiel",
    title: "Hasenspiel",
    detail: "Zu zweit um das Zentrum spielen",
    component: lazy(() => import("./experiments/hasenspiel/Hasenspiel"))
  },
  {
    id: "hallo-universum",
    title: "Hallo Universum",
    detail: "Vorlage für eigene Experimente",
    component: lazy(() => import("./experiments/hallo-universum/HalloUniversum"))
  }
];
