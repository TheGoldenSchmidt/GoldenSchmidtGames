import { useEffect, useMemo, useRef, useState } from "react";
import type { PartyGame } from "../../shared/party";
import { MATCH_MODULES, matchStandings, type MatchId } from "../../shared/matches/framework";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "../../shared/matches/types";
import { MATCH_CLIENTS } from "./registry";
import { playerColor, type MatchIO } from "./client";
import { playSfx, setSoundEnabled, soundEnabled, unlockSound, vibrate } from "./sfx";

interface Props { game: PartyGame; id: string; now: number; control: (input: MatchInput, reliable: boolean) => void; busy?: boolean }

/**
 * Shared stage for all match games: canvas with interpolation, HUD,
 * countdown, touch controls and input sending. Game rules stay in `shared/`.
 */
export function MatchStage({ game, id, now, control, busy = false }: Props) {
  const match = game.mini!.match!, matchId = match.id as MatchId, meta = MATCH_MODULES[matchId].meta, client = MATCH_CLIENTS[matchId];
  const own = match.players.find(p => p.id === id);
  const startAt = game.mini!.startAt;
  const active = game.phase === "mini-play" && now >= startAt && !busy && !match.done && !game.pausedAt && !!own && !own.gone;
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = useRef<HTMLCanvasElement>(null);
  const snapshots = useRef<{ prev: MatchState; cur: MatchState; at: number; echo: number }>({ prev: match, cur: match, at: performance.now(), echo: game.serverTime ?? Date.now() });
  const input = useRef<MatchInput>({ ...NEUTRAL_MATCH_INPUT, ca: own?.usedA ?? 0, cb: own?.usedB ?? 0, cn: own?.usedN ?? 0 });
  const local = useRef<Record<string, number>>({});
  const activeRef = useRef(active), controlRef = useRef(control), lastSend = useRef(0), pending = useRef<number | undefined>(undefined);
  const lastEvent = useRef(match.eventSeq);
  const [feedback, setFeedback] = useState({ text: "", key: 0, good: true });
  const [sound, setSound] = useState(soundEnabled());
  activeRef.current = active; controlRef.current = control;

  // Keep the latest two snapshots for interpolation; ignore stale ones.
  if (match !== snapshots.current.cur && match.time >= snapshots.current.cur.time) {
    snapshots.current = { prev: snapshots.current.cur.time === match.time ? snapshots.current.prev : snapshots.current.cur, cur: match, at: performance.now(), echo: game.serverTime ?? Date.now() };
  }
  // A reloaded device continues its tap counters from the authority's state.
  if (own) { input.current.ca = Math.max(input.current.ca, own.usedA); input.current.cb = Math.max(input.current.cb, own.usedB); input.current.cn = Math.max(input.current.cn, own.usedN); }

  const sendRef = useRef<(reliable: boolean) => void>(() => {});
  const io = useMemo<MatchIO>(() => {
    const send = sendRef.current = (reliable: boolean) => {
      if (!activeRef.current) return;
      const wait = 30 - (performance.now() - lastSend.current);
      if (wait > 0) { window.clearTimeout(pending.current); pending.current = window.setTimeout(() => send(reliable), wait); return; }
      lastSend.current = performance.now();
      const snap = snapshots.current;
      controlRef.current({ ...input.current, echo: snap.echo, held: Math.min(60000, Math.round(performance.now() - snap.at)) }, reliable);
    };
    return {
      get input() { return input.current; },
      local: local.current,
      set(values, now = false) { Object.assign(input.current, values); if (now) send(false); },
      press(kind) { unlockSound(); if (!activeRef.current) return; if (kind === "a") input.current.ca++; else input.current.cb++; send(true); },
      command(value) { unlockSound(); if (!activeRef.current) return; input.current.cn++; input.current.n = value; send(true); }
    };
  }, []);

  useEffect(() => {
    // Periodic packets keep held inputs alive (they expire after 400 ms) and refresh the round-trip estimate.
    const timer = window.setInterval(() => sendRef.current(false), 100);
    return () => { window.clearInterval(timer); window.clearTimeout(pending.current); };
  }, [io]);
  useEffect(() => { if (!active) { input.current = { ...input.current, x: 0, y: 0, ax: 0, ay: 0, ha: false, hb: false }; } }, [active]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) { input.current = { ...input.current, x: 0, y: 0, ax: 0, ay: 0, ha: false, hb: false }; } };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);

  // Sound, vibration and a short text for new authoritative events.
  useEffect(() => {
    const fresh = match.events.filter(e => e.seq > lastEvent.current);
    if (!fresh.length) return;
    lastEvent.current = match.eventSeq;
    for (const event of fresh) {
      const sfx = client.sound?.(event, id);
      if (sfx) playSfx(sfx);
      if (event.ids.includes(id) && /false|hit|out|dead|lost/.test(event.kind)) vibrate(60);
    }
    const visible = fresh.filter(e => e.text && !client.quiet?.includes(e.kind));
    const mine = [...visible].reverse().find(e => e.ids.includes(id)) ?? visible.at(-1);
    if (mine) setFeedback({ text: mine.text, key: mine.seq, good: !/false|hit|out|dead|lost/.test(mine.kind) || !mine.ids.includes(id) });
  }, [match.eventSeq]);

  // Canvas loop: draws continuously, independent of the 10/20 Hz snapshots.
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    const names = Object.fromEntries(game.players.map(p => [p.id, p.name]));
    let frame = 0, width = 0, height = 0;
    const resize = () => {
      const box = element.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      width = box.width; height = box.height;
      element.width = Math.max(1, Math.round(width * dpr)); element.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize); observer.observe(element);
    const draw = (t: number) => {
      const snap = snapshots.current, interval = 1000 / meta.hz;
      const alpha = reduced ? 1 : Math.max(0, Math.min(1, (performance.now() - snap.at) / interval));
      ctx.clearRect(0, 0, width, height);
      const simTime = snap.cur.time + Math.min(250, performance.now() - snap.at);
      client.render(ctx, { prev: snap.prev, cur: snap.cur, alpha, viewer: id, reduced, names, local: local.current, input: input.current, w: width, h: height, t, simTime });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [matchId, id, startAt]);

  const standings = matchStandings(match), score = standings.find(s => s.id === id)?.score ?? 0;
  const count = Math.ceil((startAt - now) / 1000);
  const Controls = client.Controls;
  return <section className={`match-game match-game--${matchId}`} aria-label={meta.name}>
    <header className="match-hud">
      <div><h2>{meta.name}</h2><p role="status">{client.status?.(match, id) ?? meta.look.hint}</p></div>
      <strong className="match-score"><b>{score}</b><small>{client.unit ?? "Punkte"}</small></strong>
      <button type="button" className="match-sound" aria-pressed={sound} aria-label={sound ? "Ton ausschalten" : "Ton einschalten"} onClick={() => { const next = !sound; setSound(next); setSoundEnabled(next); if (next) unlockSound(); }}>{sound ? "♪" : "×"}</button>
    </header>
    <ol className="match-standings" aria-label="Zwischenstand">
      {standings.map(s => { const p = match.players.find(q => q.id === s.id)!; return <li key={s.id} className={`${s.id === id ? "is-you" : ""} ${p.gone ? "is-gone" : ""}`} style={{ ["--player" as string]: playerColor(p.style) }}>
        <i aria-hidden="true" /><span>{game.players.find(q => q.id === s.id)?.name ?? "?"}</span><b>{s.score}</b>
      </li>; })}
    </ol>
    <div className="match-stage">
      <canvas ref={canvas} className="match-canvas" role="img" aria-label={`Spielfeld: ${meta.name}`} />
      <div className="match-controls"><Controls io={io} view={match} viewer={id} active={active} /></div>
      {count > 0 && <div className="match-countdown" role="status"><b key={count}>{count}</b><span>{meta.controls}</span></div>}
      {match.done && <div className="match-countdown match-done" role="status"><b>✓</b><span>Das Ergebnis steht fest!</span></div>}
      {!own && <div className="match-countdown" role="status"><span>Du schaust zu.</span></div>}
      {feedback.text && count <= 0 && !match.done && <p className={`match-feedback ${feedback.good ? "is-good" : "is-bad"}`} key={feedback.key} role="status">{feedback.text}</p>}
    </div>
  </section>;
}
