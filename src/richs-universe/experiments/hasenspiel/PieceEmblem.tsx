import type { Kind } from "./rules";

const emblems: Record<Kind, { outline: string; detail: string }> = {
  rabbit: {
    outline: "M8.2 10.8C6.2 7.6 4.8 2.6 6.6 1.9c1.8-.7 4.2 4.5 4.9 8h1c.4-3.8 2.1-8.6 3.9-8 1.8.7.8 5.5-1.1 8.8 2.5 1.2 3.7 3.3 3.3 5.5-.5 3.1-3.6 5.6-6.6 5.6s-6.2-2.4-6.7-5.5c-.4-2.3.7-4.3 2.9-5.5Z",
    detail: "M7.4 4.6l1.7 4.2m6.5-4.1-1.2 4.1M8.9 14h.35m5.45 0h.35m-4.3 3 1.25.85 1.25-.85M12 18v1",
  },
  monkey: {
    outline: "M4.8 10C5.6 6.4 8.1 4.5 12 4.5s6.4 1.9 7.2 5.5c4-1.6 5.2 4.9.7 5.3-.7 3.9-3.8 6.1-7.9 6.1s-7.2-2.2-7.9-6.1C-.4 14.9.8 8.4 4.8 10Z",
    detail: "M6.4 13c-.3-3.8 3.1-4.8 5.6-1.8 2.5-3 5.9-2 5.6 1.8M8.8 13.5h.4m5.2 0h.4m-5.2 3.2q2.4 2.2 4.8 0",
  },
  deer: {
    outline: "M8.5 11.6 4.7 10q.4 3.4 3.7 4.2l1.1 4.5 2.5 3 2.5-3 1.1-4.5q3.3-.8 3.7-4.2l-3.8 1.6q-3.5-2.2-7 0Z",
    detail: "M9.5 10.9C5 8.7 2.4 5.6 3.1 1.5M5.9 8Q4.8 5.4 6.1 3m2.6 7Q7.7 7 8.9 5.5m5.6 5.4C19 8.7 21.6 5.6 20.9 1.5M18.1 8q1.1-2.6-.2-5m-2.6 7q1-3-.2-4.5M9.6 14.2l.7.5m4.1-.5-.7.5m-2.7 3.7 1 .7 1-.7",
  },
};

export function PieceEmblem({ kind }: { kind: Kind }) {
  const { outline, detail } = emblems[kind];
  return (
    <svg className="hare-emblem" x="-10" y="-10" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d={outline} strokeWidth="1.55" />
      <path d={detail} strokeWidth="1.25" />
    </svg>
  );
}
