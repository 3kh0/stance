import type { GammaEvent, MarketFeedEvent } from "~/types/gamma";
import { isFinalPeriod, leagueIcon, type SportsGame } from "~/utils/sports";

export type SportsView = "live" | "futures";

export interface SportsLeagueGroup {
  slug: string;
  label: string;
  icon: string;
  games: SportsGame[];
}

interface FeedResponse {
  data?: MarketFeedEvent[];
  events?: MarketFeedEvent[];
}

export const normalizeFeedEvents = (payload: FeedResponse | MarketFeedEvent[] | null | undefined): GammaEvent[] => ((Array.isArray(payload) ? payload : (payload?.data ?? payload?.events ?? [])) ?? []) as unknown as GammaEvent[];

export const isLiveGame = (game: SportsGame) => game.live;

export const PENDING_START_GRACE_MS = 90 * 60_000;

export const isUpcomingGame = (game: SportsGame, now: number): boolean => !game.live && !isFinalPeriod(game.period) && game.startMs !== null && game.startMs > now - PENDING_START_GRACE_MS;

export function groupGamesByLeague(games: SportsGame[], byStartTime: boolean): SportsLeagueGroup[] {
  const groups = new Map<string, SportsLeagueGroup>();
  for (const g of games) {
    const existing = groups.get(g.leagueSlug);
    if (existing) existing.games.push(g);
    else groups.set(g.leagueSlug, { slug: g.leagueSlug, label: g.leagueLabel, icon: leagueIcon(g.leagueSlug), games: [g] });
  }
  for (const grp of groups.values()) grp.games.sort((a, b) => (byStartTime ? (a.startMs ?? Infinity) - (b.startMs ?? Infinity) || b.volume - a.volume : b.volume - a.volume));
  return [...groups.values()].sort((a, b) => {
    const keyOf = (g: SportsLeagueGroup) => (byStartTime ? Math.min(...g.games.map((x) => x.startMs ?? Infinity)) : Math.max(...g.games.map((x) => x.volume)));
    return (byStartTime ? keyOf(a) - keyOf(b) : keyOf(b) - keyOf(a)) || b.games.length - a.games.length;
  });
}
