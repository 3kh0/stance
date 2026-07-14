<template>
  <div>
    <EventPageSkeleton v-if="pending && !event" :sports="skeletonSports" />
    <EventPageError v-else-if="error && !event" :message="error.message" :status-code="errorStatusCode" :is-refreshing="refreshing" @retry="refreshOdds" />

    <div v-else-if="event" class="pm-event-container p-4 sm:p-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2">
          <EventSportsHeader
            v-if="isSports && sportsMatchup"
            :event="event"
            :event-tags="tags"
            :matchup="sportsMatchup"
            :watched="watched"
            :is-refreshing="refreshing"
            :embed-active="liveStatsActive"
            @toggle-watch="toggleWatch"
            @refresh="refreshOdds"
            @select-outcome="
              (id, o) => {
                const m = event?.markets.find((c) => c.id === id);
                if (m) expandMarket(m, o, true);
              }
            "
          />
          <EventHeader v-else :event="event" :event-tags="tags" :is-single-market="isSingle" :is-fully-resolved="isClosed" :single-market-chance="singleChance" :watched="watched" :is-refreshing="refreshing" @toggle-watch="toggleWatch" @refresh="refreshOdds" />

          <EsportsLivestream :url="event.resolutionSource" />

          <EventSportsLiveStats v-if="isSports && sportsLiveStatsMatchId !== null && liveStatsStatus !== 'failed'" class="pm-spring-in mb-6" style="--pm-spring-delay: 60ms" :match-id="sportsLiveStatsMatchId" @status="liveStatsStatus = $event" />

          <div v-if="priceMarket" class="pm-spring-in mb-6" style="--pm-spring-delay: 60ms">
            <CryptoLivePrice :info="priceMarket" :resolution="crypto ? cryptoResolution : null" :market-title="event.title" :price="liveAssetPrice" :price-to-beat="priceMarketBenchmark" :connected="liveAssetConnected" />
          </div>

          <div v-if="chartTokens.length > 0" class="pm-spring-in mb-6" style="--pm-spring-delay: 80ms">
            <CryptoMarketChart
              v-if="priceMarket"
              :info="priceMarket"
              :active="!isClosed"
              :tokens="chartTokens"
              :outcome-title="cryptoOutcomeTitle"
              :live-odds-point="liveOddsPoint"
              :price-points="liveAssetPoints"
              :price-to-beat="priceMarketBenchmark"
              :current-price="liveAssetPrice"
              :price-mode-label="financeUpDown ? 'Asset price' : 'Crypto price'"
              :waiting-label="financeUpDown ? 'Waiting for equity price data...' : undefined"
              :price-chart-aria-label="financeUpDown ? 'Live equity price with price-to-beat line' : undefined"
              @hover-value="chartHovered = $event"
            />
            <template v-else>
              <Transition name="market-tab" mode="out-in">
                <PriceChart
                  v-if="chartMode === 'simple'"
                  key="line"
                  :tokens="chartTokens"
                  :outcome-title="isSingle ? 'Yes' : undefined"
                  :default-range="isSports && (sportsMatchup?.live || sportsMatchup?.ended) ? '3h' : undefined"
                  :end-labels="isSports"
                  :auto-refresh="isSports && !isClosed && sportsMatchup?.ended !== true"
                  @hover-value="chartHovered = $event"
                >
                  <template #controls>
                    <div class="flex items-center gap-3">
                      <ChartSeriesPicker v-if="allChartTokens.length > 1" :options="chartPickerOptions" :selected-ids="chartTokenIds" @toggle="toggleChartToken" />
                      <ChartModeToggle v-model="chartMode" />
                    </div>
                  </template>
                </PriceChart>
                <div v-else key="candle">
                  <div class="mb-4.5 flex min-h-8 items-center justify-end gap-3">
                    <CandleOutcomePicker v-if="allChartTokens.length > 1" :options="chartPickerOptions" :selected-id="candleTokenId" @select="candleTokenId = $event" />
                    <ChartModeToggle v-model="chartMode" />
                  </div>
                  <AdvancedPriceChart :tokens="candleTokens" :outcome-title="isSingle ? 'Yes' : undefined" :live-point="candleLivePoint" :default-interval="isSports && (sportsMatchup?.live || sportsMatchup?.ended) ? '15m' : undefined" />
                </div>
              </Transition>
            </template>
          </div>

          <EventMarketsList
            :displayed-markets="displayed"
            :is-sports-event="isSports"
            :is-single-market="isSingle"
            :expanded-market-id="expandedId"
            :sports-tabs="sportsTabs"
            :active-sports-tab-key="sportsTabKey"
            :sports-groups="sportsGroups"
            :teams="sportsTeams"
            :live-prices="livePrices"
            :has-more-markets="hasMore"
            :show-all-markets="showAll"
            :active-market-tab="marketTab"
            :selected-outcome="selectedOutcome"
            :outcome-labels="outcomeLabels"
            :selected-outcome-label="outcomeLabelSelected"
            :orderbook-loading="bookLoading"
            :orderbook-error="bookError"
            :has-orderbook-liquidity="hasBookLiquidity"
            :displayed-asks="displayedAsks"
            :displayed-bids="displayedBids"
            :orderbook-spread="bookSpread"
            :last-orderbook-price="lastBookPrice"
            :user-orders="userOrders"
            :chart-tokens="chartTokensForPanel"
            :resolution-source="event.resolutionSource"
            @select-sports-tab="selectSportsTab"
            @toggle-market-panel="togglePanel"
            @select-market-and-outcome="(m, o) => expandMarket(m, o, true)"
            @select-sports-variant="selectSportsVariant"
            @update:active-market-tab="marketTab = $event"
            @update:selected-outcome="selectedOutcome = $event"
            @level-click="applyBookLevel($event.side, $event.level)"
            @cancel-order="cancelUserOrder"
            @refresh-orderbook="fetchBook"
            @show-all="showAll = true"
            @hide-all="showAll = false"
          />

          <EventResolvedMarkets v-if="!isSingle" :resolved-markets="resolved" :show-resolved="showResolved" :resolution-label="resolutionLabel" @update:show-resolved="showResolved = $event" />

          <div class="mt-6">
            <h2 class="mb-2 text-[10px] font-bold uppercase tracking-widest text-text-3">Rules</h2>
            <div class="whitespace-pre-line text-[12.5px] leading-relaxed text-text-2">{{ event.description }}</div>
          </div>
        </div>

        <div class="pm-spring-in-right lg:col-span-1" style="--pm-spring-delay: 120ms">
          <Hatchet v-if="hatchetProps" ref="hatchetRef" class="max-lg:hidden" v-bind="hatchetProps" @trade="() => {}" @order-placed="onOrderPlaced" @outcome-change="selectedOutcome = $event" />

          <EventResolvedSidebar
            v-else-if="isClosed"
            :event="event"
            :resolved-markets="resolved"
            :redeemable-positions="redeemable"
            :total-redeemable-payout="redeemableTotal"
            :resolved-redeemable-checked="redeemableChecked"
            :redemption-message="redemptionMsg"
            :resolution-label="resolutionLabel"
            :outcome-label="outcomeLabel"
            @redeem="redeemOne"
            @redeem-all="redeemAll"
          />
        </div>
      </div>

      <BottomSheet :open="tradeSheetOpen" aria-label="Trade ticket" @close="tradeSheetOpen = false">
        <Hatchet v-if="hatchetProps" ref="sheetHatchetRef" embedded v-bind="hatchetProps" @trade="handleSheetTrade" @order-placed="onOrderPlaced" @outcome-change="selectedOutcome = $event" />
      </BottomSheet>
    </div>
  </div>
