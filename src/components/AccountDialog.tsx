import { useEffect, useRef, useState } from "react";
import { GAMES } from "../../shared/games";
import { ROLE_NAMES, type Account, type AccountRole, type GameStatistic } from "../../shared/accounts";
import { accountRequest } from "../lib/account";
import type { GuestProfile } from "../../shared/types";
import { soundEnabled } from "../matches/sfx";
import "../styles/account.css";

export function AccountDialog({ account, profile, onAccount, onGuestSave, onClose }: {
  account?: Account; profile: GuestProfile; onAccount: (account?: Account) => void;
  onGuestSave: (profile: GuestProfile) => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invitation, setInvitation] = useState("");
  const [name, setName] = useState(profile.username);
  const [sound, setSound] = useState(soundEnabled);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [statistics, setStatistics] = useState<GameStatistic[]>();
  const [users, setUsers] = useState<Account[]>();
  const [inviteRole, setInviteRole] = useState<AccountRole>("player");
  const [newInvite, setNewInvite] = useState("");
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    setName(account?.settings.displayName ?? profile.username);
    setSound(account?.settings.sound ?? soundEnabled());
  }, [account?.id]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    if (!account) return;
    let active = true;
    accountRequest<{ statistics: GameStatistic[] }>("/statistics").then(data => { if (active) setStatistics(data.statistics); })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [account?.id]);
  async function perform(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await work(); } catch (error) { setError(error instanceof Error ? error.message : "Bitte erneut versuchen."); }
    finally { setBusy(false); }
  }
  function trap(event: React.KeyboardEvent) {
    if (event.key === "Escape" && !busy) onClose();
    if (event.key !== "Tab") return;
    const controls = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, summary, textarea')]
      .filter(element => element.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <div className="dialog-backdrop" onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={dialog} tabIndex={-1} className="dialog iw-dialog account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title" onKeyDown={trap}>
      <div className="account-dialog__heading"><h2 id="account-title" className="iw-plank">{account ? "Dein Konto" : "Profil & Anmeldung"}</h2>
        <button className="button button--ghost" aria-label="Profil schließen" onClick={onClose} disabled={busy}>×</button></div>
      {error && <p role="alert" className="error-message">{error}</p>}
      {message && <p role="status">{message}</p>}
      {account ? <>
        <p className="account-dialog__identity"><strong>{account.username}</strong><span className="iw-chip">{ROLE_NAMES[account.role]}</span></p>
        <form onSubmit={event => { event.preventDefault(); void perform(async () => {
          const result = await accountRequest<{ account: Account }>("/settings", "PUT", { ...account.settings, displayName: name, sound });
          onAccount(result.account); setMessage("Einstellungen gespeichert.");
        }); }}>
          <label className="field"><span>Anzeigename</span><input value={name} required maxLength={24} onChange={event => setName(event.target.value)}/></label>
          <label className="account-dialog__toggle"><span>Spieltöne</span><input type="checkbox" checked={sound} onChange={event => setSound(event.target.checked)}/></label>
          <button className="button button--primary button--wide" disabled={busy}>Einstellungen speichern</button>
        </form>
        <details className="account-dialog__section"><summary>Deine Statistiken</summary>
          <p>Abgeschlossene Online-Partien auf dem Spielserver. Lokale Spiele und Bot-Tests zählen nicht.</p>
          {statistics === undefined ? <p>Statistiken werden geladen …</p> : !statistics.length ? <p>Noch keine Online-Partie abgeschlossen.</p> :
            <table><thead><tr><th>Spiel</th><th>Partien</th><th>Siege</th></tr></thead><tbody>{statistics.map(stat =>
              <tr key={stat.gameId}><td>{GAMES.find(game => game.id === stat.gameId)?.name ?? stat.gameId}</td><td>{stat.played}</td><td>{stat.won}</td></tr>)}</tbody></table>}
        </details>
        {account.role === "admin" && <details className="account-dialog__section" onToggle={event => {
          if (event.currentTarget.open && !users) void perform(async () => { setUsers((await accountRequest<{ users: Account[] }>("/users")).users); });
        }}><summary>Einladungen & Rechte</summary>
          <label className="field"><span>Rolle für die Einladung</span><select value={inviteRole} onChange={event => setInviteRole(event.target.value as AccountRole)}>
            <option value="player">Spieler</option><option value="developer">Entwickler</option></select></label>
          <button className="button button--secondary button--wide" disabled={busy} onClick={() => void perform(async () => {
            setNewInvite((await accountRequest<{ invitation: string }>("/invitations", "POST", { role: inviteRole })).invitation);
          })}>Einladung erstellen</button>
          {newInvite && <label className="field"><span>Einmaliger Code · 7 Tage gültig</span><textarea readOnly value={newInvite} onFocus={event => event.target.select()}/></label>}
          <p>Entwickler können den Proberaum öffnen. Nur du verwaltest Einladungen und Rechte.</p>
          {users?.map(user => <label key={user.id} className="account-dialog__user"><span>{user.username}</span>
            <select aria-label={`Rolle von ${user.username}`} value={user.role} disabled={busy || user.role === "admin"} onChange={event => {
              const role = event.target.value;
              void perform(async () => {
                await accountRequest(`/users/${user.id}/role`, "PUT", { role });
                setUsers((await accountRequest<{ users: Account[] }>("/users")).users); setMessage("Rolle gespeichert.");
              });
            }}><option value="player">Spieler</option><option value="developer">Entwickler</option>{user.role === "admin" && <option value="admin">Admin</option>}</select></label>)}
        </details>}
        <button className="button button--ghost button--wide" disabled={busy} onClick={() => void perform(async () => {
          await accountRequest("/logout", "POST", {}); onAccount(undefined); onClose();
        })}>Abmelden</button>
      </> : <>
        <form onSubmit={event => { event.preventDefault(); void perform(async () => {
          const result = await accountRequest<{ account: Account }>(`/${mode}`, "POST", { username, password, invitation });
          setPassword(""); setInvitation(""); onAccount(result.account); onClose();
        }); }}>
          <label className="field"><span>Nutzername</span><input autoComplete="username" value={username} required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_-]+" onChange={event => setUsername(event.target.value)}/></label>
          <label className="field"><span>Passwort</span><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} required minLength={mode === "register" ? 12 : undefined} maxLength={128} onChange={event => setPassword(event.target.value)}/></label>
          {mode === "register" && <><label className="field"><span>Einladungscode</span><input autoComplete="off" value={invitation} required maxLength={256} onChange={event => setInvitation(event.target.value.trim())}/></label><p>Wähle ein Passwort mit mindestens 12 Zeichen.</p></>}
          <button className="button button--primary button--wide" disabled={busy}>{busy ? "Bitte warten …" : mode === "login" ? "Anmelden" : "Konto erstellen"}</button>
        </form>
        <button className="button button--ghost button--wide" disabled={busy} onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "Ich habe eine Einladung" : "Ich habe bereits ein Konto"}</button>
        <details className="account-dialog__section"><summary>Ohne Konto als Gast spielen</summary><p>Dein Gastname bleibt auf diesem Gerät. Statistiken werden für Gäste nicht gespeichert.</p>
          <label className="field"><span>Gastname</span><input value={name} maxLength={24} onChange={event => setName(event.target.value)}/></label>
          <button className="button button--secondary button--wide" disabled={busy} onClick={() => onGuestSave({ ...profile, username: name.trim() })}>Gastprofil speichern</button>
        </details>
      </>}
    </section>
  </div>;
}
