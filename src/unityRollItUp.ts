import { activePartyPlayer, ITEMS, ITEM_IDS, type Item, type PartyAction, type PartyGame } from "../shared/party";
import { boardDistances, boardPathTo, boardRoute, FIELD_LABELS, fieldName, goalField, hasFullSet, partyBoard, partyPaths, stationAt, stationsOf, type PartyBoardState } from "../shared/partyBoard";
import { FIELD_HELP } from "./lib/partyFieldVisuals";
import { unityGameUrl } from "./unityGames";

/**
 * Bridge between the Roll It Up! rules (shared/party.ts, unchanged) and the Unity board
 * (public/unity/rollitup). Unity only draws and sends actions; this module turns the party
 * state into a flat snapshot that Unity's JsonUtility can read (no maps, no optional nesting)
 * and checks the actions coming back before they reach the room authority.
 */
export const UNITY_ROLL_IT_UP_URL = unityGameUrl("rollitup", undefined, false);

export interface UnityRollField { id: number; x: number; z: number; type: string; next: number[]; station: string; price: number; name: string; help: string }
export interface UnityRollItem { id: Item; name: string; icon: string; description: string; price: number; affordable: boolean }
export interface UnityRollPlayer {
  id: string; name: string; characterId: string; slot: number; position: number; coins: number;
  supplies: number[]; items: string[]; bot: boolean; shield: boolean; active: boolean; me: boolean;
}
export interface UnityRollPath { field: number; title: string; detail: string; route: number[] }
export interface UnityRollState {
  type: "state";
  serverNow: number; phase: string; phaseId: number; round: number; turn: number;
  viewer: string; active: string; canAct: boolean; busy: boolean; connected: boolean; error: string; deadline: number;
  dice: number[]; diceKey: string; boost: number; steps: number; itemUsed: boolean;
  moving: boolean; moveFrom: number; moveTo: number; departAt: number; arriveAt: number;
  players: UnityRollPlayer[]; order: string[];
  headline: string; status: string;
  paths: UnityRollPath[];
  supplyName: string; supplyPrice: number; supplyAffordable: boolean;
  shop: UnityRollItem[]; gift: string; giftName: string; giftDescription: string; needsReplace: boolean; ownItems: string[];
  summary: string; summaryType: string;
  objectiveField: number; objectiveText: string; route: number[];
  log: string[]; reduced: boolean;
}

/** Static board: positions in [-1, 1] across the bowl, field types, links and stations. */
export function unityRollBoard(game: PartyBoardState = { mode: "roll-it-up" }): { type: "board"; fields: UnityRollField[] } {
  const board = partyBoard(game), goal = goalField(game);
  return {
    type: "board",
    fields: board.map(field => {
      const station = stationAt(game, field.id);
      const help = field.id === goal ? "Mit vollständigem Set gewinnst du bei Ankunft."
        : station ? `Kaufstelle: ${station.name} beim Passieren für ${station.price} Münzen kaufen.` : FIELD_HELP[field.type];
      return {
        id: field.id, x: (field.x - 50) / 50, z: (field.y - 50) / 50,
        type: field.id === 0 ? "start" : field.id === goal ? "jayspot" : station ? "station" : field.type,
        next: [...field.next], station: station?.name ?? "", price: station?.price ?? 0, name: fieldName(game, field.id), help
      };
    })
  };
}

