import type { Outcome } from "~/types/account";
import type { Ref } from "vue";
import type { OrderbookLevel } from "~/types/gamma";
import type { BookLevelSelection } from "~/utils/markets";
import type { SportsGame, SportsOdds } from "~/utils/sports";

export interface SportsGameRowBindings {
  live: boolean;
  now: number;
  selectedMarketId: string | null;
  selectedOutcome: Outcome;
  expanded: boolean;
  bookLoading: boolean;
  bookError: boolean;
  hasBookLiquidity: boolean;
  asks: OrderbookLevel[];
  bids: OrderbookLevel[];
  bookSpread: string | null;
  lastBookPrice: string;
  outcomeLabels: [string, string];
  selectedOutcomeLabel: string;
}

type HatchetEl = { applyBookLevel: (s: BookLevelSelection) => void } | null;

export function useSportsTradingShell(options: { refresh: () => void; isLive: (game: SportsGame) => boolean; now: Ref<number> }) {
  const t = useSportsTrade();

  const hatchetRef = ref<HatchetEl>(null);
  const sheetHatchetRef = ref<HatchetEl>(null);
  const tradeSheetOpen = ref(false);
  const isDesktop = ref(true);

  onMounted(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    isDesktop.value = mq.matches;
    mq.addEventListener("change", (e) => (isDesktop.value = e.matches));
  });

  function onSelectOdds(game: SportsGame, odds: SportsOdds) {
    t.selectOdds(game, odds);
    if (!isDesktop.value) tradeSheetOpen.value = true;
  }

  function onLevelClick({ side, level }: { side: BookLevelSelection["side"]; level: OrderbookLevel }) {
    const selection: BookLevelSelection = { side, priceCents: level.price * 100, shares: level.cumulativeShares, totalUsd: level.cumulativeTotal };
    if (!isDesktop.value) {
      tradeSheetOpen.value = true;
      nextTick(() => sheetHatchetRef.value?.applyBookLevel(selection));
      return;
    }
    hatchetRef.value?.applyBookLevel(selection);
  }

  const rowProps = (game: SportsGame): SportsGameRowBindings => ({
    live: options.isLive(game),
    now: options.now.value,
    selectedMarketId: t.selectedMarketId.value,
    selectedOutcome: t.selectedOutcome.value,
    expanded: t.bookOpen.value && t.selectedGameId.value === game.id,
    bookLoading: t.bookLoading.value,
    bookError: t.bookError.value,
    hasBookLiquidity: t.hasBookLiquidity.value,
    asks: t.displayedAsks.value,
    bids: t.displayedBids.value,
    bookSpread: t.bookSpread.value,
    lastBookPrice: t.lastBookPrice.value,
    outcomeLabels: t.outcomeLabels.value,
    selectedOutcomeLabel: t.selectedOutcomeLabel.value,
  });

  return {
    tradeSheetOpen,
    hatchetProps: t.hatchetProps,
    bindHatchetRef: (el: unknown) => (hatchetRef.value = el as HatchetEl),
    bindSheetHatchetRef: (el: unknown) => (sheetHatchetRef.value = el as HatchetEl),
    setSelectedOutcome: t.setSelectedOutcome,
    onSelectOdds,
    onLevelClick,
    rowProps,
    toggleBook: t.toggleBook,
    refreshBook: t.refreshBook,
    onOrderPlaced: options.refresh,
  };
}
