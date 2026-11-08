import { useCallback, useEffect, useState } from "react";
import type { GameId, GuestProfile, RoomState } from "../shared/types";
import { ProfileDialog } from "./components/ProfileDialog";
import { loadProfile, saveProfile } from "./lib/profile";
import { socket } from "./lib/socket";
import { HomeScreen } from "./screens/HomeScreen";
import { LocalSetupScreen } from "./screens/LocalSetupScreen";
import { OnlineEntryScreen } from "./screens/OnlineEntryScreen";
import { QwixxGameScreen } from "./screens/QwixxGameScreen";
import { DurakGameScreen } from "./screens/DurakGameScreen";
import { KribbelnGameScreen } from "./screens/KribbelnGameScreen";
import { PartyGameScreen, PARTY_ONLINE_SAVE, readPartySave, type PartySavedSession } from "./screens/PartyGameScreen";
import { RoomScreen } from "./screens/RoomScreen";
import { GameIntro } from "./components/GameIntro";
import type {CharacterId} from "../shared/characters";

type View = "home" | "local-setup" | "online-entry" | "room" | "game-local" | "game-online";

export default function App() {
  const [profile, setProfile] = useState<GuestProfile>(() => loadProfile());
  const [view, setView] = useState<View>("home");
  const [showProfile, setShowProfile] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [room, setRoom] = useState<RoomState>();
  const [localNames, setLocalNames] = useState<string[]>([]);
  const [localCharacters,setLocalCharacters]=useState<CharacterId[]>([]);
  const [localGameId, setLocalGameId] = useState<GameId>("qwixx");
  const [localDurakCheatMode, setLocalDurakCheatMode] = useState(false);
  const [playIntro, setPlayIntro] = useState(false);
  const [resumeError,setResumeError]=useState("");
  const [canResumeParty,setCanResumeParty]=useState(false);

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
    const closed=({code}:{code:string})=>{if(readPartySave<PartySavedSession>(PARTY_ONLINE_SAVE)?.code===code){localStorage.removeItem(PARTY_ONLINE_SAVE);setCanResumeParty(false);}};
    socket.on("party:closed",closed);return()=>{socket.off("party:closed",closed);};
  },[]);
  useEffect(()=>{
    if(view!=="home")return;let cancelled=false;setCanResumeParty(false);
    const check=()=>{
      const saved=readPartySave<PartySavedSession>(PARTY_ONLINE_SAVE);if(!saved?.partyToken||!online){setCanResumeParty(false);return;}
      socket.connect();socket.timeout(8000).emit("party:session-status",{...saved,playerId:profile.id},(err:Error|null,response:{ok:boolean;data?:{available:boolean}})=>{
        if(cancelled)return;const available=!err&&response?.ok&&response.data?.available===true;setCanResumeParty(available);
        if(!err&&response?.ok&&!available&&readPartySave<PartySavedSession>(PARTY_ONLINE_SAVE)?.code===saved.code)localStorage.removeItem(PARTY_ONLINE_SAVE);
      });
    };
    check();window.addEventListener("focus",check);window.addEventListener("online",check);
    return()=>{cancelled=true;window.removeEventListener("focus",check);window.removeEventListener("online",check);};
  },[view,profile.id,online]);

  const openOnlineGame = useCallback((nextRoom: RoomState, intro = true) => {
    setRoom(nextRoom);
    setPlayIntro(intro);
    setView("game-online");
  }, []);

  function updateProfile(nextProfile: GuestProfile) {
    saveProfile(nextProfile);
    setProfile(nextProfile);
    setShowProfile(false);
  }

  function leaveOnline() {
    socket.disconnect();
    setRoom(undefined);
    setView("home");
  }

  function resumeParty() {
    setResumeError("");
    const saved=readPartySave<PartySavedSession>(PARTY_ONLINE_SAVE);
    if(!saved?.partyToken)return setResumeError("Keine Online-Sitzung gespeichert.");
    socket.connect();socket.timeout(8000).emit("room:join",{code:saved.code,playerId:profile.id,name:profile.username,partyToken:saved.partyToken},(err:Error|null,response:{ok:boolean;data?:RoomState;error?:string})=>{if(err||!response.ok||!response.data){setCanResumeParty(false);if(!err)localStorage.removeItem(PARTY_ONLINE_SAVE);setResumeError(response?.error??"Der Raum ist nicht erreichbar. Nach einem Serverneustart muss eine neue Inselparty begonnen werden.");return;}openOnlineGame(response.data, false);});
  }

  return (
    <div className="app-shell">
      {view === "home" && (
        <HomeScreen
          profile={profile}
          online={online}
          onProfile={() => setShowProfile(true)}
          onLocal={() => setView("local-setup")}
          onOnline={() => setView("online-entry")}
          onResumeOnline={canResumeParty?resumeParty:undefined}
          resumeError={resumeError}
        />
      )}
      {view === "local-setup" && (
        <LocalSetupScreen
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
      {view === "online-entry" && (
        <OnlineEntryScreen
          profile={profile}
          onBack={() => setView("home")}
          onCharacterChange={id=>updateProfile({...profile,characterId:id})}
          onJoined={(nextRoom) => {
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
          onBack={leaveOnline}
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
        <GameIntro gameId={room.config.gameId} players={room.players.filter(player => player.connected)} enabled={playIntro}>
          {room.config.gameId === "qwixx"
            ? <QwixxGameScreen profile={profile} initialRoom={room} onExit={leaveOnline} />
            : room.config.gameId === "durak" ? <DurakGameScreen profile={profile} initialRoom={room} onExit={leaveOnline} />
            : room.config.gameId === "kribbeln" ? <KribbelnGameScreen profile={profile} initialRoom={room} onExit={leaveOnline} />
            : room.config.gameId === "party" && <PartyGameScreen profile={profile} initialRoom={room} onExit={leaveOnline}/>}
        </GameIntro>
      )}
      {showProfile && (
        <ProfileDialog profile={profile} onSave={updateProfile} onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}
