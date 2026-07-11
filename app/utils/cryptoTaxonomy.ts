import type { GammaMarket, MarketFeedEvent } from "~/types/gamma";
import { detectCryptoUpDown, normalizeCoin } from "~/utils/crypto";
import { parseOutcomePrices } from "~/utils/markets";

export interface CryptoCoin {
  key: string;
  display: string;
  name: string;
}

export const CRYPTO_COINS: CryptoCoin[] = [
  { key: "btc", display: "BTC", name: "Bitcoin" },
  { key: "eth", display: "ETH", name: "Ethereum" },
  { key: "sol", display: "SOL", name: "Solana" },
  { key: "xrp", display: "XRP", name: "XRP" },
  { key: "bnb", display: "BNB", name: "BNB" },
  { key: "doge", display: "DOGE", name: "Dogecoin" },
  { key: "hype", display: "HYPE", name: "Hyperliquid" },
];

export type CryptoBucket = "up-down" | "forecast" | "theme";

const FORECAST_SERIES_RE = /-(hit-price|multi-strikes|neg-risk)-/i;

export function coinFromEvent(event: MarketFeedEvent): string | null {
  const token = event.seriesSlug?.split("-")[0];
  if (token) {
    const coin = normalizeCoin(token);
    if (CRYPTO_COINS.some((c) => c.key === coin)) return coin;
  }
  const title = (event.title ?? "").toLowerCase();
  for (const c of CRYPTO_COINS) if (title.includes(c.name.toLowerCase()) || new RegExp(`\\b${c.key}\\b`).test(title)) return c.key;
  return null;
}

export function classifyCryptoEvent(event: MarketFeedEvent): CryptoBucket {
  if (detectCryptoUpDown(event) || /up-or-down/i.test(event.seriesSlug ?? "") || /\bup or down\b/i.test(event.title ?? "")) return "up-down";
  return FORECAST_SERIES_RE.test(event.seriesSlug ?? "") ? "forecast" : "theme";
}

export interface ForecastHorizon {
  label: string;
  order: number;
}

export function forecastHorizon(event: MarketFeedEvent): ForecastHorizon {
  const s = (event.seriesSlug ?? "").toLowerCase();
  if (/daily/.test(s)) return { label: "Today", order: 0 };
  if (/weekly|neg-risk/.test(s)) return { label: "This week", order: 1 };
  if (/monthly/.test(s)) return { label: "This month", order: 2 };
  return { label: "Forecast", order: 3 };
}

type StrikeKind = "directional" | "open" | "range" | "threshold";

interface ParsedStrike {
  sortValue: number;
  label: string;
  kind: StrikeKind;
}

function formatStrike(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return `$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `$${value < 10 ? value.toFixed(2) : value.toLocaleString("en-US")}`;
}

const toNumber = (raw: string): number => Number.parseFloat(raw.replace(/,/g, ""));

export function parseStrike(groupItemTitle: string | undefined): ParsedStrike | null {
  const raw = (groupItemTitle ?? "").trim();
  if (!raw) return null;

  const dir = /^([↑↓])\s*\$?([\d,.]+)$/.exec(raw);
  if (dir?.[1] && dir[2]) {
    const v = toNumber(dir[2]);
    if (Number.isFinite(v)) return { sortValue: v, label: `${dir[1]} ${formatStrike(v)}`, kind: "directional" };
  }

  const open = /^([<>])\s*\$?([\d,.]+)$/.exec(raw);
  if (open?.[1] && open[2]) {
    const v = toNumber(open[2]);
    if (Number.isFinite(v)) return { sortValue: open[1] === "<" ? v - 1 : v + 1, label: `${open[1]} ${formatStrike(v)}`, kind: "open" };
  }

  const range = /^\$?([\d,.]+)\s*[-–]\s*\$?([\d,.]+)$/.exec(raw);
  if (range?.[1] && range[2]) {
    const lo = toNumber(range[1]),
      hi = toNumber(range[2]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) return { sortValue: (lo + hi) / 2, label: `${formatStrike(lo)}–${formatStrike(hi)}`, kind: "range" };
  }

  const plain = /^\$?([\d,.]+)$/.exec(raw);
  if (plain?.[1]) {
    const v = toNumber(plain[1]);
    if (Number.isFinite(v)) return { sortValue: v, label: `≥ ${formatStrike(v)}`, kind: "threshold" };
  }
  return null;
}

export interface StrikeRow {
  market: GammaMarket;
  label: string;
  sortValue: number;
  yesPct: number;
  kind: StrikeKind;
}

export interface StrikeLadder {
  event: MarketFeedEvent;
  coin: string | null;
  title: string;
  horizon: ForecastHorizon;
  rows: StrikeRow[];
  distribution: boolean;
}

export function buildStrikeLadder(event: MarketFeedEvent): StrikeLadder | null {
  const rows: StrikeRow[] = [];
  for (const market of event.markets ?? []) {
    if (market.active === false || market.closed === true) continue;
    const parsed = parseStrike(market.groupItemTitle);
    if (!parsed) continue;
    rows.push({ market, label: parsed.label, sortValue: parsed.sortValue, yesPct: Math.round(parseOutcomePrices(market).yes * 100), kind: parsed.kind });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => a.sortValue - b.sortValue);
  return { event, coin: coinFromEvent(event), title: event.title ?? "Untitled market", horizon: forecastHorizon(event), rows, distribution: rows.some((r) => r.kind === "range") };
}
