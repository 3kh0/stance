import type { Outcome } from "~/types/account";
import type { GammaMarket, OrderbookData } from "~/types/gamma";
import type { SportsGame, SportsOdds } from "~/utils/sports";
import { parseMarketOutcomes, sportsMarketSideColors } from "~/utils/sports";
import { parseClobTokenIds } from "~/utils/markets";
import { buildHatchetProps, outcomeDisplayCents, type LiveQuoteSource } from "~/utils/quotes";
import { useOrderbookView } from "~/composables/useOrderbookView";

interface SelectionMeta {
  title: string;
  yesLabel: string;
  noLabel: string;
  icon?: string;
  slug?: string;
  yesColor?: string;
  noColor?: string;
}

export function useSportsTrade() {
  const selectedGameId = ref<string | null>(null);
  const selectedMarket = shallowRef<GammaMarket | null>(null);
  const selectedOutcome = ref<Outcome>("yes");
  const selectedMeta = ref<SelectionMeta | null>(null);
  const bookOpen = ref(false);

  const bookData = ref<OrderbookData | null>(null);
  const bookLoading = ref(false);
  const bookError = ref(false);

  const selectedTokens = computed(() => (selectedMarket.value ? parseClobTokenIds(selectedMarket.value) : []));
  const { revision, getBook, getBestQuote, lastTradePrice, connected } = useClobMarketChannel(selectedTokens);
  const quoteSource = (): LiveQuoteSource => ({ getBestQuote, lastTradePrice: lastTradePrice.value });

  const bookToken = computed(() => {
    const t = selectedTokens.value;
    return t[selectedOutcome.value === "no" ? 1 : 0] || t[0] || null;
  });

  watch([revision, bookToken], () => {
    void getBestQuote(bookToken.value);
    const live = getBook(bookToken.value);
    if (!live) return;
    bookData.value = live;
    bookError.value = false;
    bookLoading.value = false;
  });

  const { displayedAsks, displayedBids, hasBookLiquidity, bookSpread, lastBookPrice, bestAsk, bestBid, hasAsks } = useOrderbookView(bookData);

  const hatchetCents = (side: Outcome) => (selectedMarket.value ? outcomeDisplayCents(selectedMarket.value, side, quoteSource()) : 0);

  const outcomeLabels = computed<[string, string]>(() => [selectedMeta.value?.yesLabel ?? "Yes", selectedMeta.value?.noLabel ?? "No"]);
  const selectedOutcomeLabel = computed(() => outcomeLabels.value[selectedOutcome.value === "no" ? 1 : 0]);

  const hatchetProps = computed(() => {
    const m = selectedMarket.value;
    const meta = selectedMeta.value;
    if (!m || !meta) return null;
    return buildHatchetProps({
      market: m,
      tokens: selectedTokens.value,
      marketTitle: meta.title,
      marketSlug: meta.slug,
      marketIcon: meta.icon,
      yesLabel: meta.yesLabel,
      noLabel: meta.noLabel,
      yesPrice: hatchetCents("yes"),
      noPrice: hatchetCents("no"),
      preselectedOutcome: selectedOutcome.value,
      hasAsks: hasAsks.value,
      bestAsk: bestAsk.value,
      bestBid: bestBid.value,
      yesColor: meta.yesColor,
      noColor: meta.noColor,
    });
  });

  async function fetchBook(market: GammaMarket, outcome: Outcome) {
    const tokens = parseClobTokenIds(market);
    const tokenId = tokens[outcome === "yes" ? 0 : 1] || tokens[0];
    if (!tokenId) {
      bookError.value = true;
      return;
    }
    bookLoading.value = true;
    bookError.value = false;
    bookData.value = null;
    try {
      bookData.value = await $fetch<OrderbookData>(`/api/market/orderbook?tokenId=${encodeURIComponent(tokenId)}`);
    } catch {
      bookError.value = true;
    } finally {
      bookLoading.value = false;
    }
  }

  function buildMeta(game: SportsGame, odds: SportsOdds): SelectionMeta {
    const market = odds.market!;
    const [o0, o1] = parseMarketOutcomes(market);
    const yesNo = o0.toLowerCase() === "yes" && o1.toLowerCase() === "no";
    const yesLabel = yesNo ? market.groupItemTitle || game.teams[0].name : o0;
    const noLabel = yesNo ? "No" : o1;
    const sideColors = sportsMarketSideColors(
      market,
      game.teams.map((team, i) => ({ name: team.name, abbreviation: team.abbrev, logo: team.logo, color: team.color, ordering: i === 0 ? "home" : "away" })),
    );
    const yesColor = sideColors.yes ?? (odds.outcome === "yes" ? odds.color : undefined);
    const noColor = sideColors.no ?? (odds.outcome === "no" ? odds.color : undefined);
    const iconTeam = game.teams.find((t) => t.color && (t.color === (odds.outcome === "yes" ? yesColor : noColor) || t.color === odds.color));
    return {
      title: `${game.teams[0].name} vs ${game.teams[1].name}`,
      yesLabel,
      noLabel,
      icon: iconTeam?.logo ?? game.teams[odds.outcome === "no" ? 1 : 0].logo,
      slug: game.slug,
      yesColor,
      noColor,
    };
  }

  function selectOdds(game: SportsGame, odds: SportsOdds) {
    if (!odds.market) return;
    const sameMarket = selectedMarket.value?.id === odds.market.id;
    selectedGameId.value = game.id;
    selectedMarket.value = odds.market;
    selectedOutcome.value = odds.outcome;
    selectedMeta.value = buildMeta(game, odds);
    if (!sameMarket) fetchBook(odds.market, odds.outcome);
  }

  function toggleBook(game: SportsGame) {
    const defaultOdds = game.teams[0].moneyline ?? game.teams[1].moneyline ?? game.teams[0].spread ?? game.teams[0].total;
    if (selectedGameId.value !== game.id) {
      if (defaultOdds) selectOdds(game, defaultOdds);
      bookOpen.value = true;
      return;
    }
    bookOpen.value = !bookOpen.value;
    if (bookOpen.value && selectedMarket.value && !bookData.value) fetchBook(selectedMarket.value, selectedOutcome.value);
  }

  return {
    connected,
    selectedGameId,
    selectedMarketId: computed(() => selectedMarket.value?.id ?? null),
    selectedOutcome,
    bookOpen,
    hatchetProps,
    bookLoading,
    bookError,
    hasBookLiquidity,
    displayedAsks,
    displayedBids,
    bookSpread,
    lastBookPrice,
    outcomeLabels,
    selectedOutcomeLabel,
    selectOdds,
    toggleBook,
    refreshBook: () => selectedMarket.value && fetchBook(selectedMarket.value, selectedOutcome.value),
    setSelectedOutcome: (o: Outcome) => (selectedOutcome.value = o),
  };
}
