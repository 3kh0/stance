function coerceEquitySymbol(value: unknown): string | undefined {
  const s = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z.]{1,12}$/.test(s) ? s : undefined;
}

export default defineEventHandler((event) => {
  const symbol = coerceEquitySymbol(getQuery(event).symbol);
  if (!symbol) throw createError({ statusCode: 400, statusMessage: "Invalid symbol" });
  return proxyImpit(POLYMARKET_BASE_URL, "/api/equity/ticker-snapshot", { symbol });
});
