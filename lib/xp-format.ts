export function formatXpAmount(amount: number) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(safeAmount);
}

export function formatXpLabel(amount: number, unitLabel = "XP") {
  const label = unitLabel.trim() || "XP";
  return `${formatXpAmount(amount)} ${label}`;
}
