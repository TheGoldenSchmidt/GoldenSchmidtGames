import type { RoomStorage, SavedRoom } from "./roomPorts";

/** Socket requests, disconnects and the arena clock share one ordered commit boundary. */
export class RoomTransactions {
  private tail: Promise<void> = Promise.resolve();
  private changes = new Set<string>();
  private effects: (() => void)[] = [];
  available = false;
  constructor(private store: RoomStorage, private snapshot: (code: string) => SavedRoom | null,
    private onFailure: (error: unknown) => void) {}

  dirty(code: string) { this.changes.add(code); }
  publish(effect: () => void) { this.effects.push(effect); }
  drain() { return this.tail; }

  run(work: () => void, rejected?: () => void): Promise<void> {
    this.tail = this.tail.then(async () => {
      if (!this.available) { rejected?.(); return; }
      this.changes.clear();
      this.effects = [];
      try {
        work();
        if (this.changes.size) {
          await this.store.save(new Map([...this.changes].map(code => [code, this.snapshot(code)])));
        }
        for (const effect of this.effects) effect();
      } catch (error) {
        // Commit outcome may be unknown. Resume only from the database, never this draft.
        this.available = false;
        rejected?.();
        this.onFailure(error);
      } finally {
        this.effects = [];
      }
    });
    return this.tail;
  }
}
