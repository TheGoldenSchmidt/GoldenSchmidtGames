import type { MatchId } from "./matches/framework";

/**
 * Presentation of a minigame, chosen by the host in the game menu before "Ich bin bereit":
 * the rendering (Unity build or the app's own web view) and the camera view. One minigame
 * stays one entry; a view only changes rules where it changes what a player may know
 * (Tank Trouble: in 3rd and 1st person every device only sees what its own tank sees).
 */
export type MiniView = "top" | "third" | "first";
/** "unity-host" (pilot, Floor is Lava): the host's Unity scene simulates the match for everyone; online only. */
export type MiniRenderer = "unity" | "unity-host" | "web";
export interface MiniLook { renderer: MiniRenderer; view: MiniView }

export const VIEW_NAMES: Record<MiniView, string> = { top: "Draufsicht", third: "3rd Person", first: "1st Person" };
export const RENDERER_NAMES: Record<MiniRenderer, string> = { unity: "Unity", "unity-host": "Unity · Host rechnet", web: "Web" };

/**
 * Views per rendering; the first one is the default and Unity is preferred where it exists.
 * Minigames without an entry keep their single web view.
 */
export const MINI_LOOKS: Readonly<Record<string, Partial<Record<MiniRenderer, readonly MiniView[]>>>> = {
  tanks: { unity: ["top", "third", "first"], web: ["top", "third"] },
  sumo: { unity: ["top", "third"], web: ["top"] },
  bumpercars: { unity: ["top", "third"], web: ["top"] },
  bombs: { unity: ["top"], web: ["top"] },
  snowball: { unity: ["third", "top"], web: ["third"] },
  lava: { unity: ["third", "top"], web: ["third"], "unity-host": ["third", "top"] },
  tuerenlotto: { unity: ["third"], web: ["third"] },
  kreiselkurs: { unity: ["third"], web: ["third"] },
  standhaft: { unity: ["third", "top"], web: ["third"] }
};

/** Match modules that only are a view of another minigame: never drawn or chosen on their own. */
export const VIEW_VARIANT_IDS: readonly MatchId[] = ["tankview", "lavahost"];

export const lookChoices = (id: string) => MINI_LOOKS[id];

export function defaultLook(id: string): MiniLook | undefined {
  const choices = MINI_LOOKS[id];
  if (!choices) return undefined;
  const renderer: MiniRenderer = choices.unity?.length ? "unity" : "web";
  return { renderer, view: choices[renderer]![0] };
}

export function isMiniLook(id: string, value: unknown): value is MiniLook {
  const choices = MINI_LOOKS[id];
  if (!choices || !value || typeof value !== "object") return false;
  const { renderer, view } = value as Partial<MiniLook>;
  return (renderer === "unity" || renderer === "unity-host" || renderer === "web") && typeof view === "string" && (choices[renderer]?.includes(view as MiniView) ?? false);
}

/** The rules module that plays a minigame in the chosen view (Tank Trouble's own-sight views use the Turmsicht rules). */
export function matchIdForLook(id: MatchId, look: MiniLook | undefined): MatchId {
  if (id === "lava" && look?.renderer === "unity-host") return "lavahost";
  return id === "tanks" && look && look.view !== "top" ? "tankview" : id;
}

/** Short label such as "Unity · 3rd Person". */
export const lookLabel = (look: MiniLook) => `${RENDERER_NAMES[look.renderer]} · ${VIEW_NAMES[look.view]}`;
