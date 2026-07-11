import type { GammaEvent } from "~/types/gamma";

export interface FinanceUpDownInfo {
  asset: string;
  display: string;
  source: "equity";
  feedSymbol: string;
  windowStartMs: number | null;
  windowEndMs: number | null;
  slugPrefix: string;
  intervalMs: number | null;
}

const EQUITY_SOURCE_RE = /pythdata\.app\/explore\/Equity\.US\.([A-Z.]+)(?:%2F|\/)USD/i;

const parseMs = (raw: string | null | undefined): number | null => {
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
};

const equitySymbol = (event: GammaEvent): string | null => {
  const source = event.resolutionSource || event.markets?.[0]?.resolutionSource || "";
  return EQUITY_SOURCE_RE.exec(decodeURIComponent(source))?.[1]?.toUpperCase() ?? null;
};

export function detectFinanceUpDown(event: GammaEvent | null | undefined): FinanceUpDownInfo | null {
  if (!event) return null;
  const symbol = equitySymbol(event);
  if (!symbol) return null;
  const market = event.markets?.[0];
  const isFinancePriceMarket = market?.feeType === "finance_prices_fees" || event.tags?.some((t) => /^(pyth-finance|equity-daily-pyth)$/i.test(t.slug ?? ""));
  const isUpDown = /(?:daily-)?up-(?:or-)?down/i.test(event.seriesSlug ?? "") || /\bup or down\b/i.test(event.title ?? "");
  if (!isFinancePriceMarket || !isUpDown) return null;
  return { asset: symbol.toLowerCase(), display: symbol, source: "equity", feedSymbol: symbol, windowStartMs: parseMs(market?.eventStartTime), windowEndMs: parseMs(market?.endDate ?? event.endDate), slugPrefix: `${symbol.toLowerCase()}-daily-up-down`, intervalMs: null };
}
