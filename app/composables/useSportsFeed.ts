import type { GammaEvent, MarketFeedEvent } from "~/types/gamma";
import { isEsportsEvent, mergeSportsGameEvents, toSportsGame, type SportsGame } from "~/utils/sports";
import { groupGamesByLeague, isLiveGame, isUpcomingGame, normalizeFeedEvents, type SportsView } from "~/utils/sportsFeed";
import { useFeedRefreshClock } from "~/composables/useFeedRefreshClock";

interface SportsResponse {
  data?: MarketFeedEvent[];
  events?: MarketFeedEvent[];
}
type Payload = SportsResponse | MarketFeedEvent[];

type ParsedEvent = { event: GammaEvent; game: SportsGame | null };
const sportsEvents = (payload: Payload | null | undefined) => normalizeFeedEvents(payload).filter((e) => !isEsportsEvent(e));
const parseEvents = (events: GammaEvent[]): ParsedEvent[] => events.map((event) => ({ event, game: toSportsGame(event) }));
const isFutures = (p: ParsedEvent) => !p.game && !(p.event.markets ?? []).some((m) => Boolean(m.sportsMarketType));

export function useSportsFeed() {
  const view = ref<SportsView>("live");
  const leagueSlug = ref<string | null>(null);

  const feed = (query: () => Record<string, unknown>, extra?: { immediate?: boolean; watch?: false }) => useFetch<Payload>("/api/sports", { query: computed(query), lazy: true, server: false, default: () => [] as MarketFeedEvent[], ...extra });

  const { data, pending, error, refresh: refreshFeed } = feed(() => ({ view: view.value, tag_slug: leagueSlug.value ?? undefined, limit: 240 }));
  const { data: navigationData, refresh: refreshNavigation } = feed(() => ({ view: view.value, limit: 240 }), { immediate: false, watch: false });
  const { data: worldCupData, refresh: refreshWorldCup } = feed(() => ({ view: view.value, tag_slug: "world-cup", limit: 100 }));

  watch([view, leagueSlug], () => {
    if (leagueSlug.value !== null) void refreshNavigation();
  });

  const refresh = () => Promise.all([refreshFeed(), refreshWorldCup(), leagueSlug.value !== null ? refreshNavigation() : Promise.resolve()]);
  const { now } = useFeedRefreshClock(refreshFeed);

  const events = computed(() => sportsEvents(data.value));
  const navigationEvents = computed(() => sportsEvents(leagueSlug.value === null ? data.value : navigationData.value));
  const mergedEvents = computed(() => mergeSportsGameEvents(events.value));
  const navigationMergedEvents = computed(() => mergeSportsGameEvents(navigationEvents.value));

  const parsed = computed(() => parseEvents(mergedEvents.value));
  const navigationParsed = computed(() => parseEvents(navigationMergedEvents.value));

  const isLive = isLiveGame;
  const isUpcoming = (game: SportsGame) => isUpcomingGame(game, now.value);
  const isActiveGame = (g: SportsGame) => isLive(g) || isUpcoming(g);

  const navigationGameEvents = computed<GammaEvent[]>(() => navigationParsed.value.filter((p) => p.game !== null && isActiveGame(p.game)).map((p) => p.event));

  const worldCupEvents = computed(() => mergeSportsGameEvents(sportsEvents(worldCupData.value)));
  const worldCupParsed = computed(() => parseEvents(worldCupEvents.value));
  const worldCupActive = computed(() => worldCupEvents.value.length > 0);
  const worldCupBadgeCount = computed(() => {
    if (view.value === "futures") return worldCupParsed.value.filter(isFutures).length;
    return worldCupParsed.value.reduce((acc, p) => acc + (p.game && isActiveGame(p.game) ? 1 : 0), 0);
  });

  const allGames = computed(() => parsed.value.map((p) => p.game).filter((g): g is SportsGame => g !== null));
  const liveGroups = computed(() => groupGamesByLeague(allGames.value.filter(isLive), false));
  const upcomingGroups = computed(() => groupGamesByLeague(allGames.value.filter(isUpcoming), true));
  const futuresEvents = computed<MarketFeedEvent[]>(() => parsed.value.filter(isFutures).map((p) => p.event as unknown as MarketFeedEvent));
  const liveGameCount = computed(() => liveGroups.value.reduce((acc, g) => acc + g.games.length, 0));
  const upcomingGameCount = computed(() => upcomingGroups.value.reduce((acc, g) => acc + g.games.length, 0));

  return {
    view,
    leagueSlug,
    loading: pending,
    error,
    refresh,
    now,
    isLive,
    navigationEvents,
    navigationGameEvents,
    liveGroups,
    upcomingGroups,
    futuresEvents,
    liveGameCount,
    upcomingGameCount,
    worldCupActive,
    worldCupBadgeCount,
    setView: (next: SportsView) => void (view.value === next || (view.value = next)),
    selectLeague: (slug: string | null) => void (leagueSlug.value === slug || (leagueSlug.value = slug)),
  };
}
