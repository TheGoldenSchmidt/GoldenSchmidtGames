import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type RefObject } from "react";
import { CUP_PREPARE_MS, CUP_READY_MS, isCupSwipe } from "../lib/kribbelnCup";
import { useDiceCupMotion } from "./useDiceCupMotion";

export interface DiceCupHandle { roll: () => void }
export const DICE_CUP_ROLL_DURATION = 1250;
export interface DiceCupTableProps {
  hasResult: boolean; availableCount: number; keptCount?: number; rolling: boolean; pending: boolean; canRoll: boolean; canAct: boolean;
  reducedMotion: boolean; rollKey: string; turnKey: string; className?: string; label?: string; idleText?: string;
  onRoll: () => void; onPreparingChange: (value: boolean) => void;
  renderDice: (state: { cupRef: RefObject<HTMLButtonElement | null>; inCup: boolean; preparing: boolean }) => ReactNode;
}

export const DiceCupTable = forwardRef<DiceCupHandle, DiceCupTableProps>(function DiceCupTable({ hasResult, availableCount, keptCount = 0, className = "kribbel-tray", label = "Würfelkiste", idleText, renderDice, rolling, pending, canRoll, canAct, reducedMotion, rollKey, turnKey, onRoll, onPreparingChange }, ref) {
  const helpId = useId();
  const cup = useRef<HTMLButtonElement>(null);
  const [prepared, setPrepared] = useState(false), [preparing, setPreparing] = useState(false), [shake, setShake] = useState(0);
  const [pose, setPose] = useState({ x: 0, y: 0, tilt: 0 });
  const drag = useRef<{ id: number; x: number; y: number; lastX: number; travel: number; time: number } | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), locked = useRef(false);
  const latest = useRef({ canRoll, onRoll, onPreparingChange }); latest.current = { canRoll, onRoll, onPreparingChange };

  function releasePointer() {
    if (drag.current && cup.current?.hasPointerCapture(drag.current.id)) cup.current.releasePointerCapture(drag.current.id);
    drag.current = undefined; setPose({ x: 0, y: 0, tilt: 0 });
  }
  function cast() {
    if (!latest.current.canRoll || locked.current || document.hidden) return;
    locked.current = true; releasePointer(); setPrepared(true); setPreparing(true); setShake(n => n + 1); latest.current.onPreparingChange(true);
    const delay = reducedMotion ? 0 : prepared ? CUP_READY_MS : CUP_PREPARE_MS;
    const send = () => {
      timer.current = undefined; setPreparing(false); latest.current.onPreparingChange(false);
      if (latest.current.canRoll && !document.hidden) latest.current.onRoll(); else locked.current = false;
    };
    if (!delay) send(); else timer.current = setTimeout(send, delay);
  }
  useImperativeHandle(ref, () => ({ roll: cast }));
  const motion = useDiceCupMotion({ enabled: canRoll && !preparing, turnKey,
    onShake: () => { setPrepared(true); setShake(n => n + 1); }, onThrow: cast });
  useLayoutEffect(() => { setPrepared(false); }, [rollKey]);

  useEffect(() => {
    if (rolling) setPrepared(false);
    if (canRoll && !pending && !rolling) locked.current = false;
  }, [canRoll, pending, rolling, rollKey]);
  useEffect(() => {
    clearTimeout(timer.current); timer.current = undefined; locked.current = false;
    setPrepared(false); setPreparing(false); latest.current.onPreparingChange(false); releasePointer();
  }, [turnKey]);
  useEffect(() => {
    if (!canRoll) { clearTimeout(timer.current); timer.current = undefined; setPreparing(false); latest.current.onPreparingChange(false); releasePointer(); }
  }, [canRoll]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) { clearTimeout(timer.current); timer.current = undefined; locked.current = false; setPreparing(false); setPrepared(false); latest.current.onPreparingChange(false); releasePointer(); }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => { clearTimeout(timer.current); document.removeEventListener("visibilitychange", hidden); };
  }, []);

  function down(e: PointerEvent<HTMLButtonElement>) {
    if (!canRoll || locked.current || !e.isPrimary || e.button !== 0) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, travel: 0, time: performance.now() };
    setPrepared(true);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const point = drag.current;
    if (!point || point.id !== e.pointerId || !canRoll || locked.current) return;
    point.travel += Math.abs(e.clientX - point.lastX); point.lastX = e.clientX;
    const dx = e.clientX - point.x, dy = e.clientY - point.y;
    setPose({ x: Math.max(-13, Math.min(13, dx * .2)), y: Math.max(-7, Math.min(13, dy * .12)), tilt: Math.max(-22, Math.min(22, dx * .35)) });
    if (point.travel > 45) { point.travel = 0; setShake(n => n + 1); motion.arm(); }
  }
  function up(e: PointerEvent<HTMLButtonElement>) {
    const point = drag.current;
    if (!point || point.id !== e.pointerId) return;
    const throwIt = isCupSwipe(e.clientX - point.x, e.clientY - point.y, performance.now() - point.time);
    releasePointer(); if (throwIt) cast();
  }

  const stored = !rolling && (prepared || preparing || pending || !hasResult);
  const count = stored ? availableCount : 0;
  const sensorOn = ["asking", "waiting", "active"].includes(motion.status);
  return <section className={`${className} kribbel-cup-table dice-cup-table${rolling ? " is-rolling" : ""}${preparing ? " is-preparing" : ""}${prepared ? " is-prepared" : ""}`} aria-label={label} data-cup-state={rolling ? "pouring" : preparing ? "preparing" : prepared ? "ready" : "resting"}>
    <div className="kribbel-cup-table__surface">
      <div className="kribbel-cup-bay">
        <button ref={cup} className="kribbel-cup" disabled={!canRoll || preparing} aria-label="Würfelbecher schütteln oder nach unten wischen" aria-describedby={helpId}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { releasePointer(); setPrepared(false); motion.reset(); }} onLostPointerCapture={() => { drag.current = undefined; setPose({ x: 0, y: 0, tilt: 0 }); }}
          onClick={e => { if (e.detail === 0 && canRoll) { setPrepared(true); setShake(n => n + 1); motion.arm(); } }}
          style={{ "--cup-x": `${pose.x}px`, "--cup-y": `${pose.y}px`, "--cup-tilt": `${pose.tilt}deg` } as CSSProperties}>
          <span className="kribbel-cup__grip">
            <svg key={shake} className={`kribbel-cup__art${shake && prepared && !rolling ? " is-shaken" : ""}`} viewBox="0 0 120 148" aria-hidden="true">
              <ellipse cx="60" cy="134" rx="36" ry="7" fill="#042e36" opacity=".5" />
              <path d="M17 25 29 123Q60 143 91 123L103 25Z" fill="#87533d" stroke="#b77e50" strokeWidth="3" />
              <path d="M24 34 35 119Q60 132 85 119L96 34" fill="none" stroke="#d8b575" strokeWidth="1.5" strokeDasharray="3 4" />
              <path d="M33 42 41 112Q60 123 79 112L87 42" fill="#744631" opacity=".5" />
              <ellipse cx="60" cy="25" rx="44" ry="17" fill="#b77e50" stroke="#d8b575" strokeWidth="3" />
              <ellipse cx="60" cy="25" rx="36" ry="11" fill="#392e2a" />
              <path d="M39 77Q60 91 81 77M40 86Q60 100 80 86" fill="none" stroke="#d8b575" strokeWidth="2" opacity=".65" />
            </svg>
          </span>
        </button>
        <span className="kribbel-cup-bay__count">{count ? `${count} im Becher` : rolling ? "Wurf läuft" : "Dein Becher"}</span>
        {canRoll && !preparing && <span className="kribbel-cup-bay__swipe" aria-hidden="true">↓ Wischen</span>}
      </div>
      {renderDice({ cupRef: cup, inCup: stored, preparing })}
    </div>
    <p id={helpId}>{rolling ? "Die Würfel fliegen aus dem Becher …" : preparing ? "Die Würfel kommen in den Becher …" : !canAct ? "Schau zu, gleich bist du dran." : prepared ? motion.status === "active" ? "Becher bereit. Handy kippen oder nach unten wischen." : "Becher bereit. Zum Werfen nach unten wischen." : idleText ?? (hasResult ? `${keptCount} behalten. Die anderen kommen wieder in den Becher.` : "Schütteln und wischen. Oder einfach Würfeln.")}</p>
    {(canAct || motion.status !== "off") && <div className="kribbel-cup-motion">
      {prepared && !preparing && !rolling && hasResult && canRoll && <button className="kribbel-cup-motion__toggle" onClick={() => { setPrepared(false); motion.reset(); }}>Becher abstellen</button>}
      <button className="kribbel-cup-motion__toggle" onClick={sensorOn ? motion.stop : motion.enable}>{sensorOn ? "Handybewegung ausschalten" : "Handybewegung aktivieren"}</button>
      {motion.status !== "off" && <small role="status">{motion.message}</small>}
    </div>}
  </section>;
});
