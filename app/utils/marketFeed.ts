import type { MarketFeedEvent } from "~/types/gamma";
import type { MarketsResponse } from "~/types/markets";

export function getFeedErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "statusMessage" in err && typeof err.statusMessage === "string") return err.statusMessage;
  return "The market data is unavailable right now.";
}

export function parseMarketsPage(data: MarketsResponse | MarketFeedEvent[]): { events: MarketFeedEvent[]; cursor: string | null } {
  return {
    events: Array.isArray(data) ? data : (data?.data ?? data?.events ?? []),
    cursor: (Array.isArray(data) ? null : data?.next_cursor) ?? null,
  };
}

export const SPORTS_SIBLING_SUFFIXES = ["-more-markets", "-exact-score", "-player-props"] as const;
export const MORE_MARKETS_SUFFIX = SPORTS_SIBLING_SUFFIXES[0];

export const isSportsSiblingEvent = (event: Pick<MarketFeedEvent, "slug">): boolean => typeof event.slug === "string" && SPORTS_SIBLING_SUFFIXES.some((s) => event.slug!.endsWith(s));

export const mergeUniqueMarketEvents = (events: MarketFeedEvent[], seenIds: Set<string>): MarketFeedEvent[] => events.filter((e) => !(!e.id || seenIds.has(e.id) || isSportsSiblingEvent(e)) && (seenIds.add(e.id), true));
