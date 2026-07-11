import type { GammaMarket } from "~/types/gamma";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export interface CryptoUpDownInfo {
  coin: string;
  display: string;
  source: "chainlink" | "binance";
  feedSymbol: string;
  windowStartMs: number | null;
  windowEndMs: number | null;
  slugPrefix: string;
  intervalMs: number | null;
}

const CHAINLINK_COINS = new Set(["btc", "eth", "sol", "xrp", "bnb", "doge", "hype"]);

export const COIN_ALIASES: Record<string, string> = {
  bitcoin: "btc",
  ethereum: "eth",
  solana: "sol",
  dogecoin: "doge",
  hyperliquid: "hype",
};

export function normalizeCoin(token: string): string {
  const l = token.toLowerCase();
  return COIN_ALIASES[l] ?? l;
}

export function cryptoFeedSource(coin: string): { source: CryptoUpDownInfo["source"]; feedSymbol: string } {
  const source: CryptoUpDownInfo["source"] = CHAINLINK_COINS.has(coin) ? "chainlink" : "binance";
  return { source, feedSymbol: source === "chainlink" ? `${coin}/usd` : `${coin}usdt` };
}

type CryptoEventLike = {
  slug?: string;
  seriesSlug?: string;
  markets?: GammaMarket[];
  endDate?: string;
};

const LEGACY_SLUG_RE = /^([a-z]+)-updown-([a-z0-9]+)-(\d+)$/i;
const SERIES_RE = /^(.+?)-up-or-down-(5m|15m|hourly|4h|daily)$/i;

function buildInfo(coinToken: string, suffix: string, windowStartMs: number | null, windowEndMs: number | null, intervalMs: number | null): CryptoUpDownInfo {
  const coin = normalizeCoin(coinToken);
  return { coin, display: coin.toUpperCase(), ...cryptoFeedSource(coin), windowStartMs, windowEndMs, slugPrefix: `${coin}-updown-${suffix}`, intervalMs };
}

export function detectCryptoUpDown(event: CryptoEventLike | null | undefined): CryptoUpDownInfo | null {
  if (!event) return null;

  const s = event.seriesSlug ? SERIES_RE.exec(event.seriesSlug) : null;
  if (s?.[1] && s[2]) {
    const intervalMs = parseIntervalMs(s[2]);
    const windowEndMs = marketEndMs(event);
    return buildInfo(s[1], s[2], windowEndMs !== null && intervalMs !== null ? windowEndMs - intervalMs : null, windowEndMs, intervalMs);
  }

  const l = event.slug ? LEGACY_SLUG_RE.exec(event.slug) : null;
  if (l?.[1] && l[2] && l[3]) {
    const unix = Number.parseInt(l[3], 10);
    return buildInfo(l[1], l[2], Number.isFinite(unix) ? unix * 1000 : null, marketEndMs(event), parseIntervalMs(l[2]));
  }

  return null;
}

export function currentCryptoUpDownSlug(info: CryptoUpDownInfo, nowMs: number): string | null {
  if (!info.intervalMs || !Number.isFinite(nowMs)) return null;
  return `${info.slugPrefix}-${Math.floor(nowMs / info.intervalMs) * (info.intervalMs / 1000)}`;
}

function parseIntervalMs(interval: string): number | null {
  const i = interval.toLowerCase();
  if (i === "hourly") return HOUR_MS;
  if (i === "daily") return DAY_MS;
  const m = /^(\d+)([mhd])$/.exec(i);
  if (!m?.[1] || !m[2]) return null;
  const amount = Number.parseInt(m[1], 10);
  const unitMs = m[2] === "m" ? MINUTE_MS : m[2] === "h" ? HOUR_MS : DAY_MS;
  return Number.isFinite(amount) && amount > 0 ? amount * unitMs : null;
}

function marketEndMs(event: CryptoEventLike): number | null {
  for (const iso of [event.markets?.[0]?.endDate, event.endDate]) {
    if (!iso) continue;
    const ms = Date.parse(iso);
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

export function upDownOutcomeLabels(market: Pick<GammaMarket, "outcomes"> | null | undefined): [string, string] {
  if (!market?.outcomes) return ["Up", "Down"];
  try {
    const arr = JSON.parse(market.outcomes);
    if (Array.isArray(arr) && arr.length >= 2) return [String(arr[0]), String(arr[1])];
  } catch {}
  return ["Up", "Down"];
}
