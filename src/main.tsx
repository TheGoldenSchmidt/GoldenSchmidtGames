import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/party.css";
import "./styles/party3d.css";
import "./styles/partyCharacters.css";
import "./styles/gameIntro.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
