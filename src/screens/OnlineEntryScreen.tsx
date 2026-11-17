import { useEffect, useRef, useState } from "react";
import { CHARACTERS, isCharacterId, type CharacterId } from "../../shared/characters";
import { GameGallery, CharacterGallery } from "../components/RoomGalleries";
import { MenuIcon } from "../components/MenuIcon";
import { getGame } from "../../shared/games";
import type { Ack, GameId, GuestProfile, RoomState } from "../../shared/types";
import { IslandWorld } from "../components/IslandWorld";
import { ScreenHeader } from "../components/ScreenHeader";
import { AdventureChoice } from "../components/AdventureChoice";
import { CharacterAvatar } from "../components/CharacterAvatar";
import { displayName } from "../lib/profile";
import { tokenForJoin } from "../lib/roomSession";
import { socket, useTableTransport } from "../lib/socket";
import { GuestPair } from "../nearby/Pairing";
import { nearby } from "../nearby/nearbySocket";

type EntryMode = "host" | "join" | "test";

export function OnlineEntryScreen({ onBack, onSelect }: {
  onBack: () => void;
  onSelect: (role: "host" | "join") => void;
}) {
  return <main className="page iw-menu route-selection screen-enter">
    <IslandWorld />
    <ScreenHeader title="Online spielen" onBack={onBack} />
    <section className="page__content entry-choices">
      <AdventureChoice title="Raum erstellen" detail="Freunde zum Spiel einladen" icon="flag" onClick={() => onSelect("host")}/>
      <AdventureChoice title="Raum beitreten" detail="Mit Raumcode oder QR-Einladung" icon="door" violet onClick={() => onSelect("join")}/>
    </section>
  </main>;
}

