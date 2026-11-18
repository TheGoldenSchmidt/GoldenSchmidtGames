export type Field = "start" | "coin" | "bad" | "event" | "gift" | "shop" | "safe";
export const FIELD_LABELS: Record<Field, string> = { start: "Hafen", coin: "+3 Münzen", bad: "−3 Münzen", event: "Ereignis", gift: "Geschenk", shop: "Shop", safe: "Aussicht" };
export const FIELD_ICONS: Record<Field, string> = { start: "⚑", coin: "+", bad: "−", event: "?", gift: "◇", shop: "▣", safe: "·" };
export const BOARD = Array.from({ length: 34 }, (_, id) => {
  const has = (numbers: number[]) => numbers.includes(id);
  const type: Field = id === 0 ? "start" : has([1,3,7,9,11,14,17,20,23,25,28]) ? "coin" : has([5,13,19,26,32]) ? "bad" : has([4,10,16,22,29,33]) ? "event" : has([2,12,21,30]) ? "gift" : has([6,15,24]) ? "shop" : "safe";
  const next = id === 8 ? [9,28] : id === 18 ? [19,31] : id === 30 ? [12] : id === 33 ? [22] : id === 27 ? [0] : [id + 1];
  const angle = ((id / 28) * Math.PI * 2) - Math.PI / 2;
  const branch: Record<number, [number, number]> = { 28:[61,32],29:[55,40],30:[48,47],31:[39,66],32:[44,57],33:[51,61] };
  const [x,y] = branch[id] ?? [50 + 40 * Math.cos(angle), 50 + 40 * Math.sin(angle)];
  return { id, type, next, x, y };
});

export interface PartyBoardState { mode?: import("./party").PartyGame["mode"] }
export interface Collector { position: number; supplies?: number[] }
export const BAUSCHALE = { id: "bauschale", name: "Die Bauschale" } as const;

export const STATIONS = [
  { field: 2, name: "Grinder", price: 8 },
  { field: 7, name: "Weedbud I", price: 5 },
  { field: 12, name: "Pape", price: 3 },
  { field: 17, name: "Weedbud II", price: 5 },
  { field: 22, name: "Filter", price: 3 },
  { field: 27, name: "Weedbud III", price: 5 }
] as const;
export const JAYSPOT = 34;
export const stationAt = (id: number) => STATIONS.find(station => station.field === id);
export const hasFullSet = (p: Collector) => STATIONS.every(s => p.supplies?.includes(s.field));

const hillside = [[72,59],[60,56],[31,67],[40,59],[50,50]];
const forks: Record<number, number[]> = {8:[9,30],18:[19,32],29:[0],31:[12,JAYSPOT],33:[22,JAYSPOT],34:[]};
const bowlBoard = Array.from({ length: JAYSPOT + 1 }, (_, id) => {
  const angle = id * Math.PI / 15 - Math.PI / 2;
  const [x, y] = hillside[id - 30] ?? [50 + 39 * Math.cos(angle), 50 + 39 * Math.sin(angle)];
  return {id, x, y, type: BOARD[id]?.type ?? "safe", next: forks[id] ?? [id + 1]};
});
export function partyBoard(game: PartyBoardState) {
  return game.mode === "roll-it-up" ? bowlBoard : BOARD;
}
export function partyPaths(game: PartyBoardState, p: Collector, position = p.position) {
  const paths = partyBoard(game)[position].next;
  return paths.includes(JAYSPOT) && !hasFullSet(p) ? paths.filter(id => id !== JAYSPOT) : paths;
}
export function fieldName(game: PartyBoardState, id: number) {
  if (game.mode === "roll-it-up") {
    if (id === JAYSPOT) return "Jayspot";
    if (id === 0) return "Start";
    const station = stationAt(id);
    if (station) return station.name;
  }
  return FIELD_LABELS[partyBoard(game)[id].type];
}

/** Deterministic route up to the next decision. Purchases are never assumed. */
export function boardRoute(game: PartyBoardState, player: Collector, destination: number, steps: number) {
  const board = partyBoard(game), fields: number[] = [];
  let current = destination, junction = false, couldCompleteSet = false;
  const possibleSupplies = new Set(player.supplies);
  if (!Number.isFinite(steps) || !partyPaths(game, player).includes(destination)) return { fields, junction, stations: [] };
  for (let left = Math.max(0, Math.floor(steps)); left > 0; left--) {
    fields.push(current);
    if (game.mode === "roll-it-up" && stationAt(current)) {
      possibleSupplies.add(current);
      couldCompleteSet = !hasFullSet(player) && STATIONS.every(s => possibleSupplies.has(s.field));
    }
    if (left === 1 || !board[current].next.length) break;
    const next = partyPaths(game, player, current);
    if (next.length > 1 || (couldCompleteSet && board[current].next.includes(JAYSPOT))) { junction = true; break; }
    current = next[0];
  }
  return { fields, junction, stations: game.mode === "roll-it-up" ? fields.flatMap((field, index) => {
    const station = stationAt(field);
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
