import type { CSSProperties } from "react";
import { KRIBBEL_COLORS, kribbelTaskMet, type KribbelColor, type KribbelDie } from "../../shared/kribbeln";

const COLORS = { red: "#c63b48", yellow: "#f6cb49", green: "#318463", blue: "#3476af", orange: "#c86418", purple: "#8353a0", neutral: "#d4e1df" };

function GoalDie({ color = "neutral", letter, crossed = false }: { color?: KribbelColor | "neutral"; letter?: string; crossed?: boolean }) {
  return <span className={`kribbel-goal-die${crossed ? " is-crossed" : ""}${color === "neutral" ? " is-neutral" : ""}${color === "yellow" ? " is-yellow" : ""}`}
    style={{ "--cue-color": COLORS[color] } as CSSProperties}>
    {letter ? <b>{letter}</b> : <i />}
  </span>;
}

export function KribbelnTask({ task, label, dice, rolling, previousBest }: { task: number; label: string; dice: KribbelDie[]; rolling: boolean; previousBest?: number }) {
  const count = (color: KribbelColor) => dice.filter(die => die.color === color).length;
  const counts = KRIBBEL_COLORS.map(count);
  const sum = dice.reduce((total, die) => total + die.value, 0);
  const known = !rolling && dice.length === 6;
  const met = known && kribbelTaskMet(task, dice) && (task !== -1 || previousBest === undefined || sum > previousBest);
  let picture, hint, progress;

  switch (task) {
    case 0:
      picture = <><GoalDie color="green" letter="G" /><span className="kribbel-goal-separator">+</span><span className="kribbel-goal-rest">{Array.from({ length: 5 }, (_, i) => <GoalDie key={i} />)}</span></>;
      hint = "Die anderen fünf ohne Grün."; progress = `Grün: ${count("green")} von genau 1`;
      break;
    case 1:
      picture = <><GoalDie color="yellow" letter="G" crossed /><strong className="kribbel-goal-quantity">× 0</strong></>;
      hint = "Alle sechs ohne Gelb."; progress = `Gelb: ${count("yellow")}, erlaubt: 0`;
      break;
    case 2:
      picture = <><GoalDie color="blue" letter="A" /><span className="kribbel-goal-separator">+</span><GoalDie color="orange" letter="B" /><span className="kribbel-goal-separator">+</span><GoalDie color="purple" letter="C" /></>;
      hint = "Drei Farben, Verteilung beliebig."; progress = `${counts.filter(n => n > 0).length} von genau 3 Farben`;
      break;
    case 3:
      picture = <><span className="kribbel-goal-named"><GoalDie color="blue" letter="B" /><small>Blau</small></span><strong className="kribbel-goal-quantity">&gt;</strong><span className="kribbel-goal-named"><GoalDie color="red" letter="R" /><small>Rot</small></span></>;
      hint = "Blau muss häufiger sein als Rot."; progress = `${count("blue")} blau, ${count("red")} rot`;
      break;
    case 4:
      picture = <>{[0, 1, 2, 3].map(i => <GoalDie key={i} color="blue" letter="A" />)}<span className="kribbel-goal-separator">+</span><span className="kribbel-goal-rest"><GoalDie /><GoalDie /></span></>;
      hint = "Eine Farbe viermal, zwei andere Würfel."; progress = `Häufigste Farbe: ${Math.max(...counts)} von genau 4`;
      break;
    case 5:
      picture = <><span className="kribbel-goal-pair"><GoalDie color="blue" letter="A" /><GoalDie color="blue" letter="A" /></span><span className="kribbel-goal-pair"><GoalDie color="orange" letter="B" /><GoalDie color="orange" letter="B" /></span><GoalDie color="purple" letter="C" /><GoalDie color="green" letter="D" /></>;
      hint = "Zwei Paare und zwei Einzelfarben."; progress = `${counts.filter(n => n === 2).length} von genau 2 Farbpaaren`;
      break;
    default:
      picture = previousBest === undefined
        ? <><strong className="kribbel-goal-sigma">Σ</strong><strong className="kribbel-goal-sum">6–36</strong></>
        : <><span className="kribbel-goal-step">{previousBest}<small>bisher</small></span><strong className="kribbel-goal-quantity">&lt;</strong><span className="kribbel-goal-step is-next">?<small>dein Ziel</small></span></>;
      hint = previousBest === undefined ? "Sammle eine möglichst hohe Summe." : `Du brauchst mindestens ${previousBest + 1} Augen.`;
      progress = `Deine Summe: ${sum}`;
  }

  const freeColors = task === 2 || task === 4 || task === 5;
  return <div className={`kribbel-task${met ? " is-met" : ""}`} data-state={known ? met ? "met" : "unmet" : "waiting"}>
    <div className="kribbel-task__picture" role="img" aria-label={`${label}${freeColors ? ". Die Farben im Beispiel sind frei wählbar." : ""}`}>{picture}</div>
    <p className="kribbel-task__hint">{hint}{freeColors && <small>Beispiel mit frei wählbaren Farben</small>}</p>
    <div className="kribbel-task__progress" aria-live="polite">
      <span className="kribbel-task__check" aria-hidden="true">{known ? met ? "✓" : "·" : "○"}</span>
      <span><strong>{known ? met ? "Aufgabe erfüllt" : "Noch nicht erfüllt" : rolling ? "Die Würfel entscheiden …" : "Dein Ziel für diesen Wurf"}</strong><small>{known ? progress : "Das Ergebnis erscheint, wenn die Würfel liegen."}</small></span>
    </div>
  </div>;
}
