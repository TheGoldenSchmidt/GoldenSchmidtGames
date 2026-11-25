/** `duel` fields (Inselparty) start a 1v1 duel for coins; Roll It Up keeps them as plain `safe` fields. */
/** `tunnel` (Roll It Up!, Grinder): landing there sends the figure through the pneumatic tube to its partner field. */
export type Field = "start" | "coin" | "bad" | "event" | "gift" | "shop" | "duel" | "safe" | "tunnel";
export const FIELD_LABELS: Record<Field, string> = { start: "Hafen", coin: "+3 Münzen", bad: "−3 Münzen", event: "Ereignis", gift: "Geschenk", shop: "Shop", duel: "Duell", safe: "Aussicht", tunnel: "Rohrpost" };
export const FIELD_ICONS: Record<Field, string> = { start: "⚑", coin: "+", bad: "−", event: "?", gift: "◇", shop: "▣", duel: "⚔", safe: "·", tunnel: "⇄" };
export interface BoardField { id: number; x: number; y: number; type: Field; next: number[] }
export const BOARD = Array.from({ length: 34 }, (_, id) => {
  const has = (numbers: number[]) => numbers.includes(id);
  const type: Field = id === 0 ? "start" : has([1,3,7,9,11,14,17,20,23,25,28]) ? "coin" : has([5,13,19,26,32]) ? "bad" : has([4,10,16,22,29,33]) ? "event" : has([2,12,21,30]) ? "gift" : has([6,15,24]) ? "shop" : "duel";
  const next = id === 8 ? [9,28] : id === 18 ? [19,31] : id === 30 ? [12] : id === 33 ? [22] : id === 27 ? [0] : [id + 1];
  const angle = ((id / 28) * Math.PI * 2) - Math.PI / 2;
  const branch: Record<number, [number, number]> = { 28:[61,32],29:[55,40],30:[48,47],31:[39,66],32:[44,57],33:[51,61] };
  const [x,y] = branch[id] ?? [50 + 40 * Math.cos(angle), 50 + 40 * Math.sin(angle)];
  return { id, type, next, x, y };
});

export interface PartyBoardState { mode?: import("./party").PartyGame["mode"]; round?: number; opening?: boolean; options?: { rounds: number; board?: RollBoardId } }

/** Inselparty only: the last three rounds double the plus and minus fields. */
export const FINAL_ROUNDS = 3;
export const TROPHY_SHOPS = [6, 15, 24] as const;
export function isFinalStretch(game: PartyBoardState) {
  return (game.mode ?? "party") === "party" && !game.opening && game.options !== undefined && game.round !== undefined && game.round > game.options.rounds - FINAL_ROUNDS;
}
export const fieldCoins = (game: PartyBoardState) => isFinalStretch(game) ? 6 : 3;
/** Field label with its current effect (the plus and minus fields change in the last rounds). */
export function fieldLabel(game: PartyBoardState, type: Field) {
  if (type === "coin") return `+${fieldCoins(game)} Münzen`;
  if (type === "bad") return `−${fieldCoins(game)} Münzen`;
  return FIELD_LABELS[type];
}
export interface Collector { position: number; supplies?: number[] }
export interface RollStation { field: number; name: string; price: number }
/** A Roll It Up! board: fields (x/y in 0–100 across the tray), six purchase stations and the goal. */
export interface RollBoard { id: RollBoardId; name: string; detail: string; fields: BoardField[]; stations: readonly RollStation[]; goal: number; tunnels: Readonly<Record<number, number>> }
export type RollBoardId = "bauschale" | "grinder";
export const ROLL_BOARD_IDS: readonly RollBoardId[] = ["bauschale", "grinder"];
export const isRollBoardId = (id: unknown): id is RollBoardId => typeof id === "string" && (ROLL_BOARD_IDS as readonly string[]).includes(id);

const UTENSILS = [{ name: "Grinder", price: 8 }, { name: "Weedbud I", price: 5 }, { name: "Pape", price: 3 }, { name: "Weedbud II", price: 5 }, { name: "Filter", price: 3 }, { name: "Weedbud III", price: 5 }] as const;
const stationsOn = (fields: number[]) => UTENSILS.map((u, i) => ({ field: fields[i], ...u }));

