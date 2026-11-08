import { useEffect, useRef, useState } from "react";
import { CupMotionGesture, type CupVector } from "../lib/kribbelnCup";

type MotionStatus = "off" | "asking" | "waiting" | "active" | "denied" | "missing" | "insecure";
function vector(value: DeviceMotionEventAcceleration | null): CupVector | undefined {
  if (!value || value.x === null || value.y === null || value.z === null || ![value.x, value.y, value.z].every(Number.isFinite)) return;
  return { x: value.x, y: value.y, z: value.z };
}

export function useDiceCupMotion({ enabled, turnKey, onShake, onThrow }: { enabled: boolean; turnKey: string; onShake: () => void; onThrow: () => void }) {
  const [status, setStatus] = useState<MotionStatus>("off");
  const current = useRef({ enabled, onShake, onThrow }); current.current = { enabled, onShake, onThrow };
  const gesture = useRef(new CupMotionGesture());
  const cleanup = useRef<() => void>(() => {});
  const generation = useRef(0), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; cleanup.current(); }; }, []);
  useEffect(() => { gesture.current.reset(); }, [turnKey, enabled]);

  function stop() { generation.current++; cleanup.current(); cleanup.current = () => {}; gesture.current.reset(); setStatus("off"); }
  async function enable() {
    cleanup.current(); gesture.current.reset();
    const attempt = ++generation.current;
    if (!window.isSecureContext) { setStatus("insecure"); return; }
    const ctor = window.DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
    if (!ctor) { setStatus("missing"); return; }
    setStatus("asking");
    try {
      if (ctor.requestPermission && await ctor.requestPermission() !== "granted") { if (mounted.current && generation.current === attempt) setStatus("denied"); return; }
    } catch { if (mounted.current && generation.current === attempt) setStatus("denied"); return; }
    if (!mounted.current || generation.current !== attempt) return;
    setStatus("waiting"); let received = false;
    const event = (e: DeviceMotionEvent) => {
      if (document.hidden) return;
      const acceleration = vector(e.acceleration), includingGravity = vector(e.accelerationIncludingGravity);
      const beta = e.rotationRate?.beta, gamma = e.rotationRate?.gamma;
      const rotation = typeof beta === "number" && typeof gamma === "number" && Number.isFinite(beta) && Number.isFinite(gamma) ? { beta, gamma } : undefined;
      if (!acceleration && !includingGravity && !rotation) return;
      if (!received) { received = true; setStatus("active"); }
      if (!current.current.enabled) { gesture.current.reset(); return; }
      const action = gesture.current.feed({ time: performance.now(), acceleration, includingGravity, rotation });
      if (action === "shake") current.current.onShake();
      if (action === "throw") current.current.onThrow();
    };
    const visibility = () => { if (document.hidden) gesture.current.reset(); };
    window.addEventListener("devicemotion", event); document.addEventListener("visibilitychange", visibility);
    const timeout = window.setTimeout(() => {
      if (!received && generation.current === attempt) { cleanup.current(); setStatus("missing"); }
    }, 3000);
    cleanup.current = () => { window.clearTimeout(timeout); window.removeEventListener("devicemotion", event); document.removeEventListener("visibilitychange", visibility); };
  }
  const messages: Record<MotionStatus, string> = {
    off: "Mit Finger oder Maus schütteln, dann nach unten wischen.",
    asking: "Bewegungsfreigabe wird angefragt …",
    waiting: "Warte auf die Handybewegung … Swipe und Würfeln funktionieren schon.",
    active: "Handy schütteln, kurz ruhig halten, dann zum Werfen kippen.",
    denied: "Bewegungsfreigabe abgelehnt. Nutze den Becher oder Würfeln.",
    missing: "Kein Bewegungssignal verfügbar. Nutze den Becher oder Würfeln.",
    insecure: "Handybewegung braucht HTTPS. Nutze hier den Becher oder Würfeln."
  };
  return { status, message: messages[status], enable, stop, reset: () => gesture.current.reset(), arm: () => gesture.current.arm(performance.now()) };
}
