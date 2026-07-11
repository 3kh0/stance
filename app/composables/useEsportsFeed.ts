import type { GammaEvent, MarketFeedEvent } from "~/types/gamma";
import { eventLeague, eventTournament, isEsportsEvent, leagueIcon, leagueOrder, toSportsGame, type SportsGame } from "~/utils/sports";
import { groupGamesByLeague, isLiveGame, isUpcomingGame, normalizeFeedEvents, type SportsLeagueGroup, type SportsView } from "~/utils/sportsFeed";
import { useFeedRefreshClock } from "~/composables/useFeedRefreshClock";

export type EsportsView = SportsView;
export type EsportsLeagueGroup = SportsLeagueGroup;

export interface EsportsRailTournament {
  name: string;
  count: number;
  futuresCount: number;
}

export interface EsportsRailGame {
  slug: string;
  label: string;
  icon: string;
  count: number;
  futuresCount: number;
  tournaments: EsportsRailTournament[];
}

interface EsportsResponse {
  data?: MarketFeedEvent[];
  events?: MarketFeedEvent[];
}

export function useEsportsFeed() {
  const view = ref<EsportsView>("live");
  const selectedGame = ref<string | null>(null);
  const selectedTournament = ref<string | null>(null);

  const { data, pending, error, refresh } = useFetch<EsportsResponse | MarketFeedEvent[]>("/api/esports", {
    query: computed(() => ({ view: view.value, limit: 100 })),
    lazy: true,
    server: false,
    default: () => [] as MarketFeedEvent[],
  });

  const { now } = useFeedRefreshClock(refresh);

  const parsed = computed(() =>
    normalizeFeedEvents(data.value)
      .filter(isEsportsEvent)
      .map((event) => ({ event, game: toSportsGame(event) })),
  );

  const isLive = isLiveGame;
  const isUpcoming = (g: SportsGame) => isUpcomingGame(g, now.value);
  const isFutureEvent = (event: GammaEvent, game: SportsGame | null) => !game && !(event.markets ?? []).some((m) => Boolean(m.sportsMarketType));
  const matchesSelection = (slug: string, t: string | null) => (!selectedGame.value || slug === selectedGame.value) && (!selectedTournament.value || t === selectedTournament.value);

  const allGames = computed(() => parsed.value.map((p) => p.game).filter((g): g is SportsGame => g !== null));
  const groupBy = (pred: (g: SportsGame) => boolean, upcoming: boolean) =>
    groupGamesByLeague(
      allGames.value.filter((g) => pred(g) && matchesSelection(g.leagueSlug, g.tournament)),
      upcoming,
    );
  const liveGroups = computed(() => groupBy(isLive, false));
  const upcomingGroups = computed(() => groupBy(isUpcoming, true));

  const futuresEvents = computed<MarketFeedEvent[]>(() => parsed.value.filter((p) => isFutureEvent(p.event, p.game) && matchesSelection(eventLeague(p.event).slug, eventTournament(p.event))).map((p) => p.event as unknown as MarketFeedEvent));

  const railGames = computed<EsportsRailGame[]>(() => {
    interface Acc extends EsportsRailGame {
      tmap: Map<string, EsportsRailTournament>;
    }
    const games = new Map<string, Acc>();
    for (const { event, game } of parsed.value) {
      const isMatch = game !== null && (isLive(game) || isUpcoming(game));
      if (!isMatch && !isFutureEvent(event, game)) continue;
      const league = game ? { slug: game.leagueSlug, label: game.leagueLabel } : eventLeague(event);
      if (league.slug === "other") continue;
      const tn = game ? game.tournament : eventTournament(event);
      const bump = isMatch ? "count" : "futuresCount";
      const entry = games.get(league.slug) ?? { slug: league.slug, label: league.label, icon: leagueIcon(league.slug), count: 0, futuresCount: 0, tournaments: [], tmap: new Map() };
      entry[bump] += 1;
      if (tn) {
        const t = entry.tmap.get(tn) ?? { name: tn, count: 0, futuresCount: 0 };
        t[bump] += 1;
        entry.tmap.set(tn, t);
      }
      games.set(league.slug, entry);
    }
    const byView = (a: EsportsRailTournament, b: EsportsRailTournament) => (view.value === "futures" ? b.futuresCount - a.futuresCount : b.count - a.count) || a.name.localeCompare(b.name);
    return [...games.values()].map(({ tmap, ...game }) => ({ ...game, tournaments: [...tmap.values()].sort(byView) })).sort((a, b) => leagueOrder(a.slug) - leagueOrder(b.slug) || b.count - a.count);
  });

  return {
    view,
    selectedGame,
    selectedTournament,
    loading: pending,
    error,
    refresh,
    now,
    isLive,
    liveGroups,
    upcomingGroups,
    futuresEvents,
    railGames,
    setView: (next: EsportsView) => (view.value = next),
    selectGame: (slug: string | null) => ((selectedGame.value = slug), (selectedTournament.value = null)),
    selectTournament: (slug: string, name: string) => ((selectedGame.value = slug), (selectedTournament.value = name)),
  };
}
