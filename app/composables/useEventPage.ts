import type { Outcome } from "~/types/account";
import type { GammaEvent, GammaMarket, GammaTag } from "~/types/gamma";
import { detectCryptoUpDown } from "~/utils/crypto";
import { detectFinanceUpDown } from "~/utils/finance";
import { DISPLAYED_MARKETS_LIMIT, HIDDEN_TAG_REGEX } from "~/utils/constants";
import { chancePct, getResolution, parseOutcomePrices } from "~/utils/markets";
import { useSportsMatchup } from "~/composables/useSportsMatchup";
import { useEventPageChart, type MarketWithPrice } from "~/composables/useEventPageChart";
import { useEventPageRedemption } from "~/composables/useEventPageRedemption";
import { useEventPageTrading } from "~/composables/useEventPageTrading";
import { getSportsTabs, groupSportsMarkets, isSportsEvent as eventHasSportsMarkets, parseMarketOutcomes, preferredSportsMarket, sportsOutcomeLabels, type SportsMarketGroup, type SportsMarketTab } from "~/utils/sports";

const withYesPrice = (m: GammaMarket): MarketWithPrice => ({ ...m, yesPrice: parseOutcomePrices(m).yes });
const SPORTS_EVENT_REFRESH_MS = 15_000;
const SPORTS_EVENT_PREFLIGHT_MS = 30 * 60_000;
const SPORTS_EVENT_POST_START_MS = 4 * 60 * 60_000;

function eventTimeMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const ms = Date.parse(raw.replace(" ", "T").replace(/\+00$/, "Z"));
  return Number.isFinite(ms) ? ms : null;
}

