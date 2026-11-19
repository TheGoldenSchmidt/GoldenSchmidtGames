import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Client, Row } from "@libsql/client";
import { type Account, type AccountRole, type AccountSettings, type GameStatistic } from "../shared/accounts";
import { isCharacterId } from "../shared/characters";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_PATTERN = /^.{12,128}$/su;
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, (error, result) => error ? reject(error) : resolve(result));
});
function account(row: Row): Account {
  return { id: String(row.id), username: String(row.username), role: row.role as AccountRole,
    settings: JSON.parse(String(row.settings)) as AccountSettings };
}
export class AccountError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export class AccountStore {
  constructor(private db: Client) {}

  async initialize(bootstrapToken?: string) {
    await this.db.batch([
      `CREATE TABLE IF NOT EXISTS gsg_accounts (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('player','developer','admin')), settings TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS gsg_sessions (token TEXT PRIMARY KEY, account_id TEXT NOT NULL, expires INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS gsg_invitations (token TEXT PRIMARY KEY, role TEXT NOT NULL, expires INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS gsg_results (match_id TEXT NOT NULL, account_id TEXT NOT NULL, game_id TEXT NOT NULL,
        won INTEGER NOT NULL, PRIMARY KEY(match_id, account_id))`,
      "CREATE INDEX IF NOT EXISTS gsg_results_account ON gsg_results(account_id)",
      { sql: "DELETE FROM gsg_sessions WHERE expires <= ?", args: [Date.now()] },
      // Keep an expired bootstrap hash so restarting cannot renew the same owner invitation.
      { sql: "DELETE FROM gsg_invitations WHERE expires <= ? AND role!='admin'", args: [Date.now()] }
    ], "write");
    if (bootstrapToken) {
      if (bootstrapToken.length < 32) throw new Error("GSG_ADMIN_INVITE benötigt mindestens 32 Zeichen.");
      // A deployment never reopens registration once the first account exists.
      await this.db.execute({ sql: `INSERT INTO gsg_invitations(token,role,expires)
        SELECT ?, 'admin', ? WHERE NOT EXISTS (SELECT 1 FROM gsg_accounts)
        ON CONFLICT(token) DO NOTHING`, args: [hashToken(bootstrapToken), Date.now() + 7 * 86400000] });
    }
  }

  async register(username: unknown, password: unknown, invitation: unknown) {
    if (typeof username !== "string" || !/^[a-zA-Z0-9_-]{3,24}$/.test(username))
      throw new AccountError("Nutzername: 3–24 Buchstaben, Ziffern, _ oder -.");
    if (typeof password !== "string" || password.length > 128 || !PASSWORD_PATTERN.test(password))
      throw new AccountError("Wähle ein Passwort mit 12–128 Zeichen.");
    if (typeof invitation !== "string" || invitation.length > 256) throw new AccountError("Ungültiger Einladungscode.");
    const salt = newToken();
    const encoded = salt + ":" + (await derive(password, salt)).toString("hex");
    const token = newToken();
    const id = "acct_" + newToken();
    const tx = await this.db.transaction("write");
    try {
      const invite = (await tx.execute({ sql: "SELECT role FROM gsg_invitations WHERE token=? AND expires>?",
        args: [hashToken(invitation), Date.now()] })).rows[0];
      if (!invite) throw new AccountError("Einladung ungültig, abgelaufen oder bereits verwendet.");
      if ((await tx.execute({ sql: "SELECT id FROM gsg_accounts WHERE username=?", args: [username] })).rows.length)
        throw new AccountError("Dieser Nutzername ist schon vergeben.");
      const settings: AccountSettings = { displayName: username, sound: true };
      await tx.execute({ sql: "INSERT INTO gsg_accounts VALUES (?,?,?,?,?)", args: [id, username, encoded, String(invite.role), JSON.stringify(settings)] });
      await tx.execute({ sql: "DELETE FROM gsg_invitations WHERE token=?", args: [hashToken(invitation)] });
      // Invalidate all bootstrap invitations when the owner registers.
      if (invite.role === "admin") await tx.execute("DELETE FROM gsg_invitations WHERE role='admin'");
      await tx.execute({ sql: "INSERT INTO gsg_sessions VALUES (?,?,?)", args: [hashToken(token), id, Date.now() + SESSION_MS] });
      await tx.commit();
      return { account: { id, username, role: invite.role as AccountRole, settings }, token };
    } finally { if (!tx.closed) await tx.rollback(); tx.close(); }
  }

