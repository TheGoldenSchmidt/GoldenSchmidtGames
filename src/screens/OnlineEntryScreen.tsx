import { useState } from "react";
import type { GuestProfile, RoomState } from "../../shared/types";
import { ScreenHeader } from "../components/ScreenHeader";
import { displayName } from "../lib/profile";
import { socket } from "../lib/socket";
import {PartyCharacterPicker} from "../components/PartyCharacterPicker";
import {isCharacterId,type CharacterId} from "../../shared/characters";

export function OnlineEntryScreen({
  profile,
  onBack,
  onJoined,
  onCharacterChange
}: {
  profile: GuestProfile;
  onBack: () => void;
  onJoined: (room: RoomState) => void;
  onCharacterChange:(id:CharacterId)=>void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bots,setBots]=useState(3),[seed,setSeed]=useState("42");
  const selected=isCharacterId(profile.characterId)?profile.characterId:undefined;

  function createTest(){
    if(!selected)return setError("Wähle zuerst deine Spielfigur.");
    setLoading(true);setError("");ensureConnection();
    socket.timeout(15000).emit("party:test-create",{playerId:profile.id,name:displayName(profile),characterId:selected,bots,seed:Number(seed)},(err:Error|null,response:{ok:boolean;data?:RoomState;error?:string})=>{setLoading(false);if(err||!response.ok||!response.data)return setError(response?.error??"Der Server antwortet gerade nicht.");onJoined(response.data);});
  }

  function ensureConnection() {
    if (!socket.connected) socket.connect();
  }

  function createRoom() {
    if(!selected)return setError("Wähle zuerst deine Spielfigur.");
    setLoading(true);
    setError("");
    ensureConnection();
    socket.timeout(5000).emit(
      "room:create",
      { playerId: profile.id, name: displayName(profile), characterId:selected },
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
    if(!selected)return setError("Wähle zuerst deine Spielfigur.");
    setLoading(true);
    setError("");
    ensureConnection();
    socket.timeout(5000).emit(
      "room:join",
      { code, playerId: profile.id, name: displayName(profile), characterId:selected },
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

        <div className="section-heading section-heading--center">
          <h2>Zusammen an einen Tisch</h2>
          <p>Erstelle einen Raum oder tritt mit einem fünfstelligen Code bei.</p>
        </div>

        <PartyCharacterPicker value={selected} disabled={loading} onChange={onCharacterChange}/>

        <button className="button button--primary button--wide" onClick={createRoom} disabled={loading||!selected}>
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
        <button className="button button--secondary button--wide" onClick={joinRoom} disabled={loading || !selected || code.length < 5}>
          Raum beitreten
        </button>
        <details className="party-test-entry"><summary>Inselparty alleine testen</summary><p>Eine vollständige Online-Partie mit Bots. Wähle deine Figur, spiele alle Runden oder starte ein bestimmtes Minispiel.</p>
          <label>Bot-Mitspieler<select value={bots} disabled={loading||!selected} onChange={e=>setBots(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} {n===1?"Bot":"Bots"}</option>)}</select></label>
          <label>Startwert für wiederholbare Partien<input type="number" min="0" max="4294967295" step="1" value={seed} onChange={e=>setSeed(e.target.value)}/></label>
          <button className="button button--primary button--wide" disabled={loading||!selected||seed===""||!Number.isInteger(Number(seed))||Number(seed)<0||Number(seed)>0xffffffff} onClick={createTest}>{loading?"Testpartie wird vorbereitet …":"Testpartie mit Bots erstellen"}</button>
        </details>
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>
    </main>
  );
}
