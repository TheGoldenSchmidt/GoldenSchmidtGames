import { MenuIcon } from "./MenuIcon";
import { MenuSound } from "./MenuSound";

export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="voyage-header">
    <nav aria-label="Menü"><button className="voyage-back" onClick={onBack} aria-label="Zurück"><MenuIcon name="back"/>Zurück</button><MenuSound/></nav>
    <div className="voyage-heading"><span aria-hidden="true"><MenuIcon name="crown"/></span><h1>{title}</h1></div>
  </header>;
}
