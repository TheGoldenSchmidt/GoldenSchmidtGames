import type {
  Player,
  QwixxColor,
  QwixxDice,
  QwixxGameState,
  QwixxSheet
} from "./types";

export const QWIXX_COLORS: QwixxColor[] = ["red", "yellow", "green", "blue"];

export const QWIXX_ROWS: Record<QwixxColor, number[]> = {
  red: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  yellow: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  green: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  blue: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
};

export const QWIXX_COLOR_NAMES: Record<QwixxColor, string> = {
  red: "Rot",
  yellow: "Gelb",
  green: "Grün",
  blue: "Blau"
};

function emptyMarks(): Record<QwixxColor, number[]> {
  return { red: [], yellow: [], green: [], blue: [] };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function addLog(game: QwixxGameState, message: string) {
  game.log = [...game.log.slice(-9), message];
}

function randomDie() {
  return Math.floor(Math.random() * 6) + 1;
}

export function createQwixxGame(players: Pick<Player, "id" | "name">[]): QwixxGameState {
  if (players.length < 2 || players.length > 5) {
    throw new Error("Qwixx benötigt zwei bis fünf Spieler.");
  }

  const sheets: Record<string, QwixxSheet> = {};
  for (const player of players) {
    sheets[player.id] = {
      playerId: player.id,
      playerName: player.name,
      marks: emptyMarks(),
      locks: [],
      failedThrows: 0
    };
  }

  return {
    playerOrder: players.map((player) => player.id),
    sheets,
    turnIndex: 0,
    round: 1,
    phase: "awaiting-roll",
    whiteChoices: {},
    closedRows: [],
    winnerIds: [],
    log: [`${players[0].name} beginnt.`]
  };
}

export function activePlayerId(game: QwixxGameState) {
  return game.playerOrder[game.turnIndex];
}

export function rollQwixx(
  current: QwixxGameState,
  playerId: string,
  suppliedDice?: QwixxDice
): QwixxGameState {
  if (current.phase !== "awaiting-roll") throw new Error("Es kann gerade nicht gewürfelt werden.");
  if (activePlayerId(current) !== playerId) throw new Error("Nur die aktive Person darf würfeln.");

  const game = clone(current);
  game.dice = suppliedDice ?? {
    white: [randomDie(), randomDie()],
    colors: {
      red: game.closedRows.includes("red") ? null : randomDie(),
      yellow: game.closedRows.includes("yellow") ? null : randomDie(),
      green: game.closedRows.includes("green") ? null : randomDie(),
      blue: game.closedRows.includes("blue") ? null : randomDie()
    }
  };
  game.phase = "white-choice";
  game.whiteChoices = {};
  addLog(game, `${game.sheets[playerId].playerName} würfelt ${game.dice.white[0] + game.dice.white[1]} in Weiß.`);
  return game;
}

export function canMark(
  sheet: QwixxSheet,
  color: QwixxColor,
  value: number,
  closedRows: QwixxColor[]
) {
  if (closedRows.includes(color)) return false;
  const index = QWIXX_ROWS[color].indexOf(value);
  if (index < 0 || sheet.marks[color].includes(index)) return false;
  const lastMarked = Math.max(-1, ...sheet.marks[color]);
  if (index <= lastMarked) return false;
  if (index === QWIXX_ROWS[color].length - 1 && sheet.marks[color].length < 5) return false;
  return true;
}

function applyMark(game: QwixxGameState, playerId: string, color: QwixxColor, value: number) {
  const sheet = game.sheets[playerId];
  if (!sheet || !canMark(sheet, color, value, game.closedRows)) {
    throw new Error("Dieses Zahlenfeld kann nicht angekreuzt werden.");
  }
  const index = QWIXX_ROWS[color].indexOf(value);
  sheet.marks[color].push(index);
  const closesRow = index === QWIXX_ROWS[color].length - 1;
  if (closesRow && !sheet.locks.includes(color)) sheet.locks.push(color);
  return closesRow;
}

function scoreCount(count: number) {
  return (count * (count + 1)) / 2;
}

export function sheetScore(sheet: QwixxSheet) {
  const rowPoints = QWIXX_COLORS.reduce(
    (sum, color) => sum + scoreCount(sheet.marks[color].length + (sheet.locks.includes(color) ? 1 : 0)),
    0
  );
  return rowPoints - sheet.failedThrows * 5;
}

function finish(game: QwixxGameState) {
  game.phase = "finished";
  game.dice = undefined;
  const scores = game.playerOrder.map((playerId) => ({ playerId, score: sheetScore(game.sheets[playerId]) }));
  const bestScore = Math.max(...scores.map((entry) => entry.score));
  game.winnerIds = scores.filter((entry) => entry.score === bestScore).map((entry) => entry.playerId);
  addLog(game, "Die Partie ist beendet.");
}

function shouldFinish(game: QwixxGameState) {
  return game.closedRows.length >= 2 || Object.values(game.sheets).some((sheet) => sheet.failedThrows >= 4);
}

export function submitWhiteChoice(
  current: QwixxGameState,
  playerId: string,
  color: QwixxColor | null
): QwixxGameState {
  if (current.phase !== "white-choice" || !current.dice) throw new Error("Die weiße Aktion ist bereits vorbei.");
  if (!current.playerOrder.includes(playerId)) throw new Error("Diese Person gehört nicht zur Partie.");
  if (Object.prototype.hasOwnProperty.call(current.whiteChoices, playerId)) {
    throw new Error("Die Entscheidung wurde bereits abgegeben.");
  }

  const whiteSum = current.dice.white[0] + current.dice.white[1];
  if (color && !canMark(current.sheets[playerId], color, whiteSum, current.closedRows)) {
    throw new Error("Diese Zahl ist in der gewählten Reihe nicht mehr verfügbar.");
  }

  const game = clone(current);
  game.whiteChoices[playerId] = color;
  const everyoneAnswered = game.playerOrder.every((id) => Object.prototype.hasOwnProperty.call(game.whiteChoices, id));
  if (!everyoneAnswered) return game;

  const newlyClosed = new Set<QwixxColor>();
  for (const id of game.playerOrder) {
    const chosenColor = game.whiteChoices[id];
    if (chosenColor && applyMark(game, id, chosenColor, whiteSum)) newlyClosed.add(chosenColor);
  }
  for (const closed of newlyClosed) {
    if (!game.closedRows.includes(closed)) {
      game.closedRows.push(closed);
      addLog(game, `${QWIXX_COLOR_NAMES[closed]} wurde geschlossen.`);
    }
  }

  if (shouldFinish(game)) finish(game);
  else game.phase = "color-choice";
  return game;
}

export interface QwixxColorChoice {
  color: QwixxColor;
  whiteIndex: 0 | 1;
}

export function submitColorChoice(
  current: QwixxGameState,
  playerId: string,
  choice: QwixxColorChoice | null
): QwixxGameState {
  if (current.phase !== "color-choice" || !current.dice) throw new Error("Die farbige Aktion ist gerade nicht verfügbar.");
  if (activePlayerId(current) !== playerId) throw new Error("Nur die aktive Person darf diese Aktion wählen.");

  const game = clone(current);
  if (choice) {
    const colorDie = game.dice!.colors[choice.color];
    if (colorDie === null) throw new Error("Dieser Farbwürfel ist nicht mehr im Spiel.");
    const value = game.dice!.white[choice.whiteIndex] + colorDie;
    const closed = applyMark(game, playerId, choice.color, value);
    if (closed && !game.closedRows.includes(choice.color)) {
      game.closedRows.push(choice.color);
      addLog(game, `${QWIXX_COLOR_NAMES[choice.color]} wurde geschlossen.`);
    }
  } else if (game.whiteChoices[playerId] === null) {
    game.sheets[playerId].failedThrows += 1;
    addLog(game, `${game.sheets[playerId].playerName} erhält einen Fehlwurf.`);
  }

  if (shouldFinish(game)) {
    finish(game);
    return game;
  }

  game.turnIndex = (game.turnIndex + 1) % game.playerOrder.length;
  if (game.turnIndex === 0) game.round += 1;
  game.phase = "awaiting-roll";
  game.dice = undefined;
  game.whiteChoices = {};
  addLog(game, `${game.sheets[activePlayerId(game)].playerName} ist am Zug.`);
  return game;
}

export function availableColorChoices(game: QwixxGameState, playerId: string) {
  if (!game.dice) return [];
  const sheet = game.sheets[playerId];
  if (!sheet) return [];
  const choices: Array<QwixxColorChoice & { value: number }> = [];
  for (const color of QWIXX_COLORS) {
    const colorDie = game.dice.colors[color];
    if (colorDie === null) continue;
    ([0, 1] as const).forEach((whiteIndex) => {
      const value = game.dice!.white[whiteIndex] + colorDie;
      if (canMark(sheet, color, value, game.closedRows)) choices.push({ color, whiteIndex, value });
    });
  }
  return choices;
}
