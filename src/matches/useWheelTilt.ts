import { useEffect, useRef, useState } from "react";

export type WheelTiltStatus = "off" | "asking" | "waiting" | "active" | "denied" | "missing" | "insecure";
/** Turning the phone this far (degrees) from the calibrated position is full lock. */
const FULL_LOCK = 32, DEADZONE = 2.5;

/**
 * Roll of the phone in the screen plane (radians, clockwise positive) from a
 * device orientation: the "up" direction of the world expressed in device
 * coordinates, rotated into screen coordinates. Works in any screen
 * orientation and does not depend on the compass heading. Undefined when the
 * phone lies nearly flat (no usable roll).
 */
export function screenRoll(beta: number, gamma: number, screenAngle: number) {
  const b = beta * Math.PI / 180, g = gamma * Math.PI / 180, o = screenAngle * Math.PI / 180;
  // World up in device coordinates (x right, y towards the top of the screen in portrait).
  const ux = -Math.sin(g) * Math.cos(b), uy = Math.sin(b);
  const sx = ux * Math.cos(o) - uy * Math.sin(o), sy = ux * Math.sin(o) + uy * Math.cos(o);
  if (Math.hypot(sx, sy) < .25) return undefined;
  // Upright: up = (0, 1). Turning the phone clockwise turns "up" counter-clockwise on screen.
  return -Math.atan2(sx, sy);
}

/** Steering −1…1 from the roll relative to the calibrated rest position. */
export function steerFromRoll(roll: number, rest: number) {
  const deg = Math.atan2(Math.sin(roll - rest), Math.cos(roll - rest)) * 180 / Math.PI;
  if (Math.abs(deg) < DEADZONE) return 0;
  return Math.max(-1, Math.min(1, (deg - Math.sign(deg) * DEADZONE) / (FULL_LOCK - DEADZONE)));
}

/**
 * Tilt steering for the landscape racer: hold the phone like a steering
 * wheel. `enable` must run in a tap (iOS asks for permission); the first
 * sample is the rest position, `calibrate` sets it again. `extraAngle` is a
 * rotation of the game on screen (degrees, clockwise) on top of the screen's own.
 */
export function useWheelTilt(onSteer: (x: number) => void, extraAngle: () => number = () => 0) {
  const [status, setStatus] = useState<WheelTiltStatus>("off");
  const rest = useRef<number | undefined>(undefined), latest = useRef<number | undefined>(undefined), steer = useRef(onSteer), cleanup = useRef<() => void>(() => {}), mounted = useRef(true);
  const extra = useRef(extraAngle);
  steer.current = onSteer; extra.current = extraAngle;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cleanup.current(); }; }, []);
  async function enable() {
    cleanup.current(); rest.current = undefined;
    if (!window.isSecureContext) { setStatus("insecure"); return; }
    const ctor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
    if (!ctor) { setStatus("missing"); return; }
    setStatus("asking");
    try { if (ctor.requestPermission && await ctor.requestPermission() !== "granted") { if (mounted.current) setStatus("denied"); return; } }
    catch { if (mounted.current) setStatus("denied"); return; }
    if (!mounted.current) return;
    setStatus("waiting");
    let received = false;
    const event = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null || document.hidden) return;
      // The screen's own rotation plus a turn of the game itself (portrait-locked app showing landscape).
      const angle = ((screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0) + extra.current()) % 360, roll = screenRoll(e.beta, e.gamma, angle);
      if (roll === undefined) return;
      if (!received) { received = true; setStatus("active"); }
      latest.current = roll; rest.current ??= roll;
      steer.current(steerFromRoll(roll, rest.current));
    };
    const reset = () => { rest.current = undefined; steer.current(0); };
    const hidden = () => { if (document.hidden) steer.current(0); };
    window.addEventListener("deviceorientation", event); window.addEventListener("orientationchange", reset); document.addEventListener("visibilitychange", hidden);
    const timeout = window.setTimeout(() => { if (!received && mounted.current) { cleanup.current(); setStatus("missing"); } }, 3000);
    cleanup.current = () => { window.clearTimeout(timeout); window.removeEventListener("deviceorientation", event); window.removeEventListener("orientationchange", reset); document.removeEventListener("visibilitychange", hidden); steer.current(0); };
  }
  function calibrate() { rest.current = latest.current; steer.current(0); }
  const message: Record<WheelTiltStatus, string> = {
    off: "Tippe, um mit Kippen zu lenken.", asking: "Sensorfreigabe wird angefragt …", waiting: "Halte das Handy quer wie ein Lenkrad …", active: "Kippen lenkt.",
    denied: "Sensor abgelehnt – lenke mit den Pfeilen.", missing: "Kein Sensor – lenke mit den Pfeilen.", insecure: "Kippen braucht HTTPS – lenke mit den Pfeilen."
  };
  return { status, enable, calibrate, message: message[status] };
}
