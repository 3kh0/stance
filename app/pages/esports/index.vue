<script setup lang="ts">
useSeoMeta({
  title: "Esports — Stance",
  description: "Live and upcoming esports markets: match winners, map handicaps, and totals across CS2, LoL, Dota 2, and Valorant.",
});

const { view, selectedGame, selectedTournament, loading, error, refresh, now, isLive, liveGroups, upcomingGroups, futuresEvents, railGames, setView, selectGame, selectTournament } = useEsportsFeed();

const { tradeSheetOpen, hatchetProps, bindHatchetRef, bindSheetHatchetRef, setSelectedOutcome, onSelectOdds, onLevelClick, rowProps, toggleBook, refreshBook } = useSportsTradingShell({ refresh, isLive, now });

const activeGameTournaments = computed(() => (selectedGame.value ? (railGames.value.find((g) => g.slug === selectedGame.value)?.tournaments ?? []) : []));

const moreOpen = ref(false);
const onSheetSelectGame = (slug: string | null) => (selectGame(slug), (moreOpen.value = false));
const onSheetSelectTournament = (slug: string, name: string) => (selectTournament(slug, name), (moreOpen.value = false));

const gameSections = computed(() => [
  { key: "live", label: "Live", live: true, groups: liveGroups.value },
  { key: "soon", label: "Starting Soon", live: false, groups: upcomingGroups.value },
]);
const hasGames = computed(() => liveGroups.value.length > 0 || upcomingGroups.value.length > 0);
</script>

<template>
  <div class="flex">
    <aside class="sticky top-0 hidden h-[calc(100dvh-3rem)] w-56 shrink-0 flex-col border-r border-border px-2 py-3 xl:flex">
      <EsportsLeagueRail :games="railGames" :view="view" :selected-game="selectedGame" :selected-tournament="selectedTournament" :loading="loading && !railGames.length" @set-view="setView" @select-game="selectGame" @select-tournament="selectTournament" />
    </aside>

    <SportsHubPanel
      hub-name="Esports"
      :view="view"
      :loading="loading"
      :error="!!error"
      :has-games="hasGames"
      :futures-events="futuresEvents"
      :game-sections="gameSections"
      error-title="Couldn't load esports markets"
      empty-futures-message="No futures markets here right now."
      empty-live-message="No live or upcoming matches here right now."
      hatchet-empty-hint="Tap any match winner, handicap, or total to load the order ticket here."
      :column-headers="{ primary: 'Match', secondary: 'Handicap', tertiary: 'Total' }"
      :hatchet-props="hatchetProps"
      :bind-hatchet-ref="bindHatchetRef"
      :bind-sheet-hatchet-ref="bindSheetHatchetRef"
      :trade-sheet-open="tradeSheetOpen"
      :row-props="rowProps"
      @refresh="refresh"
      @update:trade-sheet-open="tradeSheetOpen = $event"
      @select-odds="onSelectOdds"
      @toggle-book="toggleBook"
      @level-click="onLevelClick"
      @refresh-book="refreshBook"
      @outcome-change="setSelectedOutcome"
    >
      <template #mobile-controls>
        <div class="mb-3 inline-flex rounded-lg border border-border bg-surface p-0.5 text-[13px] font-semibold">
          <button class="rounded-md px-3.5 py-1.5 transition-colors" :class="view === 'live' ? 'bg-surface-2 text-white' : 'text-text-2'" @click="setView('live')">Live</button>
          <button class="rounded-md px-3.5 py-1.5 transition-colors" :class="view === 'futures' ? 'bg-surface-2 text-white' : 'text-text-2'" @click="setView('futures')">Futures</button>
        </div>
        <SportsMobileLeagueChips :items="railGames" :active-slug="selectedGame" @select="selectGame" @more="moreOpen = true" />
        <div v-if="activeGameTournaments.length" class="scrollbar-none -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          <button class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors" :class="selectedTournament === null ? 'border-white/30 bg-surface-2 text-white' : 'border-border bg-surface text-text-2'" @click="selectGame(selectedGame)">All</button>
          <button
            v-for="t in activeGameTournaments"
            :key="t.name"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors"
            :class="selectedTournament === t.name ? 'border-white/30 bg-surface-2 text-white' : 'border-border bg-surface text-text-2'"
            @click="selectTournament(selectedGame!, t.name)"
          >
            {{ t.name }}
          </button>
        </div>
      </template>
    </SportsHubPanel>

    <BottomSheet :open="moreOpen" aria-label="All games" @close="moreOpen = false">
      <div class="px-2 pb-4">
        <EsportsLeagueRail :games="railGames" :view="view" :selected-game="selectedGame" :selected-tournament="selectedTournament" :loading="loading && !railGames.length" @set-view="setView" @select-game="onSheetSelectGame" @select-tournament="onSheetSelectTournament" />
      </div>
    </BottomSheet>
  </div>
</template>
