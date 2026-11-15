import { useEffect, useRef, useState, type MutableRefObject } from "react";

/**
 * Test mode for device test rounds: frame rate, frame time, snapshot spacing
 * and round trip of this device, plus chase-camera sliders. Switched on per
 * device with `?messung` in the address (off with `?messung=0`); values stay
 * on the device and are copied by hand into the test protocol.
 */
const FLAG = "gsg-messung";
export function measureEnabled() {
  try {
    const query = new URLSearchParams(window.location.search).get("messung");
    if (query !== null) { if (query === "0") localStorage.removeItem(FLAG); else localStorage.setItem(FLAG, "1"); }
    return localStorage.getItem(FLAG) === "1";
  } catch { return false; }
}

interface Stats { fps: number; p95: number; slow: number; gap: number; gapMax: number }
const SLIDERS = [["camDistK", "Abstand"], ["camHeightK", "Höhe"], ["camTurnK", "Nachdrehen"]] as const;
const percentile = (values: number[], p: number) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0; };

export function MeasurePanel({ gameId, name, local, arrivals, rtt, chase }: { gameId: string; name: string; local: Record<string, number>; arrivals: MutableRefObject<number[]>; rtt?: number; chase: boolean }) {
  const [open, setOpen] = useState(true), [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<Stats>({ fps: 0, p95: 0, slow: 0, gap: 0, gapMax: 0 });
  const storeKey = `${FLAG}-kamera-${gameId}`;
  const [camera, setCamera] = useState<Record<string, number>>(() => { try { return JSON.parse(localStorage.getItem(storeKey) ?? "{}"); } catch { return {}; } });
  const frames = useRef<number[]>([]);
  useEffect(() => { for (const [key] of SLIDERS) local[key] = camera[key] ?? 1; try { localStorage.setItem(storeKey, JSON.stringify(camera)); } catch { /* private mode */ } }, [camera]);
  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = (t: number) => { frames.current.push(t - last); last = t; if (frames.current.length > 600) frames.current.shift(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const timer = window.setInterval(() => {
      // Last five seconds of frames and snapshots.
      const gaps = frames.current.slice(-300), total = gaps.reduce((a, b) => a + b, 0) || 1;
      const now = performance.now(), recent = arrivals.current.filter(t => now - t < 5000), spacing = recent.slice(1).map((t, i) => t - recent[i]);
      setStats({ fps: Math.round(gaps.length / total * 1000), p95: Math.round(percentile(gaps, .95)), slow: gaps.filter(g => g > 50).length,
        gap: Math.round(spacing.reduce((a, b) => a + b, 0) / (spacing.length || 1)), gapMax: Math.round(Math.max(0, ...spacing)) });
    }, 1000);
    return () => { cancelAnimationFrame(raf); window.clearInterval(timer); };
  }, []);
  const summary = () => [
    `${name}: ${stats.fps} FPS, 95 % der Bilder unter ${stats.p95} ms, ${stats.slow} Ruckler über 50 ms in 5 s`,
    `Netz: Bild vom Server alle ${stats.gap} ms (längste Pause ${stats.gapMax} ms), Rundlauf ${rtt ?? "–"} ms`,
    chase ? `Kamera: Abstand ${(camera.camDistK ?? 1).toFixed(2)}, Höhe ${(camera.camHeightK ?? 1).toFixed(2)}, Nachdrehen ${(camera.camTurnK ?? 1).toFixed(2)}` : "",
    `Gerät: ${window.screen.width}×${window.screen.height} @${window.devicePixelRatio}x, ${navigator.userAgent.replace(/^Mozilla\/5\.0 \(([^)]*)\).*/, "$1")}`
  ].filter(Boolean).join("\n");
  const copy = async () => { try { await navigator.clipboard.writeText(summary()); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); } };
  return <aside className="match-measure" aria-label="Messwerte für den Gerätetest">
    <button type="button" className="match-measure__toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}>Messung {stats.fps} FPS</button>
    {open && <>
      <p>95 %: {stats.p95} ms · Ruckler: {stats.slow}</p>
      <p>Netz: {stats.gap} ms (max {stats.gapMax}) · Rundlauf {rtt ?? "–"} ms</p>
      {chase && SLIDERS.map(([key, label]) => <label key={key}><span>{label} {(camera[key] ?? 1).toFixed(2)}</span>
        <input type="range" min=".6" max="1.6" step=".05" value={camera[key] ?? 1} onChange={event => setCamera(c => ({ ...c, [key]: Number(event.target.value) }))} /></label>)}
      <button type="button" onClick={() => void copy()}>{copied ? "Kopiert" : "Werte kopieren"}</button>
    </>}
  </aside>;
}
