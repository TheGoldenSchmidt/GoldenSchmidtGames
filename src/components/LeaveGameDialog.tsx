import { useEffect, useRef } from "react";
import "../styles/navigation.css";

/** Asked after the back gesture during a game: staying is the default, leaving is the second choice. */
export function LeaveGameDialog({ online, onStay, onLeave }: { online: boolean; onStay: () => void; onLeave: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!, opener = document.activeElement;
    element.showModal();
    return () => { element.close(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} className="iw-dialog leave-dialog" aria-labelledby="leave-dialog-title" aria-describedby="leave-dialog-text" onCancel={event => { event.preventDefault(); onStay(); }}>
    <h2 id="leave-dialog-title">Partie verlassen?</h2>
    <p id="leave-dialog-text">{online ? "Du kannst über das Startmenü wieder beitreten, solange die Partie läuft." : "Der Spielstand auf diesem Handy geht verloren."}</p>
    <button className="button button--primary button--wide" autoFocus onClick={onStay}>Weiterspielen</button>
    <button className="button button--ghost button--wide" onClick={onLeave}>Verlassen</button>
  </dialog>;
}
