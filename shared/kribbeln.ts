/** Wertet eine abgeschlossene Zeile. Bei Gleichstand erhalten alle den
 *  niedrigsten belegten Platz; nicht erfüllte Aufgaben ergeben null Punkte. */
export function rankKribbelnResults(results: Record<string, number | null>): Record<string, number> {
  const values = Object.values(results);
  const playerCount = values.length;
  return Object.fromEntries(Object.entries(results).map(([playerId, value]) => {
    if (value === null) return [playerId, 0];
    const atLeastAsGood = values.filter((other) => other !== null && other >= value).length;
    return [playerId, playerCount - atLeastAsGood + 1];
  }));
}

/** Kribbelfelder müssen in ihrer Reihenfolge strikt ansteigen. */
export function canEnterKribbelSum(previous: Array<number | null>, sum: number): boolean {
  if (!Number.isInteger(sum) || sum < 6 || sum > 36) return false;
  return previous.every((value) => value === null || sum > value);
}

export type KribbelColor = "red" | "yellow" | "green" | "blue" | "orange" | "purple";
export type KribbelDie = { value: number; color: KribbelColor };
export const KRIBBEL_COLORS: KribbelColor[] = ["red", "yellow", "green", "blue", "orange", "purple"];
/** Six physical dice: each number/color pair occurs on exactly one of the 36 faces. */
export const KRIBBEL_DICE_FACES: ReadonlyArray<ReadonlyArray<Readonly<KribbelDie>>> = KRIBBEL_COLORS.map((_, die) =>
  Array.from({ length: 6 }, (_, side) => ({ value: side + 1, color: KRIBBEL_COLORS[(side + die) % 6] })));
export const KRIBBEL_ROWS = [
  { label: "Genau ein grüner Würfel", group: 0, task: 0 },
  { label: "Kein gelber Würfel", group: 0, task: 1 },
  { label: "Kribbelfeld 1", group: 0, task: -1 },
  { label: "Genau drei verschiedene Farben", group: 1, task: 2 },
  { label: "Mehr blaue als rote Würfel", group: 1, task: 3 },
  { label: "Kribbelfeld 2", group: 1, task: -1 },
  { label: "Eine Farbe genau viermal", group: 2, task: 4 },
  { label: "Genau zwei Farben jeweils zweimal", group: 2, task: 5 },
  { label: "Kribbelfeld 3", group: 2, task: -1 },
  { label: "Kribbelfeld 4", group: 2, task: -1 }
] as const;

export interface KribbelnGame {
  order: string[];
  names: Record<string, string>;
  row: number;
  playerIndex: number;
  dice: KribbelDie[];
  rolls: number;
  keptDice: number[];
  results: Record<string, Array<number | null>>;
  scores: Record<string, number>;
  finished: boolean;
  winners: string[];
}

export function createKribbelnGame(players: { id: string; name: string }[]): KribbelnGame {
  if (players.length < 2 || players.length > 5) throw new Error("Kribbeln benötigt zwei bis fünf Spieler.");
  return { order: players.map(p => p.id), names: Object.fromEntries(players.map(p => [p.id, p.name])), row: 0, playerIndex: 0,
    dice: [], rolls: 0, keptDice: [], results: Object.fromEntries(players.map(p => [p.id, Array(10).fill(-1)])),
    scores: Object.fromEntries(players.map(p => [p.id, 0])), finished: false, winners: [] };
}

export function kribbelTaskMet(task: number, dice: KribbelDie[]): boolean {
  if (dice.length !== 6) return false;
  const count = (color: KribbelColor) => dice.filter(d => d.color === color).length;
  const counts = KRIBBEL_COLORS.map(count);
  switch (task) {
    case -1: return true;
    case 0: return count("green") === 1;
    case 1: return count("yellow") === 0;
    case 2: return counts.filter(n => n > 0).length === 3;
    case 3: return count("blue") > count("red");
    case 4: return counts.some(n => n === 4);
    case 5: return counts.filter(n => n === 2).length === 2;
    default: return false;
  }
}

function checkTurn(game: KribbelnGame, playerId: string) {
  if (game.finished || game.order[game.playerIndex] !== playerId) throw new Error("Du bist gerade nicht am Zug.");
}

