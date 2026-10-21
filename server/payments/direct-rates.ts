let cache: { expires: number; rates: Record<string, number> } | undefined;
let pending: Promise<Record<string, number>> | undefined;
export async function usdExchangeRates(): Promise<Record<string, number>> {
  if (cache && cache.expires > Date.now()) return cache.rates;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch(
        "https://api.coinbase.com/v2/exchange-rates?currency=USD",
        { signal: AbortSignal.timeout(6000) }
      );
      if (!response.ok) throw new Error("Exchange rates unavailable");
      const data = await response.json();
      if (data.data?.currency !== "USD")
        throw new Error("Wrong exchange-rate currency");
      const rates: Record<string, number> = {};
      for (const [symbol, raw] of Object.entries(data.data.rates || {})) {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) rates[symbol] = n;
      }
      cache = { rates, expires: Date.now() + 60000 };
      return rates;
    } finally {
      pending = undefined;
    }
  })();
  return pending;
}
export async function directQuoteRate(currency: string) {
  if (currency === "USD") return 1; // Merchant price: one USD-denominated unit is sold for one token.
  if (!["EUR", "GBP"].includes(currency))
    throw new Error("Unsupported checkout currency");
  const override = process.env[`DIRECT_${currency}_USDT_RATE`];
  if (override) {
    const value = Number(override);
    if (Number.isFinite(value) && value > 0) return value;
    throw new Error("Invalid merchant exchange rate");
  }
  const rates = await usdExchangeRates();
  if (!rates[currency] || !rates.USDT)
    throw new Error("Current USDT quote unavailable");
  return rates.USDT / rates[currency];
}
