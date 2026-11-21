import { useEffect, useState, type CSSProperties } from "react";

const duration = 2200;
const leaves = [6, 14, 21, 30, 35, 43, 51, 57, 64, 70, 78, 82, 90, 96];
const colors = ["#edd58b", "#b27d55", "#819d68", "#b4c786"];

export function Victory({ title }: { title: string }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }
    const timer = window.setTimeout(() => setRevealed(true), duration);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="hare-victory">
      {!revealed && <div className="hare-leaves" aria-hidden="true">
        {leaves.map((lane, index) => {
          const delay = index % 5 * 90;
          return <span key={lane} style={{
            "--leaf-top": `${lane}%`,
            "--leaf-delay": `${delay}ms`,
            "--leaf-duration": `${duration - delay}ms`,
            "--leaf-size": `${13 + index % 4 * 4}px`,
            "--leaf-color": colors[index % colors.length]
          } as CSSProperties} />;
        })}
      </div>}
      <div className="hare-announcement" role="status" aria-atomic="true">
        {revealed && <strong>{title}</strong>}
      </div>
    </div>
  );
}
