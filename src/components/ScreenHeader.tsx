/** Menu header in the Inselwelt style: stone back button, the title on a wooden plank, the GSG crown mark. */
export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="screen-header iw-header">
      <button className="iw-slab iw-slab--stone iw-header__back" onClick={onBack} aria-label="Zurück">
        <span className="iw-slab__face">
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3.5 5.5 8 10 12.5" /></svg>
        </span>
      </button>
      <h1 className="iw-plank iw-header__title">{title}</h1>
      <span className="menu-brand" role="img" aria-label="GoldenSchmidtGames">
        <svg viewBox="0 0 32 22" aria-hidden="true" focusable="false"><path d="M3 20h26l2-15-8 6-7-9-7 9-8-6z" /></svg>
        GSG
      </span>
    </header>
  );
}