/** Die Bauschale: one ring, two hill paths and the bench on the hill. */
const BAUSCHALE_GOAL = 34;
const hillside = [[72,59],[60,56],[31,67],[40,59],[50,50]];
const bowlForks: Record<number, number[]> = {8:[9,30],18:[19,32],29:[0],31:[12,BAUSCHALE_GOAL],33:[22,BAUSCHALE_GOAL],34:[]};
const bowlBoard: BoardField[] = Array.from({ length: BAUSCHALE_GOAL + 1 }, (_, id) => {
  const angle = id * Math.PI / 15 - Math.PI / 2;
  const [x, y] = hillside[id - 30] ?? [50 + 39 * Math.cos(angle), 50 + 39 * Math.sin(angle)];
  const type = BOARD[id]?.type;
  return {id, x, y, type: !type || type === "duel" ? "safe" as const : type, next: bowlForks[id] ?? [id + 1]};
});

/**
 * Der Grinder: an outer ring (clockwise, 24 fields) and an inner ring (counter-clockwise, 12 fields),
 * four spokes in and four spokes out, two pneumatic tubes and the lounge in the middle.
 * Ids: outer 0–23, spokes in 24–27, inner 28–39, spokes out 40–43, goal 44.
 */
const GRINDER_GOAL = 44;
const at = (radius: number, degrees: number) => [50 + radius * Math.cos(degrees * Math.PI / 180), 50 + radius * Math.sin(degrees * Math.PI / 180)] as const;
const outerTypes: Field[] = ["start","gift","coin","safe","coin","coin","event","tunnel","coin","safe","bad","event","shop","gift","coin","safe","coin","coin","event","tunnel","coin","shop","bad","bad"];
const innerTypes: Field[] = ["coin","safe","event","safe","bad","tunnel","safe","coin","gift","safe","bad","tunnel"];
/** Outer fork → inner field (spokes in) and inner fork → outer field (spokes out). */
const spokesIn = [[5,3],[11,6],[17,9],[23,0]] as const, spokesOut = [[1,2],[4,8],[7,14],[10,20]] as const;
const inner = (j: number) => 28 + ((j % 12) + 12) % 12;
const grinderBoard: BoardField[] = [
  ...outerTypes.map((type, i) => {
    const spoke = spokesIn.findIndex(([from]) => from === i);
    const [x, y] = at(40, -90 + i * 15);
    return { id: i, x, y, type, next: spoke >= 0 ? [(i + 1) % 24, 24 + spoke] : [(i + 1) % 24] };
  }),
  ...spokesIn.map(([from, to], k) => { const [x, y] = at(31, -90 + from * 15 + 4); return { id: 24 + k, x, y, type: (["coin","gift","coin","event"] as Field[])[k], next: [inner(to)] }; }),
  ...innerTypes.map((type, j) => {
    const out = spokesOut.findIndex(([from]) => from === j), toGoal = j === 2 || j === 8;
    const [x, y] = at(22, -90 + j * 30);
    return { id: inner(j), x, y, type, next: [inner(j - 1), ...(out >= 0 ? [40 + out] : []), ...(toGoal ? [GRINDER_GOAL] : [])] };
  }),
  ...spokesOut.map(([from, to], k) => { const [x, y] = at(31, -90 + from * 30 - 4); return { id: 40 + k, x, y, type: (["bad","coin","gift","coin"] as Field[])[k], next: [to] }; }),
  { id: GRINDER_GOAL, x: 50, y: 50, type: "safe", next: [] }
];

export const ROLL_BOARDS: Record<RollBoardId, RollBoard> = {
  bauschale: { id: "bauschale", name: "Die Bauschale", detail: "Ein Rundweg und zwei Hügelpfade zur Bank.", fields: bowlBoard, stations: stationsOn([2,7,12,17,22,27]), goal: BAUSCHALE_GOAL, tunnels: {} },
  grinder: { id: "grinder", name: "Der Grinder", detail: "Zwei gegenläufige Ringe, acht Speichen und zwei Rohrposten.", fields: grinderBoard, stations: stationsOn([3,9,inner(3),15,inner(6),inner(9)]), goal: GRINDER_GOAL, tunnels: { 7: 19, 19: 7, [inner(5)]: inner(11), [inner(11)]: inner(5) } }
};

