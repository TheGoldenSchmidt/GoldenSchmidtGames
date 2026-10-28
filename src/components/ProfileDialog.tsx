import { useEffect, useState } from "react";
import type { GuestProfile } from "../../shared/types";

export function ProfileDialog({
  profile,
  onSave,
  onClose
}: {
  profile: GuestProfile;
  onSave: (profile: GuestProfile) => void;
  onClose: () => void;
}) {
  const [username, setUsername] = useState(profile.username);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog__handle" aria-hidden="true" />
        <h2 id="profile-title">Dein Gastprofil</h2>
        <p className="muted">
          Der Name ist optional und wird nur auf diesem Gerät gespeichert. Ein Konto für Statistiken folgt später.
        </p>
        <label className="field">
          <span>Anzeigename</span>
          <input
            value={username}
            maxLength={24}
            placeholder="Zum Beispiel Alex"
            autoFocus
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <div className="dialog__actions">
          <button className="button button--ghost" onClick={onClose}>Abbrechen</button>
          <button
            className="button button--primary"
            onClick={() => onSave({ ...profile, username: username.trim() })}
          >
            Speichern
          </button>
        </div>
      </section>
    </div>
  );
}
