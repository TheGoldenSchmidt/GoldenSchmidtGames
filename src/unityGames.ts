/**
 * Unity test games: separate WebGL builds of the Unity project in `unity/GoldenSchmidtUnity`,
 * served from `public/unity/<id>/`. They run alone on one phone (parcours solo, Floor is Lava
 * against bots), outside rooms, the random pool and the offline cache.
 */
export const UNITY_GAMES = [
  {
    id: "parcours",
    name: "Parcours-Probelevel",
    text: "15 Stationen mit allen Hindernisarten, gebaut in Unity.",
    note: "Allein · erster Start lädt ca. 14 MB"
  },
  {
    id: "lava",
    name: "Floor is Lava",
    text: "Drei Etagen über der Lava gegen drei Bots, gebaut in Unity.",
    note: "Gegen Bots · erster Start lädt ca. 14 MB"
  }
] as const;

export type UnityGameId = typeof UNITY_GAMES[number]["id"];

export const isUnityGame = (id: unknown): id is UnityGameId => UNITY_GAMES.some(game => game.id === id);

/** Address of a build, with the chosen figure and the motion preference handed over to Unity. */
export function unityGameUrl(id: UnityGameId, characterId: string | undefined, reducedMotion: boolean) {
  const query = new URLSearchParams();
  if (characterId) query.set("figur", characterId);
  if (reducedMotion) query.set("ruhig", "1");
  const search = query.toString();
  return `/unity/${id}/index.html${search ? `?${search}` : ""}`;
}
