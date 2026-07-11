<script setup lang="ts">
import type { Outcome } from "~/types/account";
import type { MarketFeedEvent, OrderbookLevel } from "~/types/gamma";
import type { SportsGameRowBindings } from "~/composables/useSportsTradingShell";
import type { BookLevelSelection } from "~/utils/markets";
import type { SportsGame, SportsOdds } from "~/utils/sports";
import type { HatchetProps } from "~/utils/quotes";

interface GameSection {
  key: string;
  label: string;
  live: boolean;
  groups: Array<{ slug: string; label: string; icon: string; games: SportsGame[] }>;
}

const props = defineProps<{
  hubName: string;
  view: "live" | "futures";
  loading: boolean;
  error: boolean;
  hasGames: boolean;
  futuresEvents: MarketFeedEvent[];
  gameSections: GameSection[];
  errorTitle: string;
  emptyFuturesMessage: string;
  emptyLiveMessage: string;
  hatchetEmptyHint: string;
  columnHeaders: { primary: string; secondary: string; tertiary: string };
  hatchetProps: HatchetProps | null;
  bindHatchetRef: (el: unknown) => void;
  bindSheetHatchetRef: (el: unknown) => void;
  tradeSheetOpen: boolean;
  rowProps: (game: SportsGame) => SportsGameRowBindings;
}>();

const emit = defineEmits<{
  refresh: [];
  "update:tradeSheetOpen": [open: boolean];
  "select-odds": [game: SportsGame, odds: SportsOdds];
  "level-click": [payload: { side: BookLevelSelection["side"]; level: OrderbookLevel }];
  "toggle-book": [game: SportsGame];
  "refresh-book": [];
  "outcome-change": [outcome: Outcome];
}>();
</script>

