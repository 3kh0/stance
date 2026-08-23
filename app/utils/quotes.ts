import type { Outcome } from "~/types/account";
import type { GammaMarket } from "~/types/gamma";
import type { ClobFeeInfo } from "~/types/markets";
import type { LiveMarketQuote } from "~/composables/useClobMarketChannel";
import { parseClobTokenIds, parseOutcomePrices } from "~/utils/markets";

export interface LiveQuoteSource {
  getBestQuote: (tokenId: string | null | undefined) => LiveMarketQuote | null;
  lastTradePrice: Record<string, number>;
}

export function marketTickCents(market: Pick<GammaMarket, "orderPriceMinTickSize">): number {
  const tick = Number(market.orderPriceMinTickSize);
  return Number.isFinite(tick) && tick > 0 ? tick * 100 : 1;
}

export function snapCents(cents: number, market: Pick<GammaMarket, "orderPriceMinTickSize">): number {
  const tick = marketTickCents(market);
  return Math.round(Math.round(cents / tick) * tick * 1000) / 1000;
}

export function snapDisplayPrice(price: number, market: Pick<GammaMarket, "orderPriceMinTickSize">): number {
  const tick = marketTickCents(market) / 100;
  const snapped = Math.round(price / tick) * tick;
  return Math.round(Math.min(Math.max(snapped, tick), 1 - tick) * 10_000) / 10_000;
}

const NO_FEES: ClobFeeInfo = { rate: 0, exponent: 0, takerOnly: true, rebateRate: 0 };

export function marketFeeInfo(market: Pick<GammaMarket, "feeSchedule" | "feesEnabled"> | null | undefined): ClobFeeInfo | null {
  if (!market) return null;
  if (market.feesEnabled === false) return NO_FEES;
  const schedule = market.feeSchedule;
  if (!schedule) return null;
  const rate = Number(schedule.rate);
  const exponent = Number(schedule.exponent);
  if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(exponent) || exponent < 0) return null;
  const rebateRate = Number(schedule.rebateRate);
  return { rate, exponent, takerOnly: schedule.takerOnly !== false, rebateRate: Number.isFinite(rebateRate) && rebateRate > 0 ? rebateRate : 0 };
}

function liveSidePrice(market: GammaMarket, side: Outcome, source: LiveQuoteSource): number | null {
  const token = parseClobTokenIds(market)[side === "yes" ? 0 : 1];
  const price = source.getBestQuote(token)?.bestAsk ?? (token ? source.lastTradePrice[token] : undefined);
  return price !== undefined && Number.isFinite(price) && price > 0 && price <= 1 ? price : null;
}

export function liveQuoteCents(market: GammaMarket, side: Outcome, source: LiveQuoteSource): number | null {
  const price = liveSidePrice(market, side, source);
  return price === null ? null : snapCents(price * 100, market);
}

export const liveQuotePrice = (market: GammaMarket, side: Outcome, source: LiveQuoteSource): number | null => {
  const cents = liveQuoteCents(market, side, source);
  return cents === null ? null : cents / 100;
};

export const outcomeDisplayCents = (market: GammaMarket, side: Outcome, source?: LiveQuoteSource): number => (source && liveQuoteCents(market, side, source)) ?? snapCents(parseOutcomePrices(market)[side] * 100, market);

export interface HatchetProps {
  marketId: string;
  marketSlug?: string;
  marketIcon?: string;
  marketTitle: string;
  marketQuestion?: string;
  yesLabel: string;
  noLabel: string;
  yesPrice: number;
  noPrice: number;
  preselectedOutcome: Outcome;
  hasAsks: boolean;
  bestAskCents: number | null;
  bestBidCents: number | null;
  conditionId?: string;
  yesTokenId?: string;
  noTokenId?: string;
  negRisk?: boolean;
  tickSize?: number;
  feeInfo?: ClobFeeInfo | null;
  yesColor?: string;
  noColor?: string;
}

export function buildHatchetProps(input: {
  market: GammaMarket;
  tokens: string[];
  marketTitle: string;
  yesLabel: string;
  noLabel: string;
  yesPrice: number;
  noPrice: number;
  preselectedOutcome: Outcome;
  hasAsks: boolean;
  bestAsk: number | null;
  bestBid: number | null;
  marketSlug?: string;
  marketIcon?: string;
  yesColor?: string;
  noColor?: string;
}): HatchetProps {
  const m = input.market;
  return {
    marketId: m.id,
    marketSlug: input.marketSlug,
    marketIcon: input.marketIcon,
    marketTitle: input.marketTitle,
    marketQuestion: m.question,
    yesLabel: input.yesLabel,
    noLabel: input.noLabel,
    yesPrice: input.yesPrice,
    noPrice: input.noPrice,
    preselectedOutcome: input.preselectedOutcome,
    hasAsks: input.hasAsks,
    bestAskCents: input.bestAsk === null ? null : snapCents(input.bestAsk * 100, m),
    bestBidCents: input.bestBid === null ? null : snapCents(input.bestBid * 100, m),
    conditionId: m.conditionId,
    yesTokenId: input.tokens[0],
    noTokenId: input.tokens[1],
    negRisk: m.negRisk,
    tickSize: m.orderPriceMinTickSize,
    feeInfo: marketFeeInfo(m),
    yesColor: input.yesColor,
    noColor: input.noColor,
  };
}
