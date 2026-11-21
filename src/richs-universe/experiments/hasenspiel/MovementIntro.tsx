import { useState } from "react";
import { examples, RuleExample } from "./RuleExamples";
import type { Level } from "./rules";

const lessons = {
  1: [examples.step[0], examples.jump[0], examples.jump[1], examples.crossing[3]],
  2: [examples.sideways[0], ...examples.trio],
  3: [examples.double[0], examples.double[1], examples.monkey[2], examples.monkey[4],
    examples.deer[0], examples.deer[1], examples.wall[0], examples.wall[1]],
};

export function MovementIntro({ level }: { level: Level }) {
  const [step, setStep] = useState<number | null>(null);
  const frames = lessons[level];
  if (step === null) return <button type="button" className="hare-replay" onClick={() => setStep(0)}>
    {level === 1 ? "Bewegungen zeigen" : `Neu in Stufe ${level} ansehen`}
  </button>;
  return <section aria-label={`Bewegungsintro Stufe ${level}`}>
    <RuleExample key={step} frames={[frames[step]]} animate={!window.matchMedia("(prefers-reduced-motion: reduce)").matches} />
    <div className="hare-rule-controls">
      <button type="button" disabled={!step} onClick={() => setStep(step - 1)}>Zurück</button>
      <button type="button" onClick={() => setStep(step + 1 < frames.length ? step + 1 : null)}>
        {step + 1 < frames.length ? `Weiter · ${step + 1}/${frames.length}` : "Fertig"}
      </button>
      {step + 1 < frames.length && <button type="button" onClick={() => setStep(null)}>Schließen</button>}
    </div>
  </section>;
}
