import { Brand } from "./Brand";

export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="screen-header">
      <button className="icon-button" onClick={onBack} aria-label="Zurück">
        <span aria-hidden="true">‹</span>
      </button>
      <h1>{title}</h1>
      <Brand compact />
    </header>
  );
}
