import { createClient, type Client, type Config, type InStatement } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import type { SavedRoom } from "../shared/roomPorts";
import { AccountStore } from "./accountStore";
import { resultStatements } from "./gameStatistics";
export type { SavedRoom } from "../shared/roomPorts";

export function deploymentDatabase(): Config {
  const url = process.env.TURSO_DATABASE_URL;
  if (url || process.env.TURSO_AUTH_TOKEN) {
    if (!url || !/^(libsql|https):\/\//.test(url) || !process.env.TURSO_AUTH_TOKEN) {
      throw new Error("Für Turso sowohl TURSO_DATABASE_URL als auch TURSO_AUTH_TOKEN konfigurieren.");
    }
    if (new URL(url).searchParams.get("tls") === "0") throw new Error("Der externe Speicher benötigt TLS.");
    return { url, authToken: process.env.TURSO_AUTH_TOKEN,
      fetch: (request: Request) => fetch(request, {
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)])
      }) };
  }
  if (process.env.RENDER) {
    console.warn("Render verwendet lokalen Spielstandspeicher. Ohne dauerhaften Datenträger können Node-Partien bei Neustarts oder Deployments verloren gehen.");
  }
  if (process.env.GSG_DATABASE_FILE) return { url: "file:" + process.env.GSG_DATABASE_FILE };
  mkdirSync(".gsg-data", { recursive: true, mode: 0o700 });
  return { url: "file:.gsg-data/rooms.db" };
}

/** A deployment takes ownership atomically. The outgoing process cannot overwrite its successor. */
export class RoomStore {
  private readonly db: Client;
  readonly accounts: AccountStore;
  private readonly owner = randomUUID();
  constructor(config: Config) { this.db = createClient(config); this.accounts = new AccountStore(this.db); }

  async load(claim: boolean): Promise<SavedRoom[]> {
    if (claim) await this.accounts.initialize();
    const setup: InStatement[] = claim ? [
      "CREATE TABLE IF NOT EXISTS gsg_writer (id INTEGER PRIMARY KEY, owner TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS gsg_rooms (code TEXT PRIMARY KEY, snapshot TEXT NOT NULL)",
      { sql: "INSERT INTO gsg_writer VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner", args: [this.owner] }
    ] : [];
    // Recovery must read the primary even after a lost database response.
    const results = await this.db.batch([...setup, "SELECT owner FROM gsg_writer WHERE id=1",
      "SELECT code, snapshot FROM gsg_rooms"], "write");
    this.checkOwner(results.at(-2)!.rows[0]?.owner);
    return results.at(-1)!.rows.map(row => {
      const saved = JSON.parse(String(row.snapshot)) as SavedRoom;
      if (saved.version !== 1 || saved.room?.code !== row.code || !Number.isFinite(saved.savedAt) ||
          !Array.isArray(saved.tokens) || !Array.isArray(saved.moveSequences)) {
        throw new Error("Unbekanntes oder beschädigtes Raumformat.");
      }
      return saved;
    });
  }

  async save(changes: Map<string, SavedRoom | null>) {
    const statements: InStatement[] = ["SELECT owner FROM gsg_writer WHERE id=1"];
    for (const [code, saved] of changes) {
      if (saved) statements.push(...resultStatements(saved.room, this.owner));
      statements.push(saved ? {
        sql: `INSERT INTO gsg_rooms(code,snapshot) SELECT ?,? FROM gsg_writer WHERE id=1 AND owner=?
              ON CONFLICT(code) DO UPDATE SET snapshot=excluded.snapshot`,
        args: [code, JSON.stringify(saved), this.owner]
      } : {
        sql: "DELETE FROM gsg_rooms WHERE code=? AND EXISTS (SELECT 1 FROM gsg_writer WHERE id=1 AND owner=?)",
        args: [code, this.owner]
      });
    }
    const result = await this.db.batch(statements, "write");
    this.checkOwner(result[0].rows[0]?.owner);
  }

  private checkOwner(owner: unknown) {
    if (owner !== this.owner) throw new Error("Ein anderer Server hat die Räume übernommen.");
  }
  close() { this.db.close(); }
}
