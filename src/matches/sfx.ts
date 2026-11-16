/** Small synthesized sound effects; no audio files, no network. */
const KEY = "gsg.match.sound";
let context: AudioContext | undefined;

export function soundEnabled() { try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } }
export function setSoundEnabled(on: boolean) { try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* optional */ } }

/** Must run inside a user gesture once so browsers allow audio. */
export function unlockSound() {
  try { context ??= new AudioContext(); if (context.state === "suspended") void context.resume(); } catch { context = undefined; }
}

export type Sfx = "menuOpen" | "menuBack" | "tick" | "go" | "shot" | "hit" | "score" | "fail" | "win" | "bounce" | "power" | "boom";
const SHAPES: Record<Sfx, { f: number; to: number; d: number; type: OscillatorType; v: number; noise?: boolean }> = {
  menuOpen: { f: 590, to: 885, d: .14, type: "sine", v: .065 },
  menuBack: { f: 587, to: 392, d: .1, type: "triangle", v: .04 },
  tick: { f: 660, to: 660, d: .06, type: "square", v: .03 },
  go: { f: 880, to: 1320, d: .18, type: "square", v: .05 },
  shot: { f: 220, to: 60, d: .16, type: "sawtooth", v: .07, noise: true },
  hit: { f: 300, to: 120, d: .12, type: "triangle", v: .07 },
  score: { f: 520, to: 1040, d: .2, type: "triangle", v: .05 },
  fail: { f: 300, to: 110, d: .3, type: "sawtooth", v: .05 },
  win: { f: 523, to: 1046, d: .45, type: "triangle", v: .06 },
  bounce: { f: 440, to: 520, d: .05, type: "sine", v: .05 },
  power: { f: 400, to: 1600, d: .25, type: "sine", v: .05 },
  boom: { f: 120, to: 40, d: .35, type: "sawtooth", v: .08, noise: true }
};

export function playSfx(kind: Sfx) {
  if (!context || !soundEnabled()) return;
  try {
    const shape = SHAPES[kind], now = context.currentTime, gain = context.createGain();
    gain.gain.setValueAtTime(shape.v, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + shape.d);
    gain.connect(context.destination);
    const osc = context.createOscillator();
    osc.type = shape.type;
    osc.frequency.setValueAtTime(shape.f, now);
    osc.frequency.exponentialRampToValueAtTime(shape.to, now + shape.d);
    osc.connect(gain); osc.start(now); osc.stop(now + shape.d);
    if (shape.noise) {
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * shape.d), context.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const source = context.createBufferSource(); source.buffer = buffer; source.connect(gain); source.start(now);
    }
  } catch { /* audio is optional */ }
}

export function vibrate(ms: number) { try { navigator.vibrate?.(ms); } catch { /* optional */ } }
