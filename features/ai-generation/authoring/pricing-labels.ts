type CreditPrice = { metered: boolean; estimatedUnits: number };

export function creditPrice(price: CreditPrice) {
  return `${price.metered ? price.estimatedUnits : 0} credits`;
}

export function pricedAction(label: string, price: CreditPrice | null, separator: '·' | '-' = '·') {
  return price ? `${label} ${separator} ${creditPrice(price)}` : label;
}
