import { useState } from "react";
import { MenuIcon } from "./MenuIcon";
import { playMenuClick, setSoundEnabled, soundEnabled } from "../matches/sfx";

export function MenuSound() {
  const [enabled, setEnabled] = useState(soundEnabled);
  return <button className="menu-sound" type="button" aria-label="Spieltöne" aria-pressed={enabled} title={enabled ? "Spieltöne ausschalten" : "Spieltöne einschalten"} onClick={() => {
    setSoundEnabled(!enabled);
    setEnabled(!enabled);
    if (!enabled) playMenuClick();
  }}><MenuIcon name={enabled ? "sound" : "muted"}/></button>;
}
