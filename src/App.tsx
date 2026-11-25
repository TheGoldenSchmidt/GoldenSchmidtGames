import { GAMES, isPartyMode } from "../shared/games";
import { isMinigameMode } from "../shared/minigameModes";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { GameId, GuestProfile, RoomState } from "../shared/types";
import { AccountDialog } from "./components/AccountDialog";
import { loadGuestProfile, loadProfile, saveProfile } from "./lib/profile";
import { accountProfile, accountRequest } from "./lib/account";
import { canDevelop, type Account } from "../shared/accounts";
import { GuestPair, HostInvite } from "./nearby/Pairing";
import { socket, useTableTransport } from "./lib/socket";
import { clearActiveSession, loadActiveSession, loadLastHost, storeActiveSession, type ActiveSession } from "./lib/roomSession";
import { HomeScreen } from "./screens/HomeScreen";
import { IslandWorld } from "./components/IslandWorld";
import { LocalSetupScreen, type LocalSection } from "./screens/LocalSetupScreen";
import { OnlineEntryScreen, RoomEntryForm } from "./screens/OnlineEntryScreen";
import { QwixxGameScreen } from "./screens/QwixxGameScreen";
import { DurakGameScreen } from "./screens/DurakGameScreen";
import { KribbelnGameScreen } from "./screens/KribbelnGameScreen";
import { PartyGameScreen, PARTY_ONLINE_SAVE, readPartySave, type PartySavedSession } from "./screens/PartyGameScreen";
import { RoomScreen } from "./screens/RoomScreen";
import { RichsUniverseScreen } from "./richs-universe/RichsUniverseScreen";
import { playMenuClick, setSoundEnabled } from "./matches/sfx";
import { GameIntro } from "./components/GameIntro";
import type {CharacterId} from "../shared/characters";
import type { UnityGameId } from "./unityGames";
import { useBackStep } from "./lib/backNavigation";
import { useWakeLock } from "./lib/wakeLock";
import { LeaveGameDialog } from "./components/LeaveGameDialog";

const PracticeWorldScreen=lazy(()=>import("./screens/PracticeWorldScreen").then(m=>({default:m.PracticeWorldScreen})));
const UnityGameScreen=lazy(()=>import("./screens/UnityGameScreen").then(m=>({default:m.UnityGameScreen})));

type View = "practice-world" | "unity" | "home" | "local-setup" | "online-entry" | "host" | "join" | "test" | "room" | "game-local" | "game-online" | "richs-universe";