export function RoomEntryForm({ mode, profile, testGameId = "party", onBack, onJoined, onCharacterChange }: {
  mode: EntryMode;
  /** Mode "test": the party mode chosen under "Lokal spielen → Allein mit Bots". */
  testGameId?: GameId;
  profile: GuestProfile;
  onBack: () => void;
  onJoined: (room: RoomState) => void;
  onCharacterChange: (id: CharacterId) => void;
}) {
  const [deviceHost, setDeviceHost] = useState(!navigator.onLine);
  const [qr, setQr] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bots, setBots] = useState(3);
  const [seed, setSeed] = useState("42");
  const [gameId, setGameId] = useState<GameId>(mode === "host" ? "qwixx" : testGameId);

  const active = useRef(true);
  const invitationCode = useRef("");
  const characterId = isCharacterId(profile.characterId) ? profile.characterId : undefined;
  const title = mode === "host" ? "Raum erstellen" : mode === "join" ? "Raum beitreten" : getGame(gameId).name;
  const validSeed = seed !== "" && Number.isInteger(Number(seed)) && Number(seed) >= 0 && Number(seed) <= 0xffffffff;

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    if (!qr || !characterId) return;
    const paired = () => {
      const code = invitationCode.current;
      if (!code || nearby.route?.role !== "guest") return;
      socket.timeout(8000).emit("room:join", {
        code, playerId: profile.id, sessionToken: tokenForJoin(code, profile.id),
        characterId, name: displayName(profile)
      }, (err: Error | null, response?: Ack<RoomState>) => {
        if (!active.current || invitationCode.current !== code) return;
        if (err || !response?.ok || !response.data) setError(response?.error ?? "Der Host antwortet nicht.");
        else onJoined(response.data);
      });
    };
    nearby.on("connect", paired);
    return () => { nearby.off("connect", paired); };
  }, [qr, characterId, profile, onJoined]);

  async function submit() {
    if (loading || !characterId) return;
    setLoading(true);
    setError("");
    const player = { playerId: profile.id, characterId, name: displayName(profile) };
    if (mode === "test" || (mode === "host" && deviceHost)) {
      useTableTransport({ role: "host", table: crypto.randomUUID() });
      try { await nearby.start(); }
      catch {
        if (active.current) {
          setError("Der Tisch konnte nicht geöffnet werden. Prüfe den verfügbaren Gerätespeicher.");
          setLoading(false);
        }
        return;
      }
    } else {
      useTableTransport();
      socket.connect();
    }
    if (!active.current) return;
    const done = (err: Error | null, response?: Ack<RoomState>) => {
      if (!active.current) return;
      setLoading(false);
      if (err || !response?.ok || !response.data) setError(response?.error ?? "Der Spielhost antwortet gerade nicht. Versuche es erneut.");
      else onJoined(response.data);
    };
    if (mode === "test") socket.timeout(15000).emit("party:test-create", { ...player, gameId, bots, seed: Number(seed) }, done);
    else if (mode === "host") socket.timeout(5000).emit("room:create", { ...player, gameId }, done);
    else socket.timeout(5000).emit("room:join", { ...player, code, sessionToken: tokenForJoin(code, profile.id) }, done);
  }

  function changeJoinMethod(nextQr: boolean) {
    invitationCode.current = "";
    if (qr) nearby.disconnect();
    setPairing(false);
    setError("");
    setQr(nextQr);
  }

  return <main className="page iw-menu screen-enter">
    <IslandWorld />
    <ScreenHeader title={title} onBack={onBack} />
    <div className="page__content entry-frame"><form className={`iw-card room-entry ${mode !== "test" ? "host-entry" : ""}`} onSubmit={event => { event.preventDefault(); if (!qr) void submit(); }}>
      {mode === "host" && <GameGallery gameId={gameId} disabled={loading} initiallyOpen onChange={setGameId}/>}
      {mode !== "test" ? <CharacterGallery characterId={characterId} disabled={loading || pairing} onChange={onCharacterChange}/> :
      <label className="local-character-field entry-character">
        <CharacterAvatar id={characterId} decorative />
        <span>Deine Spielfigur<select value={characterId ?? ""} disabled={loading || pairing} onChange={event => {
          if (isCharacterId(event.target.value)) onCharacterChange(event.target.value);
        }}><option value="" disabled>Figur wählen</option>{CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></span>
      </label>}
      {mode === "host" && <fieldset className="hosting-choice" disabled={loading}>
        <legend>Wo spielt ihr?</legend>
        <label><input type="radio" name="hosting" checked={!deviceHost} onChange={() => setDeviceHost(false)} /><MenuIcon name="globe"/><span><strong>Über das Internet</strong><small>Teile den Raumcode mit deinen Freunden.</small></span></label>
        <label><input type="radio" name="hosting" checked={deviceHost} onChange={() => setDeviceHost(true)} /><MenuIcon name="group"/><span><strong>Dieses Handy</strong><small>Im selben WLAN oder Hotspot per QR einladen. Lass dein Handy geöffnet.</small></span></label>
      </fieldset>}
      {mode === "join" && <>
        <fieldset className="hosting-choice" disabled={loading}>
          <legend>Deine Einladung</legend>
          <label><input type="radio" name="invitation" checked={!qr} onChange={() => changeJoinMethod(false)} /><MenuIcon name="door"/><strong>Raumcode</strong></label>
          <label><input type="radio" name="invitation" checked={qr} onChange={() => changeJoinMethod(true)} /><MenuIcon name="group"/><strong>QR vom Handy-Host</strong></label>
        </fieldset>
        {!qr && <label className="field field--code"><span>Raumcode</span><input value={code} maxLength={5} autoCapitalize="characters" placeholder="ABCDE" onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></label>}
        {qr && !characterId && <p>Wähle deine Figur, um die Einladung zu scannen.</p>}
      </>}
      {mode === "test" && <>
        <p>Du spielst allein gegen Bots. Alles läuft auf diesem Handy, auch ohne Internet, und der Spielstand bleibt hier.</p>
        <label className="field"><span>Bot-Mitspieler</span><select value={bots} onChange={e => setBots(Number(e.target.value))}>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n} {n === 1 ? "Bot" : "Bots"}</option>)}</select></label>
        <details><summary>Startwert anpassen</summary><label className="field"><span>Startwert für wiederholbare Partien</span><input type="number" min="0" max="4294967295" value={seed} onChange={e => setSeed(e.target.value)} /></label></details>
      </>}
      {!qr && <button className="button button--primary button--wide" disabled={!characterId || loading || (mode === "join" && code.length !== 5) || (mode === "test" && !validSeed)}>
        {loading ? "Verbindung wird hergestellt …" : mode === "host" ? "Neuen Raum erstellen" : mode === "test" ? "Testpartie mit Bots erstellen" : title}
      </button>}
      {error && <p className="error-message" role="alert">{error}</p>}
    </form>
    {qr && characterId && <div className="iw-card room-entry qr-entry"><GuestPair onReset={() => { setPairing(false); invitationCode.current = ""; setError(""); }} onOffer={(code, table) => {
      if (!active.current) return;
      setPairing(true);
      invitationCode.current = code;
      useTableTransport({ table, role: "guest" });
    }} /></div>}
    </div>
  </main>;
}
