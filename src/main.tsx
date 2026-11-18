import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/inselwelt.css";
import "./styles/home.css";
import "./styles/pairing.css";
import "./styles/party.css";
import "./styles/party3d.css";
import "./styles/partyBoardHud.css";
import "./styles/partyCharacters.css";
import "./styles/gameIntro.css";
import "./styles/kribbelnCup.css";
import "./styles/qwixxCup.css";
import "./styles/partyMenus.css";
import "./styles/menus.css";
import "./styles/rollItUp.css";
import "./styles/matches.css";
import "./styles/practiceWorld.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