</template>

<script setup lang="ts">
const {
  event,
  pending,
  error,
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
  sportsMatchup,
  sportsTeams,
  livePrices,
  isSingle,
  isClosed,
  singleChance,
  liveOddsPoint,
  liveOddsTokenId,
  tags,
  displayed,
  hasMore,
  showAll,
  expandedId,
  sportsTabs,
  sportsTabKey,
  sportsGroups,
  marketTab,
  selectedOutcome,
  outcomeLabels,
  outcomeLabelSelected,
  bookLoading,
  bookError,
  hasBookLiquidity,
  displayedAsks,
  displayedBids,
  bookSpread,
  lastBookPrice,
  userOrders,
  chartTokensForPanel,
  cancelUserOrder,
  selectSportsTab,
  togglePanel,
  expandMarket,
  selectSportsVariant,
  applyBookLevel,
  fetchBook,
  showResolved,
  resolved,
  resolutionLabel,
  redeemable,
  redeemableTotal,
  redeemableChecked,
  redemptionMsg,
  redeemOne,
  redeemAll,
  outcomeLabel,
  hatchetProps,
  hatchetRef,
  sheetHatchetRef,
  tradeSheetOpen,
  onOrderPlaced,
  handleSheetTrade,
} = useEventPage();

const route = useRoute();
const skeletonSports = computed(() => /^\/(sports|esports)\//.test(route.path));
const errorStatusCode = computed(() => {
  const err = error.value as { statusCode?: unknown; status?: unknown } | null;
  const raw = err?.statusCode ?? err?.status;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
});

const chartMode = ref<"simple" | "advanced">("simple");
const candleTokenId = ref<string | null>(null);
watch(
  [chartPickerOptions, chartTokenIds],
  ([opts, ids]) => {
    const set = new Set(opts.map((o) => o.tokenId));
    if (candleTokenId.value && set.has(candleTokenId.value)) return;
    candleTokenId.value = ids[0] ?? opts[0]?.tokenId ?? null;
  },
  { immediate: true },
);
const candleToken = computed(() => chartPickerOptions.value.find((o) => o.tokenId === candleTokenId.value) ?? chartPickerOptions.value[0] ?? null);
const candleTokens = computed(() => (candleToken.value ? [candleToken.value] : []));
const candleLivePoint = computed(() => (candleToken.value?.tokenId === liveOddsTokenId.value ? liveOddsPoint.value : null));
const sportsLiveStatsMatchId = computed(() => {
  const raw = event.value?.eventMetadata?.sportradarGameId;
  if (typeof raw !== "string") return null;
  const id = Number(raw.match(/sport_event:(\d+)/)?.[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
});

const liveStatsStatus = ref<"loading" | "ready" | "failed">("loading");
watch(sportsLiveStatsMatchId, () => (liveStatsStatus.value = "loading"));
const liveStatsActive = computed(() => sportsLiveStatsMatchId.value !== null && liveStatsStatus.value !== "failed");
</script>
