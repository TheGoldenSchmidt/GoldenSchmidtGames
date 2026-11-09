import type { RoomPeer } from "./roomPorts";
import type { Ack } from "./types";
import type { RoomTransactions } from "./roomTransactions";

type Reply<T> = (result: Ack<T>) => void;
interface Move { sequence: number; code: string; id: string }
type SequenceMove = (move: Move, perform: (done: Reply<unknown>) => void, reply: Reply<unknown>) => void;

function isReply(value: unknown): value is Reply<unknown> { return typeof value === "function"; }
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

// Keep the original wire format for cached clients. New turn-based clients add
// their next sequence number before the acknowledgement to make retries idempotent.
export function socketRequests(socket: RoomPeer, tx: RoomTransactions, sequenceMove: SequenceMove) {
  let pending = 0;
  function register(event: string, payloadCount: number, optionalReply: boolean,
    handle: (payload: unknown, reply: Reply<unknown>, acknowledged: boolean) => void) {
    const sequenced = /^(qwixx|durak|kribbeln):/.test(event) && !event.endsWith(":state");
    socket.on(event, (...args: unknown[]) => {
      const last = args.at(-1);
      const reply = isReply(last) ? last : undefined;
      if (reply) args.pop();
      if (!reply && !optionalReply) return;
      let move: Move | undefined;
      if (sequenced && args.length === payloadCount + 1) {
        const meta = args.pop();
        if (!isRecord(meta) || !Number.isSafeInteger(meta.moveSequence) || Number(meta.moveSequence) <= 0 ||
            typeof meta.code !== "string" || typeof meta.id !== "string" || !/^[a-zA-Z0-9-]{1,64}$/.test(meta.id)) {
          reply?.({ ok: false, error: "Ungültige Zugnummer." }); return;
        }
        move = { sequence: Number(meta.moveSequence), code: meta.code, id: meta.id };
      }
      if (args.length !== payloadCount || (payloadCount && !isRecord(args[0]))) {
        reply?.({ ok: false, error: "Ungültige Nachricht." }); return;
      }
      if (pending >= 32) {
        reply?.({ ok: false, error: "Der Server verarbeitet noch Eingaben.", retryable: true });
        return;
      }
      pending++;
      const receivedAt = Date.now();
      void tx.run(() => {
        if (!socket.connected) return;
        if (event === "party:control" && Date.now() - receivedAt > 300) {
          reply?.({ ok: true, data: { accepted: false } });
          return;
        }
        const publish: Reply<unknown> = result => {
          if (reply) tx.publish(() => reply(result));
        };
        const execute = (done: Reply<unknown>) => handle(args[0], done, !!reply);
        if (move) sequenceMove(move, execute, publish);
        else execute(publish);
      }, () => reply?.({ ok: false, error: "Spielstandspeicher vorübergehend nicht erreichbar.", retryable: true }))
        .finally(() => { pending--; });
    });
  }
  function withPayload<P extends object, T>(event: string,
    handle: (payload: P, reply: Reply<T>, acknowledged: boolean) => void, optionalReply = false) {
    register(event, 1, optionalReply, (payload, reply, ack) => handle(payload as P, reply, ack));
  }
  function withoutPayload<T>(event: string, handle: (reply: Reply<T>) => void) {
    register(event, 0, false, (_, reply) => handle(reply));
  }
  return { withPayload, withoutPayload };
}
