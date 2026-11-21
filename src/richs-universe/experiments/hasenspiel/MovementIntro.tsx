import { useState } from "react";
import { examples, RuleExample } from "./RuleExamples";
import type { Level } from "./rules";

const monkeyLessons = [...examples.monkey.slice(0, 5), examples.longHang];

const lessons = {
  1: [
    examples.edges,
    examples.victory,
    { ...examples.step[0], label: "Richtig · beim Ziehen muss der Hase eine Ebene vor. Hier zieht Blau von Reihe 4 in Reihe 5." },
    { ...examples.step[1], label: "Falsch · ein einfacher Schritt zur Seite bleibt in derselben Ebene." },
    { ...examples.step[2], label: "Falsch · ein Hase darf nicht zurück zu seiner eigenen Reihe 1 ziehen." },
    { ...examples.jump[5], label: "Richtig · vorwärts über einen eigenen Hasen springen. Er bleibt stehen." },
    { ...examples.jump[0], captureAt: "3:-1", label: "Richtig · seitlich über einen Gegner springen und ihn schlagen." },
    examples.backwardJump,
    examples.crossing[0], examples.centerMap, examples.enter, examples.leave,
    ...examples.crossing.slice(1, 6).map(frame => ({ ...frame, captureAt: "center" })),
  ],
  2: [examples.sideways[0], ...examples.trio],
  3: [examples.fullDouble, ...monkeyLessons,
    ...examples.deer, examples.resting, ...examples.wall],

};

export function MovementIntro({ level }: { level: Level }) {
  const [step, setStep] = useState<number | null>(null);
  const frames = lessons[level];
  if (step === null) return <button type="button" className="hare-replay" onClick={() => setStep(0)}>
    {level === 1 ? "Bewegungen zeigen" : `Neu in Stufe ${level} ansehen`}
  </button>;
  const lesson = frames[step];
  return <section aria-label={`Bewegungsintro Stufe ${level}`}>
    {level === 3 && <h3>{step === 0 ? "Doppelsprung" : step <= monkeyLessons.length ? "Neu · Der Affe" : "Neu · Der Hirsch"}</h3>}
    <RuleExample key={step} frames={Array.isArray(lesson) ? lesson : [lesson]} animate={!window.matchMedia("(prefers-reduced-motion: reduce)").matches} />
    <div className="hare-rule-controls">
      <button type="button" disabled={!step} onClick={() => setStep(step - 1)}>Zurück</button>
      <button type="button" onClick={() => setStep(step + 1 < frames.length ? step + 1 : null)}>
        {step + 1 < frames.length ? `Weiter · ${step + 1}/${frames.length}` : "Fertig"}
      </button>
      {step + 1 < frames.length && <button type="button" onClick={() => setStep(null)}>Schließen</button>}
    </div>
  </section>;
}
