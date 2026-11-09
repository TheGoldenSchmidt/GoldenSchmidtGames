import type { RoomStorage, SavedRoom } from "../../shared/roomPorts";

/** One database per table. Changes and the writer's generation are checked in one transaction. */
export class HostStore implements RoomStorage {
  private readonly owner = crypto.randomUUID();
  private readonly database: Promise<IDBDatabase>;
  constructor(key: string) {
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open("gsg.table." + key, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("rooms");
        request.result.createObjectStore("meta");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  private async write<T>(claim: boolean, work: (rooms: IDBObjectStore, done: (value:T) => void) => void) {
    const db = await this.database;
    return new Promise<T>((resolve,reject) => {
      const tx = db.transaction(["meta","rooms"], "readwrite", { durability: "strict" });
      let result: T;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error ?? new Error("Der Tisch ist in einem anderen Fenster geöffnet."));
      const meta = tx.objectStore("meta"), owner = meta.get("owner");
      owner.onsuccess = () => {
        if (claim) meta.put(this.owner, "owner");
        else if (owner.result !== this.owner) { tx.abort(); return; }
        work(tx.objectStore("rooms"), value => { result = value; });
      };
    });
  }
  load(claim: boolean) {
    return this.write<SavedRoom[]>(claim, (rooms, done) => {
      const request = rooms.getAll();
      request.onsuccess = () => done(request.result);
    });
  }
  save(changes: Map<string, SavedRoom | null>) {
    return this.write<void>(false, (rooms, done) => {
      for (const [code, value] of changes) { if (value) rooms.put(value, code); else rooms.delete(code); }
      done();
    });
  }
  close() { void this.database.then(db => db.close()); }
}
