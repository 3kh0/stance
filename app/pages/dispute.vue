<script setup lang="ts">
import type { DisputeMarket, DisputeStageFilter } from "~/types/markets";

const feed = useDisputeFeed();

useHead({ title: "Disputes | Stance" });

const tabs: Array<{ label: string; value: DisputeStageFilter }> = [
  { label: "All", value: "all" },
  { label: "Clarifications", value: "clarification" },
  { label: "Disputed", value: "disputed" },
  { label: "Re-proposed", value: "reproposed" },
  { label: "Voting", value: "voting" },
  { label: "Resolved", value: "resolved" },
];

const selectedId = ref<string | null>(null);
const sheetOpen = ref(false);
const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;

const selectedMarket = computed(() => feed.markets.value.find((m) => m.id === selectedId.value) ?? feed.markets.value[0] ?? null);

watch(
  () => feed.markets.value,
  (m) => {
    if (m.length === 0) return ((selectedId.value = null), void (sheetOpen.value = false));
    if (!selectedId.value || !m.some((x) => x.id === selectedId.value)) selectedId.value = m[0]!.id;
  },
  { immediate: true },
);

const selectMarket = (m: DisputeMarket) => ((selectedId.value = m.id), (sheetOpen.value = true));
const selectStage = (s: DisputeStageFilter) => ((sheetOpen.value = false), feed.selectStage(s));

onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => clock && clearInterval(clock));
</script>

<template>
  <div class="pm-page">
    <div class="pm-container flex min-h-[calc(100dvh-48px)] flex-col gap-4 py-4 pb-24 md:pb-8">
      <header class="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 class="text-xl font-extrabold leading-none text-white">Disputes</h1>
          <p class="mt-2 max-w-2xl text-sm leading-5 text-text-2">UMA resolution lifecycle tracking for markets that are proposed, disputed, voting, resolved, or recently settled.</p>
        </div>
        <div class="font-mono text-[11px] font-medium text-text-3 tabular-nums">
          <span v-if="feed.updatedAt.value">Updated {{ new Date(feed.updatedAt.value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) }}</span>
          <span v-if="feed.scanned.value"> / scanned {{ feed.scanned.value }}</span>
        </div>
      </header>

      <div class="flex gap-1 overflow-x-auto border-b border-border pb-2">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          class="pm-focus h-8 shrink-0 rounded-md px-3 text-xs font-bold uppercase tracking-widest transition-colors duration-150"
          :class="feed.stage.value === tab.value ? 'bg-surface-2 text-white' : 'text-text-3 hover:text-white'"
          @click="selectStage(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="feed.error.value && feed.markets.value.length === 0" class="flex min-h-80 items-center justify-center px-4">
        <div class="max-w-md rounded-xl border border-border bg-surface p-6 text-center">
          <p class="mb-2 text-base font-semibold leading-5 text-no">{{ feed.error.value }}</p>
          <p class="mb-4 text-sm leading-5 text-text-2">The dispute feed is unavailable right now.</p>
          <button class="pm-button pm-button--secondary pm-focus min-h-10 px-4 text-sm font-semibold" :disabled="feed.loading.value" @click="feed.retry">Retry</button>
        </div>
      </div>

      <div v-else-if="feed.loading.value && feed.markets.value.length === 0" class="grid gap-2 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <div class="grid gap-2">
          <div v-for="i in 5" :key="i" class="h-[184px] rounded-xl border border-border bg-surface p-4">
            <div class="mb-4 flex gap-3">
              <div class="pm-skeleton h-9 w-9 rounded-lg" />
              <div class="flex-1 space-y-2">
                <div class="pm-skeleton h-4 w-1/3" />
                <div class="pm-skeleton h-4 w-5/6" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="pm-skeleton h-[60px] rounded-lg" />
              <div class="pm-skeleton h-[60px] rounded-lg" />
            </div>
          </div>
        </div>
        <div class="hidden rounded-xl border border-border bg-surface lg:block" />
      </div>

      <div v-else-if="feed.markets.value.length === 0" class="flex min-h-80 items-center justify-center px-4">
        <div class="max-w-md text-center text-sm leading-5 text-text-2">No markets are currently in this UMA resolution stage.</div>
      </div>

      <div v-else class="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <div class="min-h-0 space-y-2 lg:max-h-[calc(100dvh-180px)] lg:overflow-y-auto lg:pr-1">
          <DisputeMarketCard v-for="market in feed.markets.value" :key="market.id" :market="market" :selected="selectedMarket?.id === market.id" :now="now" @select="selectMarket" />
        </div>

        <DisputeTimeline v-if="selectedMarket" :market="selectedMarket" :now="now" class="hidden lg:flex lg:max-h-[calc(100dvh-180px)]" />
      </div>
    </div>

    <BottomSheet :open="sheetOpen && Boolean(selectedMarket)" aria-label="Dispute detail" @close="sheetOpen = false">
      <DisputeTimeline v-if="selectedMarket" :market="selectedMarket" :now="now" class="rounded-none border-x-0 border-b-0" />
    </BottomSheet>
  </div>
</template>
