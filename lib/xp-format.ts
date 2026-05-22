export function formatXpAmount(amount: number) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
  }).format(safeAmount);
}

export function formatXpLabel(amount: number) {
  return `${formatXpAmount(amount)} XP`;
}