export function useEventPage() {
  const route = useRoute();
  const slug = computed(() => route.params.slug as string);
  const { account, activeAccountId, isLiveAccount, redeemPosition, cancelOpenOrder } = useAccount();
  const { cancelLiveOrder } = usePolymarket();
  const { isWatched, toggle: toggleWatchlist, load: loadWatchlist } = useWatchlist();

  const {
    data: event,
    pending,
    error,
    refresh,
  } = useAsyncData(
    () => `event-${slug.value}`,
    () => $fetch<GammaEvent>(`/api/market/${slug.value}`),
  );

  useEventSeo(event, slug);

  const showResolved = ref(false);
  const showAll = ref(false);
  const refreshing = ref(false);
  let eventRefreshInFlight = false;
  let liveSportsEventTimer: ReturnType<typeof setInterval> | null = null;
  const userSelectedId = ref<string | null>(null);
  const userExpandedId = ref<string | "collapsed" | null>(null);
  const userSportsTabKey = ref<string | null>(null);
  const sportsVariantIds = ref<Record<string, string>>({});
  const selectedOutcome = ref<Outcome>("yes");

  const watched = computed(() => (event.value ? isWatched(String(event.value.id)) : false));
  const toggleWatch = () => event.value && toggleWatchlist({ id: String(event.value.id), slug: slug.value, title: event.value.title });

  const active = computed<MarketWithPrice[]>(() =>
    (event.value?.markets ?? [])
      .filter((m) => !m.closed && m.active !== false)
      .map(withYesPrice)
      .sort((a, b) => b.yesPrice - a.yesPrice),
  );

  const isSports = computed(() => eventHasSportsMarkets(event.value));
  const sportsMatchup = useSportsMatchup(event);
  const sportsTeams = computed(() => event.value?.teams ?? []);
  const sportsGroups = computed(() => groupSportsMarkets(active.value));
  const sportsTabs = computed<SportsMarketTab[]>(() => getSportsTabs(active.value));
  const sportsTabKey = computed<string>({
    get: () => {
      const tabs = sportsTabs.value;
      const key = userSportsTabKey.value ?? "game-lines";
      if (!tabs.length) return key;
      return tabs.some((t) => t.key === key) ? key : tabs[0]!.key;
    },
    set: (key) => (userSportsTabKey.value = key),
  });
  const activeSportsGroups = computed(() => groupSportsMarkets(active.value, sportsTabKey.value));

  const resolved = computed<MarketWithPrice[]>(() =>
    (event.value?.markets ?? [])
      .filter((m) => m.closed)
      .sort((a, b) => (a.groupItemTitle || a.question || "").localeCompare(b.groupItemTitle || b.question || ""))
      .map(withYesPrice),
  );

  const tags = computed(() =>
    (event.value?.tags ?? [])
      .map((t: GammaTag) => t.label)
      .filter((label): label is string => Boolean(label) && !HIDDEN_TAG_REGEX.test(label))
      .slice(0, 3),
  );

  const crypto = computed(() => detectCryptoUpDown(event.value));
  const financeUpDown = computed(() => detectFinanceUpDown(event.value));
  const priceMarket = computed(() => crypto.value ?? financeUpDown.value);
  const chartMarkets = computed(() => (active.value.length ? active.value : resolved.value));
  const singleMarket = computed(() => (chartMarkets.value.length === 1 ? chartMarkets.value[0] : null));
  const isSingle = computed(() => singleMarket.value !== null);
  const isClosed = computed(() => !active.value.length && resolved.value.length > 0);

  const outcomeLabel = (m: GammaMarket, side: Outcome) => {
    const labels = isSports.value ? sportsOutcomeLabels(m, sportsTeams.value) : parseMarketOutcomes(m);
    return labels[side === "yes" ? 0 : 1];
  };

  const cryptoResolution = computed<{ label: string; side: Outcome } | null>(() => {
    if (!crypto.value || !isClosed.value || resolved.value.length !== 1) return null;
    const m = resolved.value[0];
    if (!m) return null;
    const p = parseOutcomePrices(m);
    const side = getResolution(m);
    if ((side === "yes" ? p.yes : p.no) < 0.99 || (side === "yes" ? p.no : p.yes) > 0.01) return null;
    return { label: outcomeLabel(m, side), side };
  });

  const { price: liveAssetPrice, priceToBeat: streamedBenchmark, points: liveAssetPoints, connected: liveAssetConnected } = useCryptoPriceFeed(priceMarket);
  const liveAssetBenchmark = computed(() => {
    const meta = Number(event.value?.eventMetadata?.priceToBeat);
    return Number.isFinite(meta) && meta > 0 ? meta : streamedBenchmark.value;
  });
  const { data: equityBenchmark } = useAsyncData<{ priceToBeat?: number } | null>(
    () => `equity-price-to-beat-${event.value?.slug ?? slug.value}`,
    async () => {
      if (!financeUpDown.value || !event.value?.slug) return null;
      try {
        return await $fetch<{ priceToBeat?: number }>(`/api/equity/price-to-beat/${event.value.slug}`);
      } catch {
        return null;
      }
    },
    { watch: [financeUpDown] },
  );
  const priceMarketBenchmark = computed(() => {
    const equity = equityBenchmark.value?.priceToBeat;
    return typeof equity === "number" && Number.isFinite(equity) && equity > 0 ? equity : liveAssetBenchmark.value;
  });
  const cryptoOutcomeTitle = computed(() => parseMarketOutcomes(singleMarket.value)[0]);

  const { chartHovered, chartTokens, allChartTokens, chartPickerOptions, chartTokenIds, toggleChartToken } = useEventPageChart({
    chartMarkets,
    isSports,
    sportsMatchup,
  });

  const sportsGroupMarket = (g: SportsMarketGroup<MarketWithPrice>) => g.markets.find((m) => m.id === sportsVariantIds.value[g.key]) || preferredSportsMarket(g);
  const sportsGroupFor = (m: GammaMarket) => sportsGroups.value.find((g) => g.markets.some((c) => c.id === m.id));

  const defaultTradeMarketId = computed<string | null>(() => {
    if (!active.value.length) return null;
    if (isSports.value && sportsGroups.value.length) {
      const g = activeSportsGroups.value[0];
      return g ? sportsGroupMarket(g).id : null;
    }
    return active.value[0]!.id;
  });

  const selectedId = computed<string | null>({
    get: () => userSelectedId.value ?? defaultTradeMarketId.value,
    set: (id) => (userSelectedId.value = id),
  });

  const expandedId = computed<string | null>({
    get: () => (userExpandedId.value === "collapsed" ? null : (userExpandedId.value ?? defaultTradeMarketId.value)),
    set: (id) => (userExpandedId.value = id ?? "collapsed"),
  });

  const trading = useEventPageTrading({
    slug,
    event,
    active,
    isSports,
    sportsTeams,
    activeSportsGroups,
    sportsMatchup,
    account,
    isLiveAccount,
    activeAccountId,
    selectedId,
    expandedId,
    sportsVariantIds,
    selectedOutcome,
    sportsGroupFor,
    outcomeLabel,
  });

  const { selected, outcomeLabels, selectedTitle, bookOutcome, liveYesChance, liveOddsPoint, expandMarket, togglePanel, tradeSheetOpen, ...tradingRest } = trading;

  const outcomeLabelSelected = computed(() => outcomeLabels.value[bookOutcome.value === "no" ? 1 : 0]);
  const singleChance = computed(() => (chartHovered.value !== null ? Math.round(chartHovered.value) : (liveYesChance.value ?? chancePct(singleMarket.value))));

  const displayed = computed(() => {
    if (isSports.value) return (showAll.value ? activeSportsGroups.value : activeSportsGroups.value.slice(0, DISPLAYED_MARKETS_LIMIT)).map(sportsGroupMarket);
    return showAll.value ? active.value : active.value.slice(0, DISPLAYED_MARKETS_LIMIT);
  });
  const hasMore = computed(() => (isSports.value ? activeSportsGroups.value.length : active.value.length) > DISPLAYED_MARKETS_LIMIT);

  const redemption = useEventPageRedemption({
    slug,
    event,
    resolved,
    isClosed,
    account,
    redeemPosition,
    outcomeLabel,
  });

  const selectSportsVariant = (g: SportsMarketGroup<MarketWithPrice> | undefined, m: MarketWithPrice) => g && expandMarket(m, selectedOutcome.value);
  const selectSportsTab = (key: string) => {
    sportsTabKey.value = key;
    showAll.value = false;
    const g = activeSportsGroups.value[0];
    if (g) expandMarket(sportsGroupMarket(g));
  };

  const cancelUserOrder = async (id: string) => {
    if (!isLiveAccount.value) return cancelOpenOrder(id);
    try {
      await cancelLiveOrder(id);
    } catch {}
    await trading.onOrderPlaced();
  };

  const refreshEventData = async () => {
    if (eventRefreshInFlight) return;
    eventRefreshInFlight = true;
    try {
      await refresh();
    } finally {
      eventRefreshInFlight = false;
    }
  };

  const refreshOdds = async () => {
    if (refreshing.value) return;
    refreshing.value = true;
    try {
      await refreshEventData();
    } finally {
      setTimeout(() => (refreshing.value = false), 500);
    }
  };

  const shouldRefreshSportsEvent = () => {
    if (!isSports.value || !event.value || event.value.ended === true || event.value.closed === true) return false;
    if (event.value.live === true) return true;
    const startMs = eventTimeMs(sportsMatchup.value?.startTime ?? event.value.startTime);
    return startMs !== null && Date.now() >= startMs - SPORTS_EVENT_PREFLIGHT_MS && Date.now() <= startMs + SPORTS_EVENT_POST_START_MS;
  };

  const refreshLiveSportsEvent = () => {
    if (!shouldRefreshSportsEvent() || (typeof document !== "undefined" && document.visibilityState === "hidden")) return;
    void refreshEventData();
  };

  onMounted(() => {
    loadWatchlist();
    liveSportsEventTimer = setInterval(refreshLiveSportsEvent, SPORTS_EVENT_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshLiveSportsEvent);
  });

  onUnmounted(() => {
    if (liveSportsEventTimer) clearInterval(liveSportsEventTimer);
    document.removeEventListener("visibilitychange", refreshLiveSportsEvent);
  });

  watch(slug, () => {
    redemption.resetRedemption();
    userSelectedId.value = null;
    userExpandedId.value = null;
    userSportsTabKey.value = null;
    sportsVariantIds.value = {};
    tradeSheetOpen.value = false;
  });

  return {
    event,
    pending,
    error,
    slug,
    watched,
    toggleWatch,
    refreshing,
    refreshOdds,
    chartHovered,
    chartTokens,
    allChartTokens,
    chartPickerOptions,
    chartTokenIds,
    toggleChartToken,
    crypto,
    financeUpDown,
    priceMarket,
    cryptoResolution,
    liveAssetPrice,
    priceMarketBenchmark,
    liveAssetPoints,
    liveAssetConnected,
    cryptoOutcomeTitle,
    isSports,
    isSingle,
    isClosed,
    singleChance,
    liveOddsPoint,
    tags,
    displayed,
    hasMore,
    showAll,
    expandedId,
    sportsMatchup,
    sportsTeams,
    sportsTabs,
    sportsTabKey,
    sportsGroups,
    selectedOutcome,
    outcomeLabels,
    outcomeLabelSelected,
    selectSportsTab,
    togglePanel,
    expandMarket,
    selectSportsVariant,
    showResolved,
    resolved,
    resolutionLabel: (m: GammaMarket) => outcomeLabel(m, getResolution(m)),
    redeemable: redemption.redeemable,
    redeemableTotal: redemption.redeemableTotal,
    redeemableChecked: redemption.redeemableChecked,
    redemptionMsg: redemption.redemptionMsg,
    redeemOne: redemption.redeemOne,
    redeemAll: redemption.redeemAll,
    outcomeLabel,
    selected,
    selectedTitle,
    tradeSheetOpen,
    cancelUserOrder,
    ...tradingRest,
    handleSheetTrade: () => (tradeSheetOpen.value = false),
  };
}
