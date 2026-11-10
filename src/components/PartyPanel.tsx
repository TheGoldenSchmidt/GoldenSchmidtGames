import { useEffect, useId, useRef, type ReactNode } from "react";

/** Native modal: traps focus and keeps touch/keyboard input away from the map. */
export function PartyPanel({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
  const dialog=useRef<HTMLDialogElement>(null),label=useId();
  useEffect(()=>{
    const element=dialog.current!,opener=document.activeElement;
    element.showModal();
    return()=>{element.close();if(opener instanceof HTMLElement&&opener.isConnected)opener.focus({preventScroll:true});};
  },[]);
  return <dialog ref={dialog} className="party-panel" aria-labelledby={label} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{
    if(event.target!==event.currentTarget)return;
    const bounds=event.currentTarget.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)onClose();
  }}>
    <header><h2 id={label}>{title}</h2><button autoFocus onClick={onClose} aria-label={`${title} schließen`}>×</button></header>
    <div className="party-panel-content">{children}</div>
  </dialog>;
}
