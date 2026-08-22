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

export function isAccountingCurrencyCode(value: string | null | undefined) {
  return /^[A-Z]{3}$/.test(String(value ?? ""));
}

export function formatAccountingCurrencyAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
) {
  const safeAmount = Number.isFinite(amount) ? Number(amount) : 0;
  const normalizedCurrency = String(currency ?? "").trim().toUpperCase();

  if (!isAccountingCurrencyCode(normalizedCurrency)) {
    return `${new Intl.NumberFormat("en", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(safeAmount)} (accounting currency not configured)`;
  }

  try {
    return new Intl.NumberFormat("en", {
      currency: normalizedCurrency,
      currencyDisplay: "code",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: "currency",
    }).format(safeAmount);
  } catch {
    return `${normalizedCurrency} ${new Intl.NumberFormat("en", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(safeAmount)}`;
  }
}