export default function App() {
  const [profile, setProfile] = useState<GuestProfile>(() => loadProfile());
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const [account, setAccount] = useState<Account>();
  const accountRevision = useRef(0);
  const [accountError, setAccountError] = useState("");
  const [session, setSession] = useState(() => loadActiveSession(profile.id));
  const [reconnecting, setReconnecting] = useState(Boolean(session));
  const [needsPairing, setNeedsPairing] = useState(session?.nearby?.role === "guest");
  const joinedSocket = useRef<string | undefined>(undefined);
  const lobbyRequest = useRef(0);
  const [view, setView] = useState<View>("home");
  const viewRef = useRef(view);
  viewRef.current = view;
  const [showProfile, setShowProfile] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [room, setRoom] = useState<RoomState>();
  const [localNames, setLocalNames] = useState<string[]>([]);
  const [localCharacters,setLocalCharacters]=useState<CharacterId[]>([]);
  const [localGameId, setLocalGameId] = useState<GameId>("qwixx");
  const [testGameId, setTestGameId] = useState<GameId>("party");
  const [unityGame, setUnityGame] = useState<UnityGameId>("parcours");
  /** Developer test: the next Roll It Up! test match uses the Unity board. */
  const [unityBoard, setUnityBoard] = useState(false);
  const [localDurakCheatMode, setLocalDurakCheatMode] = useState(false);
  const [playIntro, setPlayIntro] = useState(false);
  const [resumeError,setResumeError]=useState("");
  const [canResumeParty,setCanResumeParty]=useState(false);
  const [lobbyError,setLobbyError]=useState("");
  const [leaveAsk,setLeaveAsk]=useState(false);
  /** Which list „Lokal spielen“ shows; kept when returning from a Unity game. */
  const [localSection,setLocalSection]=useState<LocalSection>("games");

  function acceptAccount(next?: Account) {
    accountRevision.current++;
    const current = profileRef.current;
    if (next && !current.id.startsWith("acct_")) saveProfile(current);
    const nextProfile = next ? accountProfile(next) : loadGuestProfile();
    saveProfile(nextProfile); setProfile(nextProfile); profileRef.current = nextProfile;
    setAccount(next); setAccountError("");
    if (next) setSoundEnabled(next.settings.sound, false);
    if (nextProfile.id !== current.id) { socket.disconnect(); setSession(loadActiveSession(nextProfile.id)); }
    if (!canDevelop(next?.role) && viewRef.current === "practice-world") setView("local-setup");
  }
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (viewRef.current !== "home") return;
      const revision = accountRevision.current;
      void accountRequest<{ account: Account | null }>("/me").then(result => {
        if (active && viewRef.current === "home" && revision === accountRevision.current) acceptAccount(result.account ?? undefined);
      }).catch(() => { /* Public and local games remain usable without the account server. */ });
    };
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => {
    const update = (event: Event) => {
      const { on, sync } = (event as CustomEvent<{ on: boolean; sync: boolean }>).detail;
      if (!account || !sync) return;
      const revision = accountRevision.current;
      void accountRequest<{ account: Account }>("/settings", "PUT", { ...account.settings, sound: on })
        .then(result => { if (revision === accountRevision.current) setAccount(result.account); })
        .catch(error => { if (revision === accountRevision.current) setAccountError(error.message); });
    };
    window.addEventListener("gsg:sound", update);
    return () => window.removeEventListener("gsg:sound", update);
  }, [account]);

  async function openPractice() {
    const revision = accountRevision.current;
    try {
      await accountRequest("/developer");
      if (revision === accountRevision.current && viewRef.current === "local-setup") { setAccountError(""); setView("practice-world"); }
    }
    catch (error) { setAccountError(error instanceof Error ? error.message : "Zugriff nicht möglich."); }
  }

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      socket.disconnect();
    };
  }, []);

  useEffect(()=>{
    const closed=({code,reason}:{code:string;reason?:string})=>{
      if(session?.code===code){clearActiveSession(session,true);setSession(undefined);}
      if(readPartySave<PartySavedSession>(PARTY_ONLINE_SAVE)?.code===code){localStorage.removeItem(PARTY_ONLINE_SAVE);setCanResumeParty(false);}
      // The host ended the party from the lobby: everyone returns to the start menu.
      if(reason==="closed"&&room?.code===code){
        joinedSocket.current=undefined;socket.disconnect();setRoom(undefined);setView("home");
        setResumeError(room.hostId===profile.id?"":"Der Host hat die Party beendet.");
      }
    };
    socket.on("party:closed",closed);return()=>{socket.off("party:closed",closed);};
  },[session,room?.code,room?.hostId,profile.id]);
  useEffect(()=>{
    // Another player returned to the lobby: follow them.
    if(view!=="game-online")return;
    const follow=(next:RoomState)=>{if(next.code===room?.code&&next.phase==="lobby"){setRoom(next);setView("room");}};
    socket.on("room:updated",follow);return()=>{socket.off("room:updated",follow);};
  },[view,room?.code]);
  useEffect(()=>{
    if(view!=="home" || session)return;let cancelled=false;setCanResumeParty(false);
    const check=()=>{
      const saved=readPartySave<PartySavedSession>(PARTY_ONLINE_SAVE);if(!saved?.partyToken||!online){setCanResumeParty(false);return;}
      useTableTransport();socket.connect();socket.timeout(8000).emit("party:session-status",{...saved,playerId:profile.id},(err:Error|null,response:{ok:boolean;data?:{available:boolean}})=>{
        if(cancelled)return;const available=!err&&response?.ok&&response.data?.available===true;setCanResumeParty(available);
        if(!err&&response?.ok&&!available&&readPartySave<PartySavedSession>(PARTY_ONLINE_SAVE)?.code===saved.code)localStorage.removeItem(PARTY_ONLINE_SAVE);
      });
    };
    check();window.addEventListener("focus",check);window.addEventListener("online",check);
    return()=>{cancelled=true;window.removeEventListener("focus",check);window.removeEventListener("online",check);};
  },[view,profile.id,online,session]);

  useEffect(()=>{if(view!=="game-online")setLobbyError("");},[view]);

  const openOnlineGame = useCallback((nextRoom: RoomState, intro = true) => {
    setRoom(nextRoom);
    setPlayIntro(intro);
    setView("game-online");
  }, []);

  function keepSession(next: RoomState) {
    const token = next.sessionToken ?? next.partyToken;
    if (!token) return;
    const saved: ActiveSession = { code: next.code, playerId: profile.id, sessionToken: token, nearby: socket.tableRoute };
    storeActiveSession(saved);
    joinedSocket.current = socket.id;
    setSession(saved);
    setReconnecting(false);
  }

  useEffect(() => {
    if (!session) return;
    useTableTransport(session.nearby);
    let active = true;
    let inFlight: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const lost = () => {
      joinedSocket.current = undefined;
      inFlight = undefined;
      setReconnecting(true);
      setNeedsPairing(true);
      clearTimeout(timer);
      timer = setTimeout(wake, 1500);
    };
    function rejoin() {
      const id = socket.id;
      if (!id || !socket.connected || inFlight === id || joinedSocket.current === id) return;
      inFlight = id;
      setReconnecting(true);
      socket.timeout(8000).emit("room:join", { ...session, resumeOnly: true },
        (err: Error | null, response?: { ok: boolean; retryable?: boolean; data?: RoomState; error?: string }) => {
          if (!active || id !== socket.id) return;
          inFlight = undefined;
          if (err || response?.retryable) {
            clearTimeout(timer);
            timer = setTimeout(rejoin, 1500);
            return;
          }
          if (response?.ok && response.data) {
            joinedSocket.current = id;
            setRoom(response.data);
            setPlayIntro(false);
            setView(response.data.phase === "playing" ? "game-online" : "room");
          } else {
            clearActiveSession(session,true);
            setSession(undefined);
            setRoom(undefined);
            setView("home");
            setResumeError(response?.error ?? "Der Raum ist geschlossen.");
          }
          setReconnecting(false);
        });
    }
    const waiting = (paused:boolean) => {
      if (!active) return;
      if (paused) { lost(); setNeedsPairing(false); }
      else rejoin(); // Refresh the view that was unmounted during the host pause.
    };
    const wake = () => { if (socket.connected) rejoin(); else socket.connect(); };
    socket.on("host:waiting", waiting);
    socket.on("connect", rejoin);
    socket.on("disconnect", lost);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);
    // Socket.IO retries network errors. Middleware refusals need an explicit retry.
    const unavailable = () => { clearTimeout(timer); timer = setTimeout(wake, 2000); };
    socket.on("connect_error", unavailable);
    wake();
    return () => {
      active = false;
      clearTimeout(timer);
      socket.off("connect", rejoin);
      socket.off("disconnect", lost);
      socket.off("connect_error", unavailable);
      socket.off("host:waiting", waiting);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
    };
  }, [session]);

  function updateProfile(nextProfile: GuestProfile) {
    if (account) {
      const revision = accountRevision.current;
      void accountRequest<{ account: Account }>("/settings", "PUT", {
        ...account.settings, displayName: nextProfile.username, characterId: nextProfile.characterId
      }).then(result => { if (revision === accountRevision.current) { acceptAccount(result.account); setShowProfile(false); } })
        .catch(error => { if (revision === accountRevision.current) setAccountError(error.message); });
      return;
    }
    saveProfile(nextProfile);
    setProfile(nextProfile);
    setShowProfile(false);
  }

  function leaveOnline(closed=false) {
    lobbyRequest.current++;
    setLobbyError("");
    clearActiveSession(session,closed);
    setSession(undefined);
    joinedSocket.current = undefined;
    socket.disconnect();
    setReconnecting(false);
    setRoom(undefined);
    setView("home");
  }

  // Returning to the lobby never drops the player out of the room. A lost connection or a
  // paused host phone is retried; otherwise the session is rejoined, which shows the end
  // screen again (or the lobby if another player was faster) and keeps the room.
  function backToLobby(attempt=0,request=++lobbyRequest.current) {
    setLobbyError("");
    socket.timeout(8000).emit("room:lobby",(err:Error|null,response?:{ok:boolean;data?:RoomState;error?:string;retryable?:boolean})=>{
      if(request!==lobbyRequest.current)return; // Left the room or asked again meanwhile.
      if(!err&&response?.ok&&response.data){keepSession(response.data);setRoom(response.data);setView("room");return;}
      if((err||response?.retryable)&&attempt<4){window.setTimeout(()=>{if(request===lobbyRequest.current)backToLobby(attempt+1,request);},1500);return;}
      setLobbyError(response?.error&&!response.retryable?`${response.error} Tippe erneut auf „Zurück zur Lobby“.`:"Die Lobby ist gerade nicht erreichbar. Die Verbindung wird wiederhergestellt.");
      if(session){joinedSocket.current=undefined;setSession({...session});}
    });
  }

  function leaveLobby(done:(error?:string)=>void) {
    socket.timeout(8000).emit("room:leave",(err:Error|null,response?:{ok:boolean;error?:string})=>{
      // Without an answer the seat stays reserved for a rejoin, as when the app is closed.
      if(!err&&response&&!response.ok)return done(response.error);
      leaveOnline();
    });
  }

  function closeParty(done:(error?:string)=>void) {
    socket.timeout(8000).emit("room:close",(err:Error|null,response?:{ok:boolean;error?:string})=>{
      if(err||!response?.ok)return done(response?.error??"Die Party konnte nicht beendet werden. Prüfe die Verbindung und versuche es erneut.");
      leaveOnline(true);
    });
  }

  function resumeHost() {
    const saved=loadLastHost(profile.id);
    if(saved){joinedSocket.current=undefined;storeActiveSession(saved);setSession(saved);setReconnecting(true);}
  }

  function resumeParty() {
    setResumeError("");
    const saved=readPartySave<PartySavedSession>(PARTY_ONLINE_SAVE);
    if(!saved?.partyToken)return setResumeError("Keine Online-Sitzung gespeichert.");
    socket.connect();socket.timeout(8000).emit("room:join",{code:saved.code,playerId:profile.id,name:profile.username,partyToken:saved.partyToken},(err:Error|null,response:{ok:boolean;data?:RoomState;error?:string})=>{if(err||!response.ok||!response.data){setCanResumeParty(false);if(!err)localStorage.removeItem(PARTY_ONLINE_SAVE);setResumeError(response?.error??"Der Raum ist nicht erreichbar. Versuche es erneut.");return;}keepSession(response.data);openOnlineGame(response.data, false);});
  }

  const inGame = view === "game-local" || view === "game-online";
  // Keep the screen on in lobbies and games (other players' turns, hosting phone).
  useWakeLock(inGame || view === "room" || view === "practice-world" || view === "unity");
  useEffect(() => { if (!inGame) setLeaveAsk(false); }, [inGame]);
  // Android back gesture: the same step as the visible back button; in a game first ask.
  useBackStep(() => {
    if (showProfile) return setShowProfile(false);
    switch (view) {
      case "local-setup": case "online-entry": case "richs-universe": return setView("home");
      case "unity": case "practice-world": return setView("local-setup");
      case "host": case "join": case "test": socket.disconnect(); return setView(view === "test" ? "local-setup" : "online-entry");
      case "room": return leaveOnline();
      case "game-local": case "game-online": return setLeaveAsk(true);
    }
  }, view !== "home" || showProfile);
  function leaveGame() {
    setLeaveAsk(false);
    if (view === "game-online") leaveOnline(); else setView("home");
  }

  if (session && reconnecting) return <main className="page iw-menu"><IslandWorld /><section className="page__content party-connection iw-card">
    <h2 className="iw-plank iw-card__title" role="status">Verbindung wird wiederhergestellt …</h2>
    {session.nearby?.role === "guest" && (needsPairing
      ? <GuestPair expectedTable={session.nearby.table} onOffer={()=>{}}/>
      : <p>Die Partie wartet auf das Host-Handy. Dort die App wieder öffnen.</p>)}
    <button className="button button--secondary" onClick={()=>leaveOnline()}>Zum Startmenü</button>
  </section></main>;

  return (
    <div className="app-shell" onClickCapture={event => {
      const control = event.target instanceof Element ? event.target.closest("button, summary") : null;
      if (!control?.closest(".expedition-home, .iw-menu, .iw-dialog") || control.matches(".menu-sound, :disabled")) return;
      void playMenuClick(control.matches('[data-menu-direction="back"], [aria-expanded="true"], details[open] > summary') ? "back" : "forward");
    }}>
      {view === "home" && (
        <HomeScreen
          profile={profile}
          signedIn={Boolean(account)}
          showVersion={canDevelop(account?.role)}
          online={online}
          onProfile={() => setShowProfile(true)}
          onLocal={() => { setLocalSection("games"); setView("local-setup"); }}
          onOnline={() => {useTableTransport(); setView("online-entry");}}
          onUniverse={() => setView("richs-universe")}
          onResumeHost={loadLastHost(profile.id)?resumeHost:undefined}
          resumeGameName={GAMES.find(game=>game.id===readPartySave<PartySavedSession>(PARTY_ONLINE_SAVE)?.gameId)?.name??"Inselparty"}
          onResumeOnline={canResumeParty?resumeParty:undefined}
          resumeError={resumeError}
        />
      )}
      {view === "practice-world" && canDevelop(account?.role) && <Suspense fallback={<p role="status">Proberaum wird geladen …</p>}><PracticeWorldScreen characterId={profile.characterId} onExit={()=>setView("local-setup")}/></Suspense>}
      {view === "unity" && canDevelop(account?.role) && <Suspense fallback={<p role="status">Unity-Test wird geladen …</p>}><UnityGameScreen game={unityGame} characterId={profile.characterId} onExit={()=>setView("local-setup")}/></Suspense>}
      {view === "local-setup" && (
        <LocalSetupScreen
          section={localSection}
          onSection={setLocalSection}
          onPractice={canDevelop(account?.role) ? openPractice : undefined}
          onUnity={canDevelop(account?.role) ? id => { setUnityGame(id); setView("unity"); } : undefined}
          onUnityRollItUp={canDevelop(account?.role) ? () => { setUnityBoard(true); setTestGameId("roll-it-up"); setView("test"); } : undefined}
          onTest={gameId => { setUnityBoard(false); setTestGameId(gameId); setView("test"); }}
          onBack={() => setView("home")}
          onStart={(gameId, names, options) => {
            setLocalGameId(gameId);
            setLocalNames(names);
            setLocalCharacters(options?.characters??[]);
            setLocalDurakCheatMode(options?.durakCheatMode ?? false);
            setPlayIntro(true);
            setView("game-local");
          }}
        />
      )}
      {view === "richs-universe" && (
        <RichsUniverseScreen profile={profile} onBack={() => setView("home")} />
      )}
      {view === "online-entry" && (
        <OnlineEntryScreen onBack={() => setView("home")} onSelect={setView} />
      )}
      {(view === "host" || view === "join" || view === "test") && (
        <RoomEntryForm key={view} mode={view} testGameId={testGameId}
          profile={profile}
          onBack={() => { socket.disconnect(); setView(view === "test" ? "local-setup" : "online-entry"); }}
          onCharacterChange={id=>updateProfile({...profile,characterId:id})}
          onJoined={(nextRoom) => {
            keepSession(nextRoom);
            setResumeError("");
            setRoom(nextRoom);
            setPlayIntro(false);
            setView(nextRoom.phase==="playing"?"game-online":"room");
          }}
        />
      )}
      {view === "room" && room && (
        <RoomScreen
          profile={profile}
          initialRoom={room}
          onBack={()=>leaveOnline()}
          onLeave={leaveLobby}
          onClose={closeParty}
          onGameStart={openOnlineGame}
        />
      )}
      {view === "game-local" && (
        <GameIntro gameId={localGameId} players={localNames.map((name, index) => ({ id: `local-${index}`, name, characterId:localCharacters[index] }))} enabled={playIntro}>
          {localGameId === "qwixx"
            ? <QwixxGameScreen profile={profile} localNames={localNames} localCharacters={localCharacters} onExit={() => setView("home")} />
            : localGameId === "durak" ? <DurakGameScreen profile={profile} localNames={localNames} localCharacters={localCharacters} cheatMode={localDurakCheatMode} onExit={() => setView("home")} />
            : localGameId === "kribbeln" && <KribbelnGameScreen profile={profile} localNames={localNames} localCharacters={localCharacters} onExit={() => setView("home")} />}
        </GameIntro>
      )}
      {view === "game-online" && room && (
        <GameIntro gameId={room.config.gameId} players={room.players.filter(player => player.connected)} enabled={playIntro&&!isMinigameMode(room.config.gameId)}>
          {room.config.gameId === "qwixx"
            ? <QwixxGameScreen profile={profile} initialRoom={room} onExit={()=>leaveOnline()} onLobby={()=>backToLobby()} />
            : room.config.gameId === "durak" ? <DurakGameScreen profile={profile} initialRoom={room} onExit={()=>leaveOnline()} onLobby={()=>backToLobby()} />
            : room.config.gameId === "kribbeln" ? <KribbelnGameScreen profile={profile} initialRoom={room} onExit={()=>leaveOnline()} onLobby={()=>backToLobby()} />
            : isPartyMode(room.config.gameId) && <PartyGameScreen profile={profile} initialRoom={room} onExit={()=>leaveOnline()} onLobby={room.partyTest ? undefined : ()=>backToLobby()} unityBoard={unityBoard && Boolean(room.partyTest) && room.config.gameId === "roll-it-up" && canDevelop(account?.role)}/>}
        </GameIntro>
      )}
      {view==="game-online" && room && !room.partyTest && session?.nearby?.role==="host" && <HostInvite code={room.code}/>}
      {view==="game-online" && lobbyError && <p className="error-message lobby-return-error" role="alert">{lobbyError}</p>}
      {showProfile && (
        <AccountDialog account={account} profile={profile} onAccount={acceptAccount} onGuestSave={updateProfile} onClose={() => setShowProfile(false)} />
      )}
      {accountError && <p className="error-message account-sync-error" role="alert">{accountError}</p>}
      {leaveAsk && inGame && <LeaveGameDialog online={view === "game-online"} onStay={() => setLeaveAsk(false)} onLeave={leaveGame} />}
    </div>
  );
}
