export type SupportedCurrency = "USD" | "EUR" | "GBP";

export const CURRENCY_RULES: Record<SupportedCurrency, { locale: string; fractionDigits: number; roundingIncrement: number }> = {
  USD: { locale: "en-US", fractionDigits: 2, roundingIncrement: 0.01 },
  EUR: { locale: "de-DE", fractionDigits: 2, roundingIncrement: 0.01 },
  GBP: { locale: "en-GB", fractionDigits: 2, roundingIncrement: 0.01 },
};

export function roundCurrencyAmount(amount: number, currency: SupportedCurrency): number {
  const rule = CURRENCY_RULES[currency];
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return Math.round((safeAmount + Number.EPSILON) / rule.roundingIncrement) / (1 / rule.roundingIncrement);
}

export function formatCurrency(amount: number, currency: SupportedCurrency, locale?: string): string {
  const rule = CURRENCY_RULES[currency];
  const rounded = roundCurrencyAmount(amount, currency);
  return new Intl.NumberFormat(locale ?? rule.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: rule.fractionDigits,
    maximumFractionDigits: rule.fractionDigits,
  }).format(rounded);
}
