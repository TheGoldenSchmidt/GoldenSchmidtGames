import { useState, useEffect, useRef } from "react";
import type { GuestProfile, RoomState } from "../../shared/types";
import { ScreenHeader } from "../components/ScreenHeader";
import { displayName } from "../lib/profile";
import { nearby } from "../nearby/nearbySocket";
import { GuestPair } from "../nearby/Pairing";
import { socket, useTableTransport } from "../lib/socket";
import { tokenForJoin } from "../lib/roomSession";
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
  const [nearbyMode, setNearbyMode] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bots,setBots]=useState(3),[seed,setSeed]=useState("42");
  const selected=isCharacterId(profile.characterId)?profile.characterId:undefined;

  const invitationCode = useRef("");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const paired = () => {
      const code = invitationCode.current;
      if (!code || nearby.route?.role !== "guest" || !selected) return;
      socket.timeout(8000).emit("room:join", { code, playerId:profile.id, sessionToken:tokenForJoin(code,profile.id),
        characterId:selected, name:displayName(profile) }, (err:Error|null,res:{ok:boolean;data?:RoomState;error?:string})=>{
        if (!active.current) return;
        if (err || !res?.ok || !res.data) setError(res?.error ?? "Der Host antwortet nicht.");
        else onJoined(res.data);
      });
    };
    nearby.on("connect",paired);
    return () => { active.current=false; nearby.off("connect",paired); };
  },[profile,selected,onJoined]);

  async function prepareHost() {
    if (nearbyMode) {
      useTableTransport({ role:"host",table:crypto.randomUUID() });
      try { await nearby.start(); } catch { setError("Der Tisch konnte nicht geöffnet werden. Prüfe den verfügbaren Gerätespeicher."); setLoading(false); return false; }
    } else { useTableTransport();ensureConnection(); }
    return active.current;
  }

  const [testMode,setTestMode]=useState("party");
  async function createTest(){
    if(!selected)return setError("Wähle zuerst deine Spielfigur.");
    setLoading(true);setError("");if (!await prepareHost()) return;
    socket.timeout(15000).emit("party:test-create",{playerId:profile.id,name:displayName(profile),characterId:selected,bots,gameId:testMode,seed:Number(seed)},(err:Error|null,response:{ok:boolean;data?:RoomState;error?:string})=>{setLoading(false);if(err||!response.ok||!response.data)return setError(response?.error??"Der Spielhost antwortet gerade nicht.");onJoined(response.data);});
  }

  function ensureConnection() {
    if (!socket.connected) socket.connect();
  }

  async function createRoom() {
    if(!selected)return setError("Wähle zuerst deine Spielfigur.");
    setLoading(true);
    setError("");
    if (!await prepareHost()) return;
    socket.timeout(5000).emit(
      "room:create",
      { playerId: profile.id, name: displayName(profile), characterId:selected },
      (timeoutError: Error | null, response: { ok: boolean; data?: RoomState; error?: string }) => {
        setLoading(false);
        if (timeoutError) return setError("Der Spielhost antwortet gerade nicht.");
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
    useTableTransport();ensureConnection();
    socket.timeout(5000).emit(
      "room:join",
      { code, playerId: profile.id, sessionToken: tokenForJoin(code, profile.id), name: displayName(profile), characterId:selected },
      (timeoutError: Error | null, response: { ok: boolean; data?: RoomState; error?: string }) => {
        setLoading(false);
        if (timeoutError) return setError("Der Spielhost antwortet gerade nicht.");
        if (!response.ok || !response.data) return setError(response.error ?? "Beitritt nicht möglich.");
        onJoined(response.data);
      }
    );
  }

  return (
    <main className="page party-menu screen-enter">
      <ScreenHeader title="Online spielen" onBack={onBack} />
      <section className="page__content online-entry">

        <div className="section-heading section-heading--center">
          <h2>Zusammen an einen Tisch</h2>
          <p>Jede Person spielt auf ihrem eigenen Gerät.</p>
        </div>

        <PartyCharacterPicker value={selected} disabled={loading} onChange={onCharacterChange}/>

        <fieldset className="hosting-choice" disabled={loading||pairing}>
          <legend>Wo soll der Raum laufen?</legend>
          <label><input type="radio" name="hosting" checked={!nearbyMode} onChange={()=>setNearbyMode(false)}/><span><strong>Node-Server</strong><small>Alle brauchen Internet. Beitritt mit Raumcode.</small></span></label>
          <label><input type="radio" name="hosting" checked={nearbyMode} onChange={()=>setNearbyMode(true)}/><span><strong>Dieses Handy</strong><small>Gleiches WLAN oder Hotspot. Beitritt per QR. Das Host-Handy spielt mit und bleibt geöffnet. Ohne Internet: App vorher auf allen Geräten laden.</small></span></label>
        </fieldset>
        <button className="button button--primary button--wide" onClick={createRoom} disabled={loading||pairing||!selected}>
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
        {selected && <details className="nearby-join" onToggle={event=>{
          const open=event.currentTarget.open;setJoinOpen(open);
          if(!open && pairing){nearby.disconnect();setPairing(false);invitationCode.current="";}
        }}><summary>Einem Handy-Host per QR beitreten</summary>
          {joinOpen && <GuestPair onReset={()=>setPairing(false)} onOffer={(code,table)=>{setPairing(true);invitationCode.current=code;useTableTransport({table,role:"guest"});}}/>}
        </details>}
        <details className="party-test-entry"><summary><span>Inselparty alleine testen</span> · Roll It Up!</summary><p>Eine vollständige Online-Partie mit Bots. Wähle deine Figur, spiele alle Runden oder starte ein bestimmtes Minispiel.</p>
          <label>Testspiel<select value={testMode} onChange={e=>setTestMode(e.target.value)}><option value="party">Inselparty</option><option value="roll-it-up">Roll It Up!</option></select></label>
          <label>Bot-Mitspieler<select value={bots} disabled={loading||!selected} onChange={e=>setBots(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} {n===1?"Bot":"Bots"}</option>)}</select></label>
          <label>Startwert für wiederholbare Partien<input type="number" min="0" max="4294967295" step="1" value={seed} onChange={e=>setSeed(e.target.value)}/></label>
          <button className="button button--primary button--wide" disabled={loading||!selected||seed===""||!Number.isInteger(Number(seed))||Number(seed)<0||Number(seed)>0xffffffff} onClick={createTest}>{loading?"Testpartie wird vorbereitet …":"Testpartie mit Bots erstellen"}</button>
        </details>
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>
    </main>
  );
}