  async login(username: unknown, password: unknown) {
    if (typeof username !== "string" || username.length > 24 || typeof password !== "string" || password.length > 128)
      throw new AccountError("Nutzername oder Passwort stimmt nicht.", 401);
    const row = (await this.db.execute({ sql: "SELECT * FROM gsg_accounts WHERE username=?", args: [username] })).rows[0];
    // Same expensive hash for missing accounts to avoid a username timing oracle.
    const [salt, stored] = String(row?.password ?? "missing:" + "00".repeat(64)).split(":");
    const actual = await derive(password, salt);
    if (!timingSafeEqual(actual, Buffer.from(stored, "hex")) || !row) throw new AccountError("Nutzername oder Passwort stimmt nicht.", 401);
    const token = newToken();
    await this.db.execute({ sql: "INSERT INTO gsg_sessions VALUES (?,?,?)", args: [hashToken(token), String(row.id), Date.now() + SESSION_MS] });
    return { account: account(row), token };
  }

  async session(token: string | undefined): Promise<Account | undefined> {
    if (!token) return undefined;
    const row = (await this.db.execute({ sql: `SELECT a.* FROM gsg_sessions s JOIN gsg_accounts a ON a.id=s.account_id
      WHERE s.token=? AND s.expires>?`, args: [hashToken(token), Date.now()] })).rows[0];
    return row ? account(row) : undefined;
  }
  async logout(token: string) { await this.db.execute({ sql: "DELETE FROM gsg_sessions WHERE token=?", args: [hashToken(token)] }); }
  async settings(id: string, value: unknown) {
    const s = value as Partial<AccountSettings> | null;
    if (!s || typeof s.displayName !== "string" || !s.displayName.trim() || s.displayName.trim().length > 24 ||
      typeof s.sound !== "boolean" || (s.characterId !== undefined && !isCharacterId(s.characterId)))
      throw new AccountError("Prüfe Anzeigename, Figur und Spieleton.");
    const settings: AccountSettings = { displayName: s.displayName.trim(), characterId: s.characterId, sound: s.sound };
    await this.db.execute({ sql: "UPDATE gsg_accounts SET settings=? WHERE id=?", args: [JSON.stringify(settings), id] });
    return settings;
  }
  async invite(role: unknown) {
    if (role !== "player" && role !== "developer") throw new AccountError("Einladungen sind für Spieler oder Entwickler möglich.");
    const token = newToken();
    await this.db.execute({ sql: "INSERT INTO gsg_invitations VALUES (?,?,?)", args: [hashToken(token), role, Date.now() + 7 * 86400000] });
    return token;
  }
  async list() {
    return (await this.db.execute("SELECT * FROM gsg_accounts ORDER BY username")).rows.map(account);
  }
  async setRole(id: string, role: unknown) {
    if (role !== "player" && role !== "developer") throw new AccountError("Wähle Spieler oder Entwickler.");
    // The bootstrap owner remains admin, so lockout is impossible. Other roles are editable.
    const result = await this.db.execute({ sql: "UPDATE gsg_accounts SET role=? WHERE id=? AND role!='admin'", args: [String(role), id] });
    if (!result.rowsAffected) throw new AccountError("Konto nicht gefunden oder Adminrolle geschützt.");
  }
  async statistics(id: string): Promise<GameStatistic[]> {
    const rows = (await this.db.execute({ sql: `SELECT game_id, COUNT(*) played, SUM(won) won FROM gsg_results
      WHERE account_id=? GROUP BY game_id ORDER BY game_id`, args: [id] })).rows;
    return rows.map(row => ({ gameId: String(row.game_id) as GameStatistic["gameId"], played: Number(row.played), won: Number(row.won) }));
  }
}
