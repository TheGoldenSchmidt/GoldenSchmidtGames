import type { Kind } from "./rules";

const emblems: Record<Kind, string> = {
  rabbit: "M5 15c0-2 1.2-3.4 3-4.2C6.2 7.1 6 2.6 7.7 2c1.9-.6 3.4 4.3 3.9 7.8h.8c.5-3.5 2-8.4 3.9-7.8 1.7.6 1.5 5.1-.3 8.8 1.8.8 3 2.2 3 4.2 0 3.5-3.2 6.3-7 6.3S5 18.5 5 15Z M8 14a1 1 0 1 0 2 0 1 1 0 1 0-2 0Zm6 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0Zm-3.5 3.4 1.5 1.4 1.5-1.4Z",
  monkey: "M12 5c3.5 0 6.3 1.7 7.5 4.6a3 3 0 1 1 .5 5.9C19 19 16 21 12 21s-7-2-8-5.5a3 3 0 1 1 .5-5.9C5.7 6.7 8.5 5 12 5Zm0 7c-2.5-3.5-6.9-1.9-6 1.7.3 1.4 1.1 1.8 2 2.5-.4 1.7 1.6 3 4 3s4.4-1.3 4-3c.9-.7 1.7-1.1 2-2.5.9-3.6-3.5-5.2-6-1.7Z M8 13a1 1 0 1 0 2 0 1 1 0 1 0-2 0Zm6 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0Zm-4 4h4v1h-4Z",
  deer: "M8.6 10.4 5 9.8c.3 2.1 1.7 3.5 3.9 3.7l.5 3.8L12 22l2.6-4.7.5-3.8c2.2-.2 3.6-1.6 3.9-3.7l-3.6.6c-2-1.4-4.8-1.4-6.8 0Zm.8 3 1.6 1-.4 1.3-1.4-1.1Zm5.2 0 .2 1.2-1.4 1.1-.4-1.3ZM11 18h2l-1 1.5Z",
};

export function PieceEmblem({ kind }: { kind: Kind }) {
  return (
    <svg className="hare-emblem" x="-9.5" y="-9.5" width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
      {kind === "deer" && <path d="M10 11C4 9 2 5 4 1m3 8C5 6 6 4 7 2m2 8C8 6 10 5 10 3m4 8c6-2 8-6 6-10m-3 8c2-3 1-5 0-7m-2 8c1-4-1-5-1-7"
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
      <path d={emblems[kind]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
