type CreditPrice = { metered: boolean; estimatedUnits: number };

export function creditPrice(price: CreditPrice) {
  return `${price.metered ? price.estimatedUnits : 0} credits`;
}

export function pricedAction(label: string, price: CreditPrice | null) {
  return price ? `${label} · ${creditPrice(price)}` : label;
}
