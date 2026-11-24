/**
 * Unity test games: one shared WebGL build of the Unity project in `unity/GoldenSchmidtUnity`,
 * served from `public/unity/spiele/`; `?spiel=<id>` picks the game (engine and shared assets
 * load once and stay cached). They run alone on one phone against bots, outside rooms, the
 * random pool and the offline cache, and are listed only under "Frei ausprobieren".
 */
export const UNITY_BUILD = "/unity/spiele/index.html";
const NOTE = "erster Start lädt ca. 12 MB, danach aus dem Cache";
export const UNITY_GAME_CATALOG = [
  { id: "parcours", name: "Parcours-Probelevel", text: "15 Stationen mit allen Hindernisarten, gebaut in Unity.", note: `Allein · ${NOTE}` },
  { id: "lava", name: "Floor is Lava", text: "Drei Etagen über der Lava gegen drei Bots, gebaut in Unity.", note: `Gegen Bots · ${NOTE}` },
  { id: "sumo", name: "Sumo Smash", text: "Schubs die anderen vom Podest über dem See, gebaut in Unity.", note: `Gegen Bots · ${NOTE}` },
  { id: "bumpercars", name: "Bumper Mayhem", text: "Autoscooter auf der Neonfläche mit Turbo und Item-Kisten, gebaut in Unity.", note: `Gegen Bots · ${NOTE}` },
  { id: "bombs", name: "Bomb Arena", text: "Bomben, Kettenreaktionen und Extras in der Bombenfabrik, gebaut in Unity.", note: `Gegen Bots · ${NOTE}` },
  { id: "snowball", name: "Schneeballschlacht", text: "Formen, werfen, Deckung suchen in der Winterarena, gebaut in Unity.", note: `Gegen Bots · ${NOTE}` },
  { id: "tower", name: "Tower Tumble", text: "Turmrennen mit echter Unity-Physik: Steine kippen, rutschen, stürzen.", note: `Gegen Bots · ${NOTE}` },
  { id: "towersurvival", name: "Tower Tumble – Survival", text: "Bauen ohne Ziellinie, immer schneller: drei verlorene Steine und du bist raus.", note: `Gegen Bots · ${NOTE}` },
  { id: "tuerenlotto", name: "Türenlotto", text: "Parcours-Lauf: echte und falsche Türen, Gassen mit Sackgassen und Falltüren.", note: `Gegen Bots · ${NOTE}` },
  { id: "kreiselkurs", name: "Kreiselkurs", text: "Parcours-Lauf: Drehbalken, fahrende Inseln, Wippen und das Rührwerk.", note: `Gegen Bots · ${NOTE}` },
  { id: "standhaft", name: "Standhaft", text: "Weiche zwei Drehbalken aus und bleib auf den Fallklappen als Letzte stehen.", note: `Gegen Bots · ${NOTE}` },
  { id: "tanks", name: "Tank Trouble", text: "Nutze Abpraller und spreng Ziegelmauern im Panzerlabyrinth.", note: `Gegen Bots · ${NOTE}` }
  // Neue Einträge mit `pendingBuild: true` erst zusammen mit dem WebGL-Build freischalten, damit die Galerie keine fehlenden Szenen startet.
] as const;

export const UNITY_GAMES = UNITY_GAME_CATALOG.filter(game => !("pendingBuild" in game));
export type UnityGameId = typeof UNITY_GAMES[number]["id"];

export const isUnityGame = (id: unknown): id is UnityGameId => UNITY_GAMES.some(game => game.id === id);

/** Address of a game in the shared build, with the chosen figure and the motion preference handed over to Unity. */
export function unityGameUrl(id: string, characterId: string | undefined, reducedMotion: boolean) {
  const query = new URLSearchParams({ spiel: id });
  if (characterId) query.set("figur", characterId);
  if (reducedMotion) query.set("ruhig", "1");
  return `${UNITY_BUILD}?${query.toString()}`;
}
