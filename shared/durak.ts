import type { DurakCard, DurakGameState, DurakRank, DurakSuit, Player } from "./types";

export const DURAK_SUITS: DurakSuit[] = ["clubs", "diamonds", "hearts", "spades"];
export const DURAK_RANKS: DurakRank[] = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export const DURAK_SUIT_SYMBOLS: Record<DurakSuit, string> = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
export const DURAK_SUIT_NAMES: Record<DurakSuit, string> = { clubs: "Kreuz", diamonds: "Karo", hearts: "Herz", spades: "Pik" };

function clone<T>(value: T): T {
  return structuredClone(value);
}

function addLog(game: DurakGameState, message: string) {
  game.log = [...game.log.slice(-9), message];
}

function shuffle<T>(values: T[], random = Math.random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function rankValue(rank: DurakRank) {
  return DURAK_RANKS.indexOf(rank);
}

function nextActive(game: DurakGameState, playerId: string) {
  const start = game.playerOrder.indexOf(playerId);
  for (let offset = 1; offset <= game.playerOrder.length; offset += 1) {
    const candidate = game.playerOrder[(start + offset) % game.playerOrder.length];
    if (!game.finishedPlayerIds.includes(candidate) && game.handCounts[candidate] > 0) return candidate;
  }
  return playerId;
}

function removeCard(game: DurakGameState, playerId: string, cardId: string) {
  const index = game.hands[playerId]?.findIndex((card) => card.id === cardId) ?? -1;
  if (index < 0) throw new Error("Diese Karte befindet sich nicht auf deiner Hand.");
  const [card] = game.hands[playerId].splice(index, 1);
  return card;
}

function syncCounts(game: DurakGameState) {
  for (const id of game.playerOrder) game.handCounts[id] = game.hands[id].length;
}

function tableRanks(game: DurakGameState) {
  return new Set(game.table.flatMap((pair) => [pair.attack.rank, pair.defense?.rank].filter(Boolean) as DurakRank[]));
}

function drawToSix(game: DurakGameState, playerId: string) {
  while (game.hands[playerId].length < 6 && game.deck.length > 0) {
    game.hands[playerId].push(game.deck.pop()!);
  }
}

function replenish(game: DurakGameState, attackerId: string, defenderId: string) {
  let current = attackerId;
  const order: string[] = [];
  for (let count = 0; count < game.playerOrder.length; count += 1) {
    if (current !== defenderId) order.push(current);
    current = game.playerOrder[(game.playerOrder.indexOf(current) + 1) % game.playerOrder.length];
  }
  order.push(defenderId);
  for (const id of order) drawToSix(game, id);
  syncCounts(game);
}

function updateFinished(game: DurakGameState) {
  if (game.deck.length > 0) return;
  for (const id of game.playerOrder) {
    if (game.hands[id].length === 0 && !game.finishedPlayerIds.includes(id)) game.finishedPlayerIds.push(id);
  }
  const remaining = game.playerOrder.filter((id) => !game.finishedPlayerIds.includes(id));
  if (remaining.length <= 1) {
    game.phase = "finished";
    game.durakId = remaining[0] ?? null;
    addLog(game, game.durakId ? `${game.playerNames[game.durakId]} ist der Durak.` : "Alle Karten sind abgelegt.");
  }
}

export function canBeatDurak(attack: DurakCard, defense: DurakCard, trumpSuit: DurakSuit) {
  if (defense.suit === attack.suit) return rankValue(defense.rank) > rankValue(attack.rank);
  return defense.suit === trumpSuit && attack.suit !== trumpSuit;
}

export function createDurakGame(players: Pick<Player, "id" | "name">[], random = Math.random, cheatMode = false): DurakGameState {
  if (players.length < 2 || players.length > 6) throw new Error("Durak benötigt zwei bis sechs Spieler.");
  const deck = shuffle(DURAK_SUITS.flatMap((suit) => DURAK_RANKS.map((rank) => ({ id: `${suit}-${rank}`, suit, rank }))), random);
  const trumpCard = deck[0];
  const hands = Object.fromEntries(players.map((player) => [player.id, [] as DurakCard[]])) as Record<string, DurakCard[]>;
  for (let round = 0; round < 6; round += 1) {
    for (const player of players) hands[player.id].push(deck.pop()!);
  }
  const trumpHolders = players.flatMap((player) => hands[player.id]
    .filter((card) => card.suit === trumpCard.suit)
    .map((card) => ({ id: player.id, value: rankValue(card.rank) })));
  const attackerId = (trumpHolders.sort((a, b) => a.value - b.value)[0]?.id) ?? players[0].id;
  const attackerIndex = players.findIndex((player) => player.id === attackerId);
  const defenderId = players[(attackerIndex + 1) % players.length].id;
  return {
    playerOrder: players.map((player) => player.id),
    playerNames: Object.fromEntries(players.map((player) => [player.id, player.name])),
    hands,
    handCounts: Object.fromEntries(players.map((player) => [player.id, hands[player.id].length])),
    deck,
    trumpSuit: trumpCard.suit,
    trumpCard,
    attackerId,
    defenderId,
    phase: "attack",
    table: [],
    maxAttackCards: Math.min(6, hands[defenderId].length),
    defenderTakes: false,
    finishedPlayerIds: [],
    durakId: null,
    cheatMode,
    cheatBannedPlayerIds: [],
    accusationUsedPlayerIds: [],
    log: [`${players.find((player) => player.id === attackerId)!.name} greift an.`]
  };
}

export function attackDurak(current: DurakGameState, playerId: string, cardId: string) {
  if (current.phase !== "attack" || current.attackerId !== playerId) throw new Error("Du kannst gerade nicht angreifen.");
  const game = clone(current);
  const card = removeCard(game, playerId, cardId);
  game.table = [{ attack: card, attackPlayedBy: playerId }];
  game.phase = "defend";
  syncCounts(game);
  addLog(game, `${game.playerNames[playerId]} greift mit ${card.rank}${DURAK_SUIT_SYMBOLS[card.suit]} an.`);
  return game;
}

export function defendDurak(current: DurakGameState, playerId: string, attackCardId: string, defenseCardId: string) {
  if (current.phase !== "defend" || current.defenderId !== playerId) throw new Error("Du bist gerade nicht in der Verteidigung.");
  const pair = current.table.find((entry) => entry.attack.id === attackCardId && !entry.defense);
  const defense = current.hands[playerId]?.find((card) => card.id === defenseCardId);
  if (!pair || !defense || !canBeatDurak(pair.attack, defense, current.trumpSuit)) throw new Error("Diese Karte kann den Angriff nicht schlagen.");
  const game = clone(current);
  const target = game.table.find((entry) => entry.attack.id === attackCardId)!;
  target.defense = removeCard(game, playerId, defenseCardId);
  target.defensePlayedBy = playerId;
  target.defenseIllegal = false;
  syncCounts(game);
  if (game.table.every((entry) => entry.defense)) game.phase = "throw-in";
  return game;
}

export function transferDurak(current: DurakGameState, playerId: string, cardId: string) {
  if (current.phase !== "defend" || current.defenderId !== playerId) throw new Error("Du kannst gerade nicht weiterschieben.");
  if (current.table.some((pair) => pair.defense)) throw new Error("Nach dem ersten Decken kann nicht mehr weitergeschoben werden.");
  const card = current.hands[playerId]?.find((entry) => entry.id === cardId);
  if (!card || !current.table.some((pair) => pair.attack.rank === card.rank)) throw new Error("Zum Weiterschieben wird derselbe Kartenwert benötigt.");
  const nextDefender = nextActive(current, playerId);
  const nextLimit = Math.min(6, current.hands[nextDefender].length);
  if (current.table.length + 1 > nextLimit) throw new Error("Der nächste Spieler hat nicht genügend Karten für diesen Angriff.");
  const game = clone(current);
  game.table.push({ attack: removeCard(game, playerId, cardId), attackPlayedBy: playerId, attackIllegal: false });
  game.attackerId = playerId;
  game.defenderId = nextDefender;
  game.maxAttackCards = nextLimit;
  syncCounts(game);
  addLog(game, `${game.playerNames[playerId]} schiebt an ${game.playerNames[nextDefender]} weiter.`);
  return game;
}

export function takeDurak(current: DurakGameState, playerId: string) {
  if (current.phase !== "defend" || current.defenderId !== playerId) throw new Error("Du kannst diese Karten gerade nicht aufnehmen.");
  const game = clone(current);
  game.phase = "throw-in";
  game.defenderTakes = true;
  addLog(game, `${game.playerNames[playerId]} nimmt auf.`);
  return game;
}

export function throwInDurak(current: DurakGameState, playerId: string, cardId: string) {
  if (current.phase !== "throw-in" || current.attackerId !== playerId) throw new Error("Du kannst gerade nicht nachlegen.");
  if (current.table.length >= current.maxAttackCards) throw new Error("Es können keine weiteren Karten nachgelegt werden.");
  const card = current.hands[playerId]?.find((entry) => entry.id === cardId);
  if (!card || !tableRanks(current).has(card.rank)) throw new Error("Es darf nur ein bereits ausliegender Kartenwert nachgelegt werden.");
  const game = clone(current);
  game.table.push({ attack: removeCard(game, playerId, cardId), attackPlayedBy: playerId, attackIllegal: false });
  if (!game.defenderTakes) game.phase = "defend";
  syncCounts(game);
  return game;
}

export function finishDurakBout(current: DurakGameState, playerId: string) {
  if (current.phase !== "throw-in" || current.attackerId !== playerId) throw new Error("Du kannst die Runde gerade nicht beenden.");
  const game = clone(current);
  const oldAttacker = game.attackerId;
  const oldDefender = game.defenderId;
  if (game.defenderTakes) {
    game.hands[oldDefender].push(...game.table.flatMap((pair) => [pair.attack, ...(pair.defense ? [pair.defense] : [])]));
  }
  game.table = [];
  replenish(game, oldAttacker, oldDefender);
  updateFinished(game);
  if (game.phase === "finished") return game;
  const nextAttacker = game.defenderTakes ? nextActive(game, oldDefender) : oldDefender;
  game.attackerId = game.finishedPlayerIds.includes(nextAttacker) ? nextActive(game, nextAttacker) : nextAttacker;
  game.defenderId = nextActive(game, game.attackerId);
  game.maxAttackCards = Math.min(6, game.hands[game.defenderId].length);
  game.phase = "attack";
  game.defenderTakes = false;
  game.accusationUsedPlayerIds = [];
  syncCounts(game);
  addLog(game, `${game.playerNames[game.attackerId]} greift an.`);
  return game;
}

export function canTransferDurak(game: DurakGameState, playerId: string, cardId: string) {
  if (game.phase !== "defend" || game.defenderId !== playerId || game.table.some((pair) => pair.defense)) return false;
  const card = game.hands[playerId]?.find((entry) => entry.id === cardId);
  const nextDefender = nextActive(game, playerId);
  return Boolean(card && game.table.some((pair) => pair.attack.rank === card.rank) && game.table.length + 1 <= Math.min(6, game.handCounts[nextDefender]));
}

export function canThrowInDurak(game: DurakGameState, playerId: string, cardId: string) {
  const card = game.hands[playerId]?.find((entry) => entry.id === cardId);
  return game.phase === "throw-in" && game.attackerId === playerId && game.table.length < game.maxAttackCards && Boolean(card && tableRanks(game).has(card.rank));
}

function assertCanCheat(game: DurakGameState, playerId: string) {
  if (!game.cheatMode) throw new Error("Der Schummelmodus ist für diese Partie nicht aktiviert.");
  if (game.cheatBannedPlayerIds.includes(playerId)) throw new Error("Du wurdest bereits erwischt und darfst nicht mehr schummeln.");
}

export function cheatDefendDurak(current: DurakGameState, playerId: string, attackCardId: string, defenseCardId: string) {
  assertCanCheat(current, playerId);
  if (current.phase !== "defend" || current.defenderId !== playerId) throw new Error("Du bist gerade nicht in der Verteidigung.");
  const pair = current.table.find((entry) => entry.attack.id === attackCardId && !entry.defense);
  const defense = current.hands[playerId]?.find((card) => card.id === defenseCardId);
  if (!pair || !defense) throw new Error("Diese Kartenwahl ist nicht möglich.");
  const game = clone(current);
  const target = game.table.find((entry) => entry.attack.id === attackCardId)!;
  target.defense = removeCard(game, playerId, defenseCardId);
  target.defensePlayedBy = playerId;
  target.defenseIllegal = !canBeatDurak(pair.attack, defense, current.trumpSuit);
  syncCounts(game);
  if (game.table.every((entry) => entry.defense)) game.phase = "throw-in";
  return game;
}

export function cheatThrowInDurak(current: DurakGameState, playerId: string, cardId: string) {
  assertCanCheat(current, playerId);
  if (current.phase !== "throw-in" || current.attackerId !== playerId) throw new Error("Du kannst gerade nicht nachlegen.");
  if (current.table.length >= current.maxAttackCards) throw new Error("Es können keine weiteren Karten nachgelegt werden.");
  const card = current.hands[playerId]?.find((entry) => entry.id === cardId);
  if (!card) throw new Error("Diese Karte befindet sich nicht auf deiner Hand.");
  const legal = tableRanks(current).has(card.rank);
  const game = clone(current);
  game.table.push({ attack: removeCard(game, playerId, cardId), attackPlayedBy: playerId, attackIllegal: !legal });
  if (!game.defenderTakes) game.phase = "defend";
  syncCounts(game);
  return game;
}

export function accuseDurak(current: DurakGameState, accuserId: string, cardId: string) {
  if (!current.cheatMode) throw new Error("Der Schummelmodus ist nicht aktiv.");
  if (current.accusationUsedPlayerIds.includes(accuserId)) throw new Error("Du hast in dieser Runde bereits einen Verdacht gemeldet.");
  const pair = current.table.find((entry) => entry.attack.id === cardId || entry.defense?.id === cardId);
  if (!pair) throw new Error("Diese Karte liegt nicht mehr auf dem Tisch.");
  const isAttack = pair.attack.id === cardId;
  const playedBy = isAttack ? pair.attackPlayedBy : pair.defensePlayedBy;
  const illegal = isAttack ? pair.attackIllegal : pair.defenseIllegal;
  if (!playedBy || playedBy === accuserId) throw new Error("Die eigene Karte kann nicht gemeldet werden.");
  const game = clone(current);
  game.accusationUsedPlayerIds.push(accuserId);
  if (!illegal) {
    let drawn = 0;
    for (; drawn < 2 && game.deck.length > 0; drawn += 1) game.hands[accuserId].push(game.deck.pop()!);
    syncCounts(game);
    addLog(game, `${game.playerNames[accuserId]} beschuldigt zu Unrecht und zieht ${drawn} Strafkarten.`);
    return game;
  }

  game.hands[playedBy].push(...game.table.flatMap((entry) => [entry.attack, ...(entry.defense ? [entry.defense] : [])]));
  game.table = [];
  if (!game.cheatBannedPlayerIds.includes(playedBy)) game.cheatBannedPlayerIds.push(playedBy);
  const oldAttacker = game.attackerId;
  replenish(game, oldAttacker, playedBy);
  updateFinished(game);
  if (game.phase !== "finished") {
    game.attackerId = nextActive(game, playedBy);
    game.defenderId = nextActive(game, game.attackerId);
    game.maxAttackCards = Math.min(6, game.hands[game.defenderId].length);
    game.phase = "attack";
    game.defenderTakes = false;
    game.accusationUsedPlayerIds = [];
  }
  addLog(game, `${game.playerNames[playedBy]} wurde beim Schummeln erwischt und nimmt den Tisch.`);
  syncCounts(game);
  return game;
}