export function rollKribbeln(current: KribbelnGame, playerId: string, keep: number[], random = Math.random): KribbelnGame {
  checkTurn(current, playerId);
  if (current.rolls >= 3) throw new Error("Du hast bereits dreimal gewürfelt.");
  if (!Array.isArray(keep) || keep.some(i => !Number.isInteger(i) || i < 0 || i >= 6) || (current.rolls === 0 && keep.length)) throw new Error("Ungültige Würfelauswahl.");
  const game = structuredClone(current);
  game.dice = Array.from({ length: 6 }, (_, i) => {
    if (keep.includes(i)) return game.dice[i];
    const side = Math.floor(random() * 6);
    return { ...KRIBBEL_DICE_FACES[i][side] };
  });
  game.keptDice = [...new Set(keep)];
  game.rolls++;
  return game;
}

function advance(game: KribbelnGame, random: () => number) {
  const row = game.row;
  const pending = game.order.findIndex(id => game.results[id][row] === -1);
  if (pending >= 0) { game.playerIndex = pending; return; }
  const scores = rankKribbelnResults(Object.fromEntries(game.order.map(id => [id, game.results[id][row] ?? null])));
  game.order.forEach(id => { game.scores[id] += scores[id]; });
  game.row++;
  if (game.row === KRIBBEL_ROWS.length) {
    game.finished = true;
    const max = Math.max(...Object.values(game.scores));
    const tied = game.order.filter(id => game.scores[id] === max);
    const bestLast = Math.max(...tied.map(id => game.results[id][9] ?? 0));
    game.winners = tied.filter(id => (game.results[id][9] ?? 0) === bestLast);
    return;
  }
  const next = game.order.findIndex(id => game.results[id][game.row] === -1);
  if (next < 0) return advance(game, random);
  const best = Math.max(...game.order.map(id => game.results[id][row] ?? 0));
  // Bei Gleichstand entscheidet ein Stichwurf. Gleich hohe Stichwürfe
  // werden nur unter den noch beteiligten Spielern wiederholt.
  let candidates = game.order.filter(id => (game.results[id][row] ?? 0) === best);
  for (let attempt = 0; candidates.length > 1 && attempt < 100; attempt++) {
    const throws = candidates.map(id => ({ id, value: Math.floor(random() * 6) + 1 }));
    const highest = Math.max(...throws.map(entry => entry.value));
    candidates = throws.filter(entry => entry.value === highest).map(entry => entry.id);
  }
  const first = game.order.indexOf(candidates[0]);
  game.playerIndex = game.order.findIndex((_, offset) => game.results[game.order[(first + offset) % game.order.length]][game.row] === -1);
  game.playerIndex = (first + game.playerIndex) % game.order.length;
}

export function submitKribbeln(current: KribbelnGame, playerId: string, choice: "score" | "skip" | "fallback", random = Math.random): KribbelnGame {
  checkTurn(current, playerId);
  if (!["score", "skip", "fallback"].includes(choice)) throw new Error("Ungültige Auswahl.");
  if (!current.rolls || current.dice.length !== 6) throw new Error("Bitte zuerst würfeln.");
  const game = structuredClone(current);
  const row = KRIBBEL_ROWS[game.row];
  const sum = game.dice.reduce((a, d) => a + d.value, 0);
  const met = kribbelTaskMet(row.task, game.dice);
  const cribRows = [2, 5, 8, 9];
  const previous = cribRows.filter(i => i < game.row && (game.results[playerId][i] ?? -1) >= 0).map(i => game.results[playerId][i] ?? null);
  if (choice === "fallback") {
    if (row.task === -1 || met) throw new Error("Ausweichen ist nur bei einer nicht erfüllten Aufgabe möglich.");
    const target = cribRows.find(i => KRIBBEL_ROWS[i].group === row.group && game.results[playerId][i] === -1);
    const preceding = target === undefined ? [] : cribRows.filter(i => i < target && (game.results[playerId][i] ?? -1) >= 0).map(i => game.results[playerId][i] ?? null);
    if (target === undefined || !canEnterKribbelSum(preceding, sum)) throw new Error("Kein passendes Kribbelfeld für diese Summe verfügbar.");
    game.results[playerId][target] = sum;
    game.dice = []; game.rolls = 0; game.keptDice = [];
    return game;
  }
  if (choice === "score" && (!met || (row.task === -1 && !canEnterKribbelSum(previous, sum)))) throw new Error("Das Ergebnis erfüllt die Aufgabe nicht.");
  game.results[playerId][game.row] = choice === "score" ? sum : null;
  game.dice = []; game.rolls = 0; game.keptDice = [];
  const start = game.playerIndex;
  const next = game.order.findIndex((_, offset) => game.results[game.order[(start + 1 + offset) % game.order.length]][game.row] === -1);
  if (next >= 0) game.playerIndex = (start + 1 + next) % game.order.length;
  else advance(game, random);
  return game;
}
