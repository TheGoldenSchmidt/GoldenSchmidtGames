import { useId, useRef } from "react";
import type { GameDefinition } from "../../shared/types";
import { GameCardFace } from "./GameCardFace";

const rules: Record<GameDefinition["id"], string> = {
  party: "Das Auftakt-Minispiel legt die Zugreihenfolge fest. Würfle, wähle an Abzweigungen deinen Weg und kaufe Trophäen. Nach jeder Brettrunde spielt ihr um Münzen. Für den Gesamtsieg zählen zuerst die Trophäen.",
  "roll-it-up": "Würfle und besuche die Stationen auf dem Brett. Kaufe Grinder, Pape, Filter und drei Weedbuds für deine Bauschale. Wer mit vollständigem Set zuerst den Jayspot erreicht, gewinnt.",
  goldenschmidt: "Ihr spielt zufällig gezogene Minispiele ohne Wiederholung. Vor jeder Runde setzt jede Person verdeckt einen Wert von 1 bis zur Anzahl der Runden. Jeder Wert ist nur einmal verfügbar. Wer gewinnt, erhält den eigenen Einsatz als Punkte. Die höchste Gesamtsumme gewinnt. Bei Gleichstand teilt ihr euch den Sieg.",
  "free-minigame": "Der Host wählt ein zur Spielerzahl passendes Minispiel. Ihr könnt die Steuerung vor dem Start ohne Wertung üben. Im gewerteten Durchgang spielen alle auf dem eigenen Gerät. Die Wertung des gewählten Minispiels entscheidet.",
  qwixx: "Alle dürfen die Summe der beiden weißen Würfel ankreuzen. Wer am Zug ist, darf zusätzlich einen weißen mit einem farbigen Würfel kombinieren. Kreuze jede Farbreihe von links nach rechts an. Mehr Kreuze bringen mehr Punkte, Fehlwürfe kosten Punkte.",
  durak: "Greife mit einer Karte an. Die Verteidigung deckt mit einer höheren Karte derselben Farbe oder mit Trumpf. Wer nicht decken kann oder möchte, nimmt die Karten auf. Sobald der Nachziehstapel leer ist, gewinnt, wer seine Karten loswird. Wer zuletzt Karten hält, verliert.",
  kribbeln: "Würfle bis zu dreimal und behalte passende Würfel für die Farbaufgabe. Erfüllst du sie, zählt die Summe aller sechs Würfel. Auf dem Kribbelfeld muss die nächste eigene Summe höher sein als die vorherige. Punkte gibt es für die Platzierung in jeder Zeile.",
  binokel: "Reize, melde Kombinationen und sammle Punkte in den Stichen."
};

export function GameTile({game, selected, disabled, players, onSelect}: {
  game: GameDefinition; selected?: boolean; disabled?: boolean; players?: string; onSelect: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  return <div className="game-tile">
    <button type="button" disabled={disabled} aria-pressed={selected} onClick={onSelect}><GameCardFace game={game} players={players}/></button>
    <button type="button" className="game-help" aria-label={`Regeln für ${game.name}`} aria-haspopup="dialog"
      onClick={() => dialog.current?.showModal()}><span aria-hidden="true">?</span></button>
    <dialog ref={dialog} className="game-rules" aria-labelledby={heading}>
      <small>Spielregeln · {game.minPlayers}–{game.maxPlayers} Spieler</small>
      <h2 id={heading}>{game.name}</h2>
      <p>{game.shortDescription}</p><p>{rules[game.id]}</p>
      <button type="button" onClick={() => dialog.current?.close()}>Schließen</button>
    </dialog>
  </div>;
}
