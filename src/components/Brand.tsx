export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`} role="img" aria-label="GoldenSchmidtGames" title="GoldenSchmidtGames">
      <img className="brand__icon" src="/gsg-icon-192.png" alt="" width="44" height="44" />
      <span className="brand__name brand__name--full">GoldenSchmidtGames</span>
      <span className="brand__name brand__name--short" aria-hidden="true">GSG</span>
    </div>
  );
}
