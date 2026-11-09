export const localHost = "host";
export type Wire =
  | { kind: "call"; event: string; args: unknown[]; request?: number }
  | { kind: "ack"; request: number; data: unknown }
  | { kind: "event"; event: string; data: unknown };
export type ToWorker =
  | { kind: "start"; key: string }
  | { kind: "connect" | "disconnect"; peer: string }
  | { kind: "visibility"; hidden: boolean }
  | { kind: "message"; peer: string; packet: Extract<Wire, {kind:"call"}> };
export type FromWorker =
  | { kind: "ready" | "error" }
  | { kind: "close"; peer: string }
  | { kind: "message"; peer: string; packet: Wire };

export function isCall(value: unknown): value is Extract<Wire, {kind:"call"}> {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<Extract<Wire, {kind:"call"}>>;
  return p.kind === "call" && typeof p.event === "string" && /^[a-z]+:[a-z-]{1,24}$/.test(p.event)
    && Array.isArray(p.args) && p.args.length <= 2 && (p.request === undefined || Number.isSafeInteger(p.request));
}