export function unityRollState(g: PartyGame, viewer: string, extra: { serverNow: number; busy: boolean; connected: boolean; error: string; reduced: boolean }): UnityRollState {
  const p = activePartyPlayer(g), own = g.players.find(player => player.id === viewer) ?? p, canAct = p.id === viewer && !g.pausedAt;
  const board = partyBoard(g), station = stationAt(g, p.position);
  // Same wording as the web board's path buttons (src/components/RollItUpBoard.tsx).
  const paths = g.phase === "path" ? partyPaths(g, p).map((field, index) => {
    const preview = boardRoute(g, p, field, g.steps), last = preview.fields.at(-1) ?? field, next = preview.stations.find(s => !s.owned);
    const detail = next ? `${next.name} in ${next.steps} ${next.steps === 1 ? "Schritt" : "Schritten"} · ${next.price} Münzen${p.coins < next.price ? ` (noch ${next.price - p.coins} nötig)` : ""}`
      : preview.junction ? "Weitere Wegwahl" : last === goalField(g) ? "Ziel erreicht" : `Landung: ${FIELD_LABELS[board[last].type]}`;
    return { field, title: field === goalField(g) ? "Zum Jayspot" : index === 0 ? "Außenweg" : "Hügelweg", detail, route: [p.position, ...preview.fields] };
  }) : [];
  const distances = boardDistances(g, own), missing = stationsOf(g).filter(s => !own.supplies?.includes(s.field));
  const next = missing.slice().sort((a, b) => (distances.get(a.field) ?? Infinity) - (distances.get(b.field) ?? Infinity))[0];
  const objectiveField = hasFullSet(g, own) ? goalField(g) : next?.field ?? goalField(g);
  const objectiveText = hasFullSet(g, own) ? "Set komplett · auf zum Jayspot" : next ? `${next.name} · ${own.supplies?.includes(next.field) ? "gesammelt" : `${next.price} Münzen`}` : "Jayspot";
  const route = hasFullSet(g, p) && p.id === viewer ? boardPathTo(g, p, goalField(g)) : [];
  const moving = g.phase === "moving" && Boolean(g.movement);
  const fieldType = board[p.position]?.type ?? "safe";
  const who = canAct ? "Du" : p.name;
  const headline = canAct ? `${p.name}, du bist dran!` : `${p.name} ist am Zug`;
  const status = moving ? `${who === "Du" ? "Du ziehst" : `${p.name} zieht`} weiter · noch ${g.steps} ${g.steps === 1 ? "Schritt" : "Schritte"}`
    : g.phase === "turn" ? (canAct ? "Würfeln und losziehen" : `${p.name} würfelt gleich.`)
    : g.phase === "path" ? (canAct ? `Welchen Weg nimmst du? Noch ${g.steps} ${g.steps === 1 ? "Schritt" : "Schritte"}.` : `${p.name} wählt einen Weg.`)
    : g.phase === "supply" ? (canAct ? `${station?.name} für dein Set?` : `${p.name} entscheidet über ${station?.name}.`)
    : g.phase === "shop" ? (canAct ? "Ein Item pro Besuch" : `${p.name} stöbert im Shop.`)
    : g.phase === "gift" ? (canAct ? "Ein Geschenk für dich!" : `${p.name} bekommt ein Geschenk.`)
    : g.phase === "summary" ? (g.log.at(-1)?.replace(`${p.name}: `, "") ?? fieldName(g, p.position))
    : "";
  return {
    type: "state",
    serverNow: extra.serverNow, phase: g.phase, phaseId: g.phaseId, round: g.round, turn: g.turn,
    viewer, active: p.id, canAct, busy: extra.busy, connected: extra.connected, error: extra.error, deadline: g.deadline,
    dice: [...g.dice], diceKey: g.dice.length ? `${g.round}:${g.turn}:${g.dice.join()}` : "", boost: g.boost, steps: g.steps, itemUsed: g.itemUsed,
    moving, moveFrom: moving ? p.position : -1, moveTo: moving ? g.movement!.destination : -1,
    departAt: moving ? g.movement!.departAt : 0, arriveAt: moving ? g.movement!.arriveAt : 0,
    players: g.players.map((player, slot) => ({
      id: player.id, name: player.name, characterId: player.characterId ?? "", slot, position: player.position, coins: player.coins,
      supplies: [...(player.supplies ?? [])], items: player.items.map(item => ITEMS[item].name), bot: Boolean(player.bot), shield: player.shield,
      active: player.id === p.id, me: player.id === viewer
    })),
    order: [...g.order],
    headline, status, paths,
    supplyName: g.phase === "supply" ? station?.name ?? "" : "", supplyPrice: g.phase === "supply" ? station?.price ?? 0 : 0, supplyAffordable: Boolean(station && p.coins >= station.price),
    shop: g.phase === "shop" ? ITEM_IDS.map(id => ({ id, ...ITEMS[id], affordable: p.coins >= ITEMS[id].price })) : [],
    gift: g.phase === "gift" ? g.offered ?? "" : "", giftName: g.phase === "gift" && g.offered ? ITEMS[g.offered].name : "", giftDescription: g.phase === "gift" && g.offered ? ITEMS[g.offered].description : "",
    needsReplace: p.items.length >= 3, ownItems: p.items.map(item => ITEMS[item].name),
    summary: g.phase === "summary" ? status : "", summaryType: g.phase === "summary" ? fieldType : "",
    objectiveField, objectiveText, route,
    log: g.log.slice(-3), reduced: extra.reduced
  };
}

/** Actions Unity may send: only board decisions of the viewer's own turn. */
const BOARD_ACTIONS = new Set(["roll", "path", "supply", "shop", "gift", "next"]);

export function unityRollAction(g: PartyGame, viewer: string, raw: unknown): PartyAction | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const action = raw as Record<string, unknown>;
  if (typeof action.type !== "string" || !BOARD_ACTIONS.has(action.type) || activePartyPlayer(g).id !== viewer) return undefined;
  const replace = Number.isInteger(action.replace) && (action.replace as number) >= 0 ? action.replace as number : 0;
  switch (action.type) {
    case "roll": return g.phase === "turn" ? { type: "roll" } : undefined;
    case "path": return g.phase === "path" && typeof action.destination === "number" ? { type: "path", destination: action.destination } : undefined;
    case "supply": return g.phase === "supply" && typeof action.buy === "boolean" ? { type: "supply", buy: action.buy } : undefined;
    case "shop": return g.phase !== "shop" ? undefined : action.item === "" || action.item === undefined ? { type: "shop" } : ITEM_IDS.includes(action.item as Item) ? { type: "shop", item: action.item as Item, replace } : undefined;
    case "gift": return g.phase === "gift" && typeof action.accept === "boolean" ? { type: "gift", accept: action.accept, replace } : undefined;
    case "next": return g.phase === "summary" ? { type: "next" } : undefined;
  }
  return undefined;
}
