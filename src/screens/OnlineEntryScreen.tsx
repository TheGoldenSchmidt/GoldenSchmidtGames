import { useState } from "react";
import type { GuestProfile, RoomState } from "../../shared/types";
import { ScreenHeader } from "../components/ScreenHeader";
import { displayName } from "../lib/profile";
import { socket } from "../lib/socket";

export function OnlineEntryScreen({
  profile,
  onBack,
  onJoined
}: {
  profile: GuestProfile;
  onBack: () => void;
  onJoined: (room: RoomState) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function ensureConnection() {
    if (!socket.connected) socket.connect();
  }

  function createRoom() {
    setLoading(true);
    setError("");
    ensureConnection();
    socket.timeout(5000).emit(
      "room:create",
      { playerId: profile.id, name: displayName(profile) },
      (timeoutError: Error | null, response: { ok: boolean; data?: RoomState; error?: string }) => {
        setLoading(false);
        if (timeoutError) return setError("Der Server antwortet gerade nicht.");
        if (!response.ok || !response.data) return setError(response.error ?? "Raum konnte nicht erstellt werden.");
        onJoined(response.data);
      }
    );
  }

  function joinRoom() {
    if (code.length < 5) return setError("Bitte gib den vollständigen Raumcode ein.");
    setLoading(true);
    setError("");
    ensureConnection();
    socket.timeout(5000).emit(
      "room:join",
      { code, playerId: profile.id, name: displayName(profile) },
      (timeoutError: Error | null, response: { ok: boolean; data?: RoomState; error?: string }) => {
        setLoading(false);
        if (timeoutError) return setError("Der Server antwortet gerade nicht.");
        if (!response.ok || !response.data) return setError(response.error ?? "Beitritt nicht möglich.");
        onJoined(response.data);
      }
    );
  }

  return (
    <main className="page screen-enter">
      <ScreenHeader title="Online spielen" onBack={onBack} />
      <section className="page__content online-entry">
        <div className="online-hero" aria-hidden="true">
          <span className="online-hero__table"><i /><i /><i /></span>
        </div>
        <div className="section-heading section-heading--center">
          <h2>Zusammen an einen Tisch</h2>
          <p>Erstelle einen Raum oder tritt mit einem fünfstelligen Code bei.</p>
        </div>

        <button className="button button--primary button--wide" onClick={createRoom} disabled={loading}>
          {loading ? "Verbindung wird hergestellt …" : "Neuen Raum erstellen"}
        </button>

        <div className="or-divider"><span>oder</span></div>

        <label className="field field--code">
          <span>Raumcode</span>
          <input
            value={code}
            maxLength={5}
            inputMode="text"
            autoCapitalize="characters"
            placeholder="ABCDE"
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          />
        </label>
        <button className="button button--secondary button--wide" onClick={joinRoom} disabled={loading || code.length < 5}>
          Raum beitreten
        </button>
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>
    </main>
  );
}
