import type { Outcome, Position, Transaction } from "~/types/account";
import type { GammaMarket } from "~/types/gamma";

const pos = (n: number) => Number.isFinite(n) && n > 0;
const parseArr = (s: string | null | undefined): unknown => {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

export const positionKey = (marketId: string, outcome: Outcome): string => `${marketId}-${outcome}`;

export const roundToCents = (value: number): number => Math.round(value * 100) / 100;

export const floorToCents = (value: number): number => Math.floor(value * 100) / 100;

export const chancePct = (market: Pick<GammaMarket, "outcomePrices"> | null | undefined): number => Math.round(parseOutcomePrices(market).yes * 100);

export function parseOutcomePrices(market: Pick<GammaMarket, "outcomePrices"> | null | undefined): { yes: number; no: number } {
  const arr = parseArr(market?.outcomePrices) as unknown[] | null;
  const yes = Number.parseFloat(arr?.[0] as string),
    no = Number.parseFloat(arr?.[1] as string);
  return { yes: Number.isFinite(yes) ? yes : 0, no: Number.isFinite(no) ? no : 0 };
}

export function parseClobTokenIds(market: Pick<GammaMarket, "clobTokenIds"> | null | undefined): string[] {
  const arr = parseArr(market?.clobTokenIds);
  return Array.isArray(arr) ? arr.filter((t): t is string => typeof t === "string") : [];
}

export function getResolution(market: Pick<GammaMarket, "outcomePrices">): Outcome {
  const { yes, no } = parseOutcomePrices(market);
  return yes > no ? "yes" : "no";
}

export const calculateShares = (amount: number, priceCents: number): number => (pos(amount) && pos(priceCents) ? floorToCents((amount / priceCents) * 100) : 0);

export interface BookLevelSelection {
  side: "ask" | "bid";
  priceCents: number;
  shares: number;
  totalUsd: number;
}

export interface TradePreviewSnapshot {
  amount: number;
  priceCents: number;
  shares: number;
}

export function createTradePreviewSnapshot(amount: number, priceCents: number): TradePreviewSnapshot {
  const a = pos(amount) ? amount : 0,
    p = pos(priceCents) ? priceCents : 0;
  return { amount: a, priceCents: p, shares: calculateShares(a, p) };
}

export function createTradePreviewSnapshotFromShares(shares: number, priceCents: number): TradePreviewSnapshot {
  const s = pos(shares) ? shares : 0,
    p = pos(priceCents) ? priceCents : 0;
  return { amount: calculateMaxSellAmount(s, p), priceCents: p, shares: s };
}

export const clobFeeUsd = (rate: number, exponent: number, priceDollars: number, shares: number): number => (pos(rate) && pos(shares) && pos(priceDollars) && priceDollars < 1 ? Math.ceil(shares * rate * (priceDollars * (1 - priceDollars)) ** exponent * 100) / 100 : 0);

export function clampLimitPriceCents(priceCents: number, tickCents: number): number {
  if (!Number.isFinite(priceCents)) return 0;
  const tick = Number.isFinite(tickCents) && tickCents > 0 ? tickCents : 1;
  return Math.round(Math.min(Math.max(Math.round(priceCents / tick) * tick, tick), 100 - tick) * 1000) / 1000;
}

export const limitOrderCost = (priceCents: number, shares: number): number => (pos(priceCents) && pos(shares) ? Math.ceil(priceCents * shares) / 100 : 0);

export function validateTransferAmount(type: "deposit" | "withdraw", amount: number, balance: number, max = 100_000): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Amount must be greater than 0";
  if (amount > max) return `Maximum ${type} amount in one transaction is $${max.toLocaleString()}`;
  if (type === "withdraw" && amount > balance) return "You can't withdraw more than your available balance";
  return null;
}

export const calculateMaxSellAmount = (shares: number, priceCents: number): number => (pos(shares) && pos(priceCents) ? floorToCents(shares * (priceCents / 100)) : 0);

export const positionCost = (position: Pick<Position, "shares" | "entryPrice">): number => floorToCents(position.shares * position.entryPrice);

export const positionCurrentValue = (position: Pick<Position, "shares" | "currentPrice">): number => floorToCents(position.shares * position.currentPrice);

export const positionPnl = (position: Pick<Position, "shares" | "entryPrice" | "currentPrice">): number => roundToCents(positionCurrentValue(position) - positionCost(position));

export function positionPnlPercent(position: Pick<Position, "shares" | "entryPrice" | "currentPrice">): number {
  const cost = positionCost(position);
  return cost > 0 ? (positionPnl(position) / cost) * 100 : 0;
}

export function weightedAverageEntryPrice(existingShares: number, existingPrice: number, addedShares: number, addedPrice: number): number {
  const total = existingShares + addedShares;
  return total > 0 ? (existingShares * existingPrice + addedShares * addedPrice) / total : 0;
}

export function transactionAmount(transaction: Pick<Transaction, "type" | "amount" | "shares" | "price">): number {
  if (transaction.type === "deposit" || transaction.type === "withdraw" || transaction.type === "redeem") return transaction.amount || 0;
  if (transaction.type === "buy" || transaction.type === "sell") return (transaction.shares || 0) * (transaction.price || 0);
  return 0;
}

export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const s = Math.floor((now - timestamp) / 1000),
    m = Math.floor(s / 60),
    h = Math.floor(m / 60),
    d = Math.floor(h / 24);
  if (s < 60) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 4) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export function firstEventSlug(market: { events?: Array<{ slug?: unknown }> } | null | undefined): string | null {
  const slug = market?.events?.[0]?.slug;
  return typeof slug === "string" && slug.length > 0 ? slug : null;
}

const RANGE_LABEL_RE = /^\s*[<>]?\s*\$?\d[\d,]*(?:\.\d+)?\s*(?:[-–]\s*\$?\d[\d,]*(?:\.\d+)?\s*)?$/;

export function isRangeLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  const s = label.trim();
  return (/[<>]/.test(s) || /\d\s*[-–]\s*\$?\d/.test(s)) && RANGE_LABEL_RE.test(s);
}

export function formatRangeLabel(label: string | null | undefined, currency = true): string {
  const s = (label ?? "").trim(),
    sym = currency ? "$" : "";
  const bound = s.match(/^([<>])\s*\$?(\d[\d,]*(?:\.\d+)?)$/);
  if (bound) return `${bound[1]} ${sym}${bound[2]}`;
  const pair = s.match(/^\$?(\d[\d,]*(?:\.\d+)?)\s*[-–]\s*\$?(\d[\d,]*(?:\.\d+)?)$/);
  return pair ? `${sym}${pair[1]}–${sym}${pair[2]}` : s;
}

export function rangeLowerBound(label: string | null | undefined): number {
  const c = (label ?? "").replace(/[$,\s]/g, "");
  const n = Number.parseFloat(c.match(/\d+(?:\.\d+)?/)?.[0] ?? "");
  if (!Number.isFinite(n)) return Number.POSITIVE_INFINITY;
  return c.startsWith("<") ? n - 0.5 : n;
}