<template>
  <div class="min-w-0 flex-1 px-4 py-5 sm:px-6">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h1 class="text-2xl font-bold leading-8 text-white">
        {{ view === "live" ? "Live" : "Futures" }} <span class="text-text-3">{{ hubName }}</span>
      </h1>
      <button class="pm-focus grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" :class="{ 'animate-spin': loading }" :disabled="loading" title="Refresh" @click="emit('refresh')">
        <Icon name="lucide:refresh-cw" class="h-3.5 w-3.5" />
      </button>
    </div>
    <div class="mb-4 xl:hidden">
      <slot name="mobile-controls" />
    </div>
    <div class="flex gap-6">
      <div class="min-w-0 flex-1">
        <div v-if="error && !loading" class="flex min-h-60 items-center justify-center px-4">
          <div class="max-w-md rounded-xl border border-border bg-surface p-6 text-center">
            <p class="mb-2 text-base font-semibold text-no">{{ errorTitle }}</p>
            <p class="mb-4 text-sm leading-5 text-text-2">The market data is unavailable right now.</p>
            <button class="pm-button pm-button--secondary pm-focus min-h-10 px-4 text-sm" @click="emit('refresh')">Retry</button>
          </div>
        </div>
        <div v-else-if="loading && !hasGames && !futuresEvents.length" aria-hidden="true">
          <div v-if="view === 'futures'" class="pm-grid">
            <div v-for="i in 6" :key="`futures-sk-${i}`" class="min-h-42 rounded-xl border border-border bg-surface">
              <div class="flex items-start gap-2 px-3 pt-3">
                <div class="pm-skeleton h-9 w-9 shrink-0 rounded-md" />
                <div class="min-w-0 flex-1 space-y-2">
                  <div class="pm-skeleton h-4 w-3/4 rounded" />
                  <div class="pm-skeleton h-4 w-1/2 rounded" />
                </div>
              </div>
              <div class="space-y-2 px-3 pt-4">
                <div class="pm-skeleton h-7 w-full rounded-md" />
                <div class="pm-skeleton h-7 w-full rounded-md" />
              </div>
              <div class="flex justify-between px-3 pb-3 pt-4">
                <div class="pm-skeleton h-3 w-16 rounded" />
                <div class="pm-skeleton h-3 w-10 rounded" />
              </div>
            </div>
          </div>
          <div v-else class="flex flex-col gap-9">
            <section v-for="section in 2" :key="`live-sk-section-${section}`" class="flex flex-col gap-7">
              <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest">
                <span v-if="section === 1" class="relative flex h-1.5 w-1.5">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-no opacity-75" />
                  <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-no" />
                </span>
                <span :class="section === 1 ? 'text-no' : 'text-text-2'">{{ section === 1 ? "Live" : "Starting Soon" }}</span>
              </div>
              <section>
                <div class="mb-2.5 flex items-end justify-between gap-3 px-3.5">
                  <div class="flex min-w-0 items-center gap-2">
                    <div class="pm-skeleton h-4.5 w-4.5 shrink-0 rounded" />
                    <div class="pm-skeleton h-4 w-24 rounded" />
                  </div>
                  <div class="hidden shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-text-3 sm:flex">
                    <span class="w-22 text-center">{{ columnHeaders.primary }}</span>
                    <span class="w-30 text-center">{{ columnHeaders.secondary }}</span>
                    <span class="hidden w-22 text-center md:inline-block">{{ columnHeaders.tertiary }}</span>
                  </div>
                </div>
                <div class="flex flex-col gap-2">
                  <div v-for="row in 2" :key="`live-sk-row-${section}-${row}`" class="rounded-xl border border-border bg-surface px-3.5 py-3">
                    <div class="mb-2.5 flex items-center gap-2">
                      <div class="pm-skeleton h-3 w-14 rounded" />
                      <div class="pm-skeleton h-3 w-16 rounded" />
                      <div class="pm-skeleton ml-auto h-6 w-24 rounded-md" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <div v-for="team in 2" :key="`live-sk-team-${section}-${row}-${team}`" class="flex items-center gap-2.5">
                        <div v-if="section === 1" class="pm-skeleton h-7 w-7 shrink-0 rounded-md" />
                        <div class="pm-skeleton h-7 w-7 shrink-0 rounded-md" />
                        <div class="flex min-w-0 flex-1 items-baseline gap-1.5">
                          <div class="pm-skeleton h-4 w-32 rounded sm:w-40" />
                          <div class="pm-skeleton h-3 w-12 shrink-0 rounded max-sm:hidden" />
                        </div>
                        <div class="flex shrink-0 items-center gap-1.5">
                          <div class="w-22"><div class="pm-skeleton h-9 w-full rounded-md" /></div>
                          <div class="hidden w-30 sm:block"><div class="pm-skeleton h-9 w-full rounded-md" /></div>
                          <div class="hidden w-22 md:block"><div class="pm-skeleton h-9 w-full rounded-md" /></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </section>
          </div>
        </div>
        <template v-else-if="view === 'futures'">
          <div v-if="futuresEvents.length" class="pm-grid">
            <MarketCard v-for="(ev, index) in futuresEvents" :key="ev.id" :event="ev" :style="{ '--card-index': Math.min(index, 8) }" />
          </div>
          <div v-else class="flex min-h-60 items-center justify-center text-sm text-text-2">{{ emptyFuturesMessage }}</div>
        </template>

        <template v-else>
          <div v-if="hasGames" class="flex flex-col gap-9">
            <template v-for="section in gameSections" :key="section.key">
              <div v-if="section.groups.length" class="flex flex-col gap-7">
                <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-text-2">
                  <span v-if="!section.live" class="text-text-3">Starting soon ({{ section.groups.reduce((sum, group) => sum + group.games.length, 0) }})</span>
                </div>
                <section v-for="group in section.groups" :key="`${section.key}-${group.slug}`">
                  <div class="mb-2.5 flex items-end justify-between gap-3 px-3.5">
                    <div class="flex items-center gap-2 text-[15px] font-bold text-white">
                      <Icon :name="group.icon" class="h-4.5 w-4.5 text-text-2" />
                      {{ group.label }}
                    </div>
                    <div class="hidden shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-text-3 sm:flex">
                      <span class="w-22 text-center">{{ columnHeaders.primary }}</span>
                      <span class="w-30 text-center">{{ columnHeaders.secondary }}</span>
                      <span class="hidden w-22 text-center md:inline-block">{{ columnHeaders.tertiary }}</span>
                    </div>
                  </div>
                  <div class="flex flex-col gap-2">
                    <SportsGameRow v-for="game in group.games" :key="game.id" :game="game" v-bind="rowProps(game)" @select-odds="emit('select-odds', game, $event)" @toggle-book="emit('toggle-book', game)" @level-click="emit('level-click', $event)" @refresh-book="emit('refresh-book')" />
                  </div>
                </section>
              </div>
            </template>
          </div>
          <div v-else class="flex min-h-60 items-center justify-center text-sm text-text-2">{{ emptyLiveMessage }}</div>
        </template>
      </div>

      <aside class="hidden w-80 shrink-0 lg:block">
        <Hatchet v-if="hatchetProps" :ref="props.bindHatchetRef" v-bind="hatchetProps" @trade="() => {}" @order-placed="emit('refresh')" @outcome-change="emit('outcome-change', $event)" />
        <div v-else class="sticky top-4 flex min-h-60 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface p-6 text-center">
          <Icon name="lucide:mouse-pointer-click" class="h-6 w-6 text-text-3" />
          <p class="text-sm font-semibold text-white">Pick a line to trade</p>
          <p class="text-xs leading-5 text-text-2">{{ hatchetEmptyHint }}</p>
        </div>
      </aside>
    </div>

    <BottomSheet :open="tradeSheetOpen" aria-label="Trade ticket" @close="emit('update:tradeSheetOpen', false)">
      <Hatchet v-if="hatchetProps" :ref="props.bindSheetHatchetRef" embedded v-bind="hatchetProps" @trade="() => {}" @order-placed="emit('refresh')" @outcome-change="emit('outcome-change', $event)" />
    </BottomSheet>
  </div>
</template>
