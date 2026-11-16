import { MenuIcon } from "./MenuIcon";

export function AdventureChoice({ title, detail, icon, violet = false, onClick }: {
  title: string; detail: string; icon: string; violet?: boolean; onClick: () => void;
}) {
  return <button className={`adventure-choice ${violet ? "is-amethyst" : ""}`} onClick={onClick}>
    <span className="adventure-choice__face">
      <span className="adventure-choice__crest"><MenuIcon name={icon}/></span>
      <span className="adventure-choice__copy"><strong>{title}</strong><small>{detail}</small></span>
      <MenuIcon name="next"/>
    </span>
  </button>;
}
