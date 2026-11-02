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
import { RoomScreen } from "./screens/RoomScreen";

type View = "home" | "local-setup" | "online-entry" | "room" | "game-local" | "game-online";

export default function App() {
  const [profile, setProfile] = useState<GuestProfile>(() => loadProfile());
  const [view, setView] = useState<View>("home");
  const [showProfile, setShowProfile] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [room, setRoom] = useState<RoomState>();
  const [localNames, setLocalNames] = useState<string[]>([]);
  const [localGameId, setLocalGameId] = useState<GameId>("qwixx");
  const [localDurakCheatMode, setLocalDurakCheatMode] = useState(false);

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

  const openOnlineGame = useCallback((nextRoom: RoomState) => {
    setRoom(nextRoom);
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

  return (
    <div className="app-shell">
      {view === "home" && (
        <HomeScreen
          profile={profile}
          online={online}
          onProfile={() => setShowProfile(true)}
          onLocal={() => setView("local-setup")}
          onOnline={() => setView("online-entry")}
        />
      )}
      {view === "local-setup" && (
        <LocalSetupScreen
          onBack={() => setView("home")}
          onStart={(gameId, names, options) => {
            setLocalGameId(gameId);
            setLocalNames(names);
            setLocalDurakCheatMode(options?.durakCheatMode ?? false);
            setView("game-local");
          }}
        />
      )}
      {view === "online-entry" && (
        <OnlineEntryScreen
          profile={profile}
          onBack={() => setView("home")}
          onJoined={(nextRoom) => {
            setRoom(nextRoom);
            setView("room");
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
        localGameId === "qwixx"
          ? <QwixxGameScreen profile={profile} localNames={localNames} onExit={() => setView("home")} />
          : localGameId === "durak" && <DurakGameScreen profile={profile} localNames={localNames} cheatMode={localDurakCheatMode} onExit={() => setView("home")} />
      )}
      {view === "game-online" && room && (
        room.config.gameId === "qwixx"
          ? <QwixxGameScreen profile={profile} initialRoom={room} onExit={leaveOnline} />
          : room.config.gameId === "durak" && <DurakGameScreen profile={profile} initialRoom={room} onExit={leaveOnline} />
      )}
      {showProfile && (
        <ProfileDialog profile={profile} onSave={updateProfile} onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}
