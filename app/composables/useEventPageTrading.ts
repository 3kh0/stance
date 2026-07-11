import type { Outcome, OrderSide, Position } from "~/types/account";
import type { GammaEvent, GammaMarket, OrderbookData, OrderbookLevel } from "~/types/gamma";
import type { MarketWithPrice } from "~/composables/useEventPageChart";
import { parseClobTokenIds, type BookLevelSelection } from "~/utils/markets";
import { buildHatchetProps, liveQuotePrice, outcomeDisplayCents, type LiveQuoteSource } from "~/utils/quotes";
import { sportsMarketSideColors, type SportsMarketGroup } from "~/utils/sports";
import { useOrderbookView } from "~/composables/useOrderbookView";

type LivePrices = Record<string, Partial<Record<Outcome, number>>>;

const isMobile = () => typeof window !== "undefined" && window.innerWidth < 1024;
const bookMidpoint = (a: number | null, b: number | null): number | null => (a === null && b === null ? null : a !== null && b !== null ? (a + b) / 2 : (a ?? b)!);

export function useEventPageTrading(o: {
  slug: ComputedRef<string>;
  event: Ref<GammaEvent | null | undefined>;
  active: ComputedRef<MarketWithPrice[]>;
  isSports: ComputedRef<boolean>;
  sportsTeams: ComputedRef<GammaEvent["teams"]>;
  activeSportsGroups: ComputedRef<SportsMarketGroup<MarketWithPrice>[]>;
  sportsMatchup: ReturnType<typeof useSportsMatchup>;
  account: ComputedRef<{ positions: Position[]; openOrders: Array<{ id: string; marketId: string; outcome: Outcome; side: OrderSide; price: number; shares: number }> }>;
  isLiveAccount: ComputedRef<boolean>;
  activeAccountId: ComputedRef<string | null>;
  selectedId: Ref<string | null>;
  expandedId: Ref<string | null>;
  sportsVariantIds: Ref<Record<string, string>>;
  selectedOutcome: Ref<Outcome>;
  sportsGroupFor: (m: GammaMarket) => SportsMarketGroup<MarketWithPrice> | undefined;
  outcomeLabel: (m: GammaMarket, side: Outcome) => string;
}) {
  const mounted = ref(false);
  const marketTab = ref<"orderbook" | "graph" | "resolution">("orderbook");
  const bookData = ref<OrderbookData | null>(null);
  const bookLoading = ref(true);
  const bookError = ref(false);
  const hatchetRef = ref<{ applyBookLevel: (level: BookLevelSelection) => void } | null>(null);
  const sheetHatchetRef = ref<{ applyBookLevel: (level: BookLevelSelection) => void } | null>(null);
  const tradeSheetOpen = ref(false);
  const { orders: liveOrders, refresh: refreshOrders, start: startLiveOrders, stop: stopLiveOrders } = useLiveOpenOrders();

  const selected = computed<MarketWithPrice | null>(() => (o.selectedId.value ? o.active.value.find((m) => m.id === o.selectedId.value) : null) ?? o.active.value[0] ?? null);
  const outcomeLabels = computed<[string, string]>(() => (selected.value ? [o.outcomeLabel(selected.value, "yes"), o.outcomeLabel(selected.value, "no")] : ["Yes", "No"]));
  const selectedTitle = computed(() => (selected.value ? o.sportsGroupFor(selected.value)?.title || selected.value.groupItemTitle || selected.value.question || o.event.value?.title || "Market" : o.event.value?.title || "Market"));
  const bookOutcome = computed(() => o.selectedOutcome.value || "yes");
  const selectedTokens = computed(() => (selected.value ? parseClobTokenIds(selected.value) : []));
  const orderbookTokens = computed(() => {
    const m = (o.expandedId.value ? o.active.value.find((x) => x.id === o.expandedId.value) : null) ?? selected.value;
    return m ? parseClobTokenIds(m) : [];
  });

  const quoteMarkets = computed(() => {
    const markets = new Map<string, GammaMarket>();
    if (o.isSports.value) {
      for (const g of o.activeSportsGroups.value) for (const m of g.markets) markets.set(m.id, m);
      for (const x of o.sportsMatchup.value?.moneylineOutcomes ?? []) markets.set(x.market.id, x.market);
    } else for (const m of o.active.value) markets.set(m.id, m);
    return [...markets.values()];
  });

  const quoteTokenIds = computed(() => {
    const ids = new Set<string>();
    for (const m of quoteMarkets.value) for (const t of parseClobTokenIds(m)) ids.add(t);
    return [...ids];
  });

  const clobSubscriptionTokens = computed(() => [...new Set([...selectedTokens.value, ...quoteTokenIds.value])]);
  const { revision: bookRevision, getBook, getBestQuote, lastTradePrice } = useClobMarketChannel(clobSubscriptionTokens);
  const quoteSource = (): LiveQuoteSource => ({ getBestQuote, lastTradePrice: lastTradePrice.value });

  const bookToken = computed(() => {
    const t = orderbookTokens.value;
    return t[bookOutcome.value === "no" ? 1 : 0] || t[0] || null;
  });

  const liveYesQuote = computed<{ midpoint: number; timestamp: number } | null>(() => {
    void bookRevision.value;
    const yesToken = selectedTokens.value[0];
    const quote = getBestQuote(yesToken);
    if (quote && (quote.bestAsk !== null || quote.bestBid !== null)) return { midpoint: bookMidpoint(quote.bestAsk, quote.bestBid)!, timestamp: quote.timestamp };
    const book = getBook(yesToken);
    if (!book) return null;
    const prices = (levels: OrderbookData["asks"] | OrderbookData["bids"]) => (levels ?? []).map((l) => Number.parseFloat(l.price)).filter((p) => p > 0 && p < 1);
    const asks = prices(book.asks);
    const bids = prices(book.bids);
    const mid = bookMidpoint(asks.length ? Math.min(...asks) : null, bids.length ? Math.max(...bids) : null);
    return mid === null ? null : { midpoint: mid, timestamp: Date.now() };
  });

  const liveYesChance = computed<number | null>(() => (liveYesQuote.value ? Math.round(liveYesQuote.value.midpoint * 100) : null));
  const liveOddsPoint = computed(() => (liveYesQuote.value ? { time: liveYesQuote.value.timestamp / 1000, value: liveYesQuote.value.midpoint * 100 } : null));
  const liveOddsTokenId = computed(() => selectedTokens.value[0] ?? null);

  watch([bookRevision, bookToken], () => {
    if (!mounted.value || !o.expandedId.value) return;
    const live = getBook(bookToken.value);
    if (!live) return;
    bookData.value = live;
    bookError.value = false;
    bookLoading.value = false;
  });

  const expanded = computed(() => (o.expandedId.value ? (o.active.value.find((m) => m.id === o.expandedId.value) ?? null) : null));
  const chartTokensForPanel = computed(() => {
    const m = expanded.value || selected.value;
    if (!m) return [];
    const tokens = parseClobTokenIds(m);
    const isNo = bookOutcome.value === "no";
    const tokenId = tokens[isNo ? 1 : 0] || tokens[0];
    return tokenId ? [{ tokenId, label: outcomeLabels.value[isNo ? 1 : 0] }] : [];
  });

  const { displayedAsks, displayedBids, hasBookLiquidity, bookSpread, lastBookPrice, bestAsk: hatchetBestAsk, bestBid: hatchetBestBid, hasAsks: hatchetHasAsks } = useOrderbookView(bookData);

  const livePrices = computed<LivePrices>(() => {
    void bookRevision.value;
    const source = quoteSource();
    const prices: LivePrices = {};
    for (const m of quoteMarkets.value) {
      const yes = liveQuotePrice(m, "yes", source);
      const no = liveQuotePrice(m, "no", source);
      const entry: Partial<Record<Outcome, number>> = {};
      if (yes !== null) entry.yes = yes;
      if (no !== null) entry.no = no;
      if (entry.yes !== undefined || entry.no !== undefined) prices[m.id] = entry;
    }
    return prices;
  });

  const hatchetCents = (side: Outcome) => {
    void bookRevision.value;
    return selected.value ? outcomeDisplayCents(selected.value, side, quoteSource()) : 0;
  };

  const hatchetYesPrice = computed(() => hatchetCents("yes"));
  const hatchetNoPrice = computed(() => hatchetCents("no"));
  const selectedSportsColors = computed(() => (selected.value && o.isSports.value ? sportsMarketSideColors(selected.value, o.sportsTeams.value ?? []) : {}));

  const hatchetProps = computed(() => {
    const m = selected.value;
    if (!m) return null;
    return buildHatchetProps({
      market: m,
      tokens: selectedTokens.value,
      marketSlug: o.slug.value,
      marketIcon: m.icon,
      marketTitle: selectedTitle.value,
      yesLabel: outcomeLabels.value[0],
      noLabel: outcomeLabels.value[1],
      yesPrice: hatchetYesPrice.value,
      noPrice: hatchetNoPrice.value,
      preselectedOutcome: o.selectedOutcome.value,
      hasAsks: hatchetHasAsks.value,
      bestAsk: hatchetBestAsk.value,
      bestBid: hatchetBestBid.value,
      yesColor: selectedSportsColors.value.yes,
      noColor: selectedSportsColors.value.no,
    });
  });

  const syncSports = (m: GammaMarket) => {
    const g = o.sportsGroupFor(m);
    if (g) o.sportsVariantIds.value = { ...o.sportsVariantIds.value, [g.key]: m.id };
    o.selectedId.value = m.id;
  };

  const expandMarket = (m: GammaMarket, outcome: Outcome = "yes", sheet = false) => {
    syncSports(m);
    o.expandedId.value = m.id;
    o.selectedOutcome.value = outcome;
    marketTab.value = "orderbook";
    if (sheet && isMobile()) tradeSheetOpen.value = true;
  };

  const togglePanel = (m: GammaMarket) => {
    syncSports(m);
    if (o.expandedId.value === m.id) o.expandedId.value = null;
    else expandMarket(m);
  };

  const applyBookLevel = async (side: BookLevelSelection["side"], level: OrderbookLevel) => {
    if (expanded.value && o.selectedId.value !== expanded.value.id) {
      o.selectedId.value = expanded.value.id;
      await nextTick();
    }
    const selection = { side, priceCents: level.price * 100, shares: level.cumulativeShares, totalUsd: level.cumulativeTotal };
    if (isMobile()) {
      if (!tradeSheetOpen.value) {
        tradeSheetOpen.value = true;
        await nextTick();
      }
      sheetHatchetRef.value?.applyBookLevel(selection);
      return;
    }
    hatchetRef.value?.applyBookLevel(selection);
  };

  const fetchBook = async (m: GammaMarket) => {
    try {
      const tokens = parseClobTokenIds(m);
      const tokenId = tokens[bookOutcome.value === "yes" ? 0 : 1] || tokens[0];
      if (!tokenId) {
        bookError.value = true;
        bookLoading.value = false;
        return;
      }
      bookLoading.value = true;
      bookError.value = false;
      bookData.value = null;
      bookData.value = await $fetch<OrderbookData>(`/api/market/orderbook?tokenId=${encodeURIComponent(tokenId)}`);
      bookLoading.value = false;
    } catch {
      bookError.value = true;
      bookLoading.value = false;
    }
  };

  const userOrders = computed(() => {
    const m = expanded.value;
    if (!m) return [];
    if (o.isLiveAccount.value) {
      const token = bookToken.value;
      if (!token) return [];
      return liveOrders.value
        .filter((x) => x.asset_id === token)
        .map((x) => {
          const total = Number.parseFloat(x.original_size) || 0;
          const filled = Number.parseFloat(x.size_matched) || 0;
          return { id: x.id, side: (x.side?.toLowerCase() === "sell" ? "sell" : "buy") as OrderSide, price: Number.parseFloat(x.price), shares: Math.max(total - filled, 0), filled, total };
        })
        .filter((x) => Number.isFinite(x.price) && x.shares > 0);
    }
    return (o.account.value?.openOrders ?? []).filter((x) => x.marketId === m.id && x.outcome === bookOutcome.value).map((x) => ({ id: x.id, side: x.side, price: x.price, shares: x.shares, filled: 0, total: x.shares }));
  });

  const onOrderPlaced = async () => {
    await refreshOrders();
    if (expanded.value) await fetchBook(expanded.value);
  };

  onMounted(async () => {
    mounted.value = true;
    startLiveOrders();
    if (expanded.value) await fetchBook(expanded.value);
  });

  onBeforeUnmount(stopLiveOrders);

  watch(o.activeAccountId, () => void refreshOrders());
  watch(
    () => [expanded.value?.id, bookOutcome.value].join(":"),
    async () => {
      if (mounted.value && expanded.value) await fetchBook(expanded.value);
    },
  );

  return {
    selected,
    outcomeLabels,
    selectedTitle,
    bookOutcome,
    liveYesChance,
    liveOddsPoint,
    liveOddsTokenId,
    mounted,
    marketTab,
    bookLoading,
    bookError,
    hasBookLiquidity,
    displayedAsks,
    displayedBids,
    bookSpread,
    lastBookPrice,
    hatchetRef,
    sheetHatchetRef,
    tradeSheetOpen,
    livePrices,
    hatchetProps,
    chartTokensForPanel,
    userOrders,
    expandMarket,
    togglePanel,
    applyBookLevel,
    fetchBook,
    onOrderPlaced,
  };
}
