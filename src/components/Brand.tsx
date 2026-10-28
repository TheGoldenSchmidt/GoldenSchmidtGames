export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`} aria-label="Spielraum">
      <div className="brand__tokens" aria-hidden="true">
        <span className="token token--coral" />
        <span className="token token--mint" />
        <span className="token token--cream" />
      </div>
      <span className="brand__name">Spielraum</span>
    </div>
  );
}