/** The Roll It Up! board of a game (the Bauschale unless chosen otherwise). */
export function rollBoard(game: PartyBoardState): RollBoard { return ROLL_BOARDS[game.options?.board ?? "bauschale"] ?? ROLL_BOARDS.bauschale; }
export const stationsOf = (game: PartyBoardState) => rollBoard(game).stations;
export const goalField = (game: PartyBoardState) => rollBoard(game).goal;
export const stationAt = (game: PartyBoardState, id: number) => game.mode === "roll-it-up" ? stationsOf(game).find(station => station.field === id) : undefined;
export const hasFullSet = (game: PartyBoardState, p: Collector) => stationsOf(game).every(s => p.supplies?.includes(s.field));
/** Shops a compass can travel to. */
export const shopFields = (game: PartyBoardState) => partyBoard(game).filter(f => f.type === "shop").map(f => f.id);
export function partyBoard(game: PartyBoardState): BoardField[] {
  return game.mode === "roll-it-up" ? rollBoard(game).fields : BOARD;
}
export function partyPaths(game: PartyBoardState, p: Collector, position = p.position) {
  const paths = partyBoard(game)[position].next, goal = game.mode === "roll-it-up" ? goalField(game) : -1;
  return paths.includes(goal) && !hasFullSet(game, p) ? paths.filter(id => id !== goal) : paths;
}
/**
 * Title of a path choice (Roll It Up!). Bauschale: outer path and hill path. Grinder: staying on the
 * ring or taking a spoke, read from the distance to the centre.
 */
export function pathTitle(game: PartyBoardState, from: number, to: number, index: number) {
  if (to === goalField(game)) return "Zum Jayspot";
  if (rollBoard(game).id !== "grinder") return index === 0 ? "Außenweg" : "Hügelweg";
  const board = partyBoard(game), radius = (id: number) => Math.hypot(board[id].x - 50, board[id].y - 50);
  const change = radius(to) - radius(from);
  if (Math.abs(change) < 4) return radius(from) > 30 ? "Außenring weiter" : "Innenring weiter";
  return change < 0 ? "Speiche nach innen" : "Speiche nach außen";
}
export function fieldName(game: PartyBoardState, id: number) {
  if (game.mode === "roll-it-up") {
    if (id === goalField(game)) return "Jayspot";
    if (id === 0) return "Start";
    const station = stationAt(game, id);
    if (station) return station.name;
  }
  return fieldLabel(game, partyBoard(game)[id].type);
}

/** Deterministic route up to the next decision. Purchases are never assumed. */
export function boardRoute(game: PartyBoardState, player: Collector, destination: number, steps: number) {
  const board = partyBoard(game), fields: number[] = [];
  let current = destination, junction = false, couldCompleteSet = false;
  const possibleSupplies = new Set(player.supplies);
  if (!Number.isFinite(steps) || !partyPaths(game, player).includes(destination)) return { fields, junction, stations: [] };
  for (let left = Math.max(0, Math.floor(steps)); left > 0; left--) {
    fields.push(current);
    if (stationAt(game, current)) {
      possibleSupplies.add(current);
      couldCompleteSet = !hasFullSet(game, player) && stationsOf(game).every(s => possibleSupplies.has(s.field));
    }
    if (left === 1 || !board[current].next.length) break;
    const next = partyPaths(game, player, current);
    if (next.length > 1 || (couldCompleteSet && board[current].next.includes(goalField(game)))) { junction = true; break; }
    current = next[0];
  }
  return { fields, junction, stations: game.mode === "roll-it-up" ? fields.flatMap((field, index) => {
    const station = stationAt(game, field);
    return station ? [{ ...station, steps: index + 1, owned: Boolean(player.supplies?.includes(field)) }] : [];
  }) : [] };
}

function traceBoard(game: PartyBoardState, player: Collector) {
  const distances = new Map<number, number>([[player.position, 0]]), previous = new Map<number, number>(), queue = [player.position];
  for (let index = 0; index < queue.length; index++) {
    const field = queue[index];
    for (const next of partyPaths(game, player, field)) if (!distances.has(next)) {
      distances.set(next, distances.get(field)! + 1); previous.set(next, field); queue.push(next);
    }
  }
  return { distances, previous };
}

/** Directed legal walking distances, without assuming a particular die roll. */
export function boardDistances(game: PartyBoardState, player: Collector) {
  return traceBoard(game, player).distances;
}

/** A shortest legal route to a target, including the current field. */
export function boardPathTo(game: PartyBoardState, player: Collector, target: number) {
  const { distances, previous } = traceBoard(game, player);
  if (!distances.has(target)) return [];
  const route = [target];
  while (route.at(-1) !== player.position) route.push(previous.get(route.at(-1)!)!);
  return route.reverse();
}
