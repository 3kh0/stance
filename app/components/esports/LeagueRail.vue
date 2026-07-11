<script setup lang="ts">
import type { EsportsRailGame, EsportsRailTournament } from "~/composables/useEsportsFeed";
import type { SportsView } from "~/utils/sportsFeed";
import { fmtcn } from "~/utils/prices";

const props = defineProps<{
  games: EsportsRailGame[];
  view: SportsView;
  selectedGame: string | null;
  selectedTournament: string | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  "set-view": [view: SportsView];
  "select-game": [slug: string | null];
  "select-tournament": [slug: string, name: string];
}>();

const count = (x: EsportsRailGame | EsportsRailTournament) => (props.view === "futures" ? x.futuresCount : x.count);

const activeCls = (a: boolean) => (a ? "bg-surface-2 text-white" : "text-text-2 hover:bg-surface hover:text-white");
const viewClass = (a: boolean) => ["pm-focus flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors duration-150", activeCls(a)];
const gameClass = (a: boolean) => ["pm-focus group flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-colors duration-150", activeCls(a)];
const childClass = (a: boolean) => ["pm-focus group flex w-full items-center gap-2.5 rounded-lg py-1.5 pl-8 pr-3 text-left transition-colors duration-150", activeCls(a)];

const expanded = ref<string[]>([]);
const expandedSet = computed(() => new Set(expanded.value));
const hasTournaments = (g: EsportsRailGame) => g.tournaments.length > 0;
const gameSelected = (g: EsportsRailGame) => props.selectedGame === g.slug && !props.selectedTournament;
const gameActive = (g: EsportsRailGame) => props.selectedGame === g.slug;
const isExpanded = (g: EsportsRailGame) => hasTournaments(g) && expandedSet.value.has(g.slug);

const clickGame = (g: EsportsRailGame) => (!hasTournaments(g) ? emit("select-game", g.slug) : (expanded.value = expandedSet.value.has(g.slug) ? expanded.value.filter((s) => s !== g.slug) : [...expanded.value, g.slug]));

watch(
  () => props.selectedGame,
  (slug) => slug && !expandedSet.value.has(slug) && (expanded.value = [...expanded.value, slug]),
);

function flip(el: Element, expand: boolean) {
  const n = el as HTMLElement;
  n.style.height = expand ? "0" : `${n.scrollHeight}px`;
  void n.offsetHeight;
  n.style.height = expand ? `${n.scrollHeight}px` : "0";
}
const onEnter = (el: Element) => flip(el, true);
const onLeave = (el: Element) => flip(el, false);
const onAfterEnter = (el: Element) => ((el as HTMLElement).style.height = "auto");
</script>

<template>
  <nav class="flex h-full w-full flex-col gap-1 overflow-y-auto pb-6">
    <button :class="viewClass(view === 'live')" @click="emit('set-view', 'live')">
      <Icon name="lucide:radio" class="h-4 w-4 shrink-0" />
      Live
    </button>
    <button :class="viewClass(view === 'futures')" @click="emit('set-view', 'futures')">
      <Icon name="lucide:bar-chart-3" class="h-4 w-4 shrink-0" />
      Futures
    </button>

    <div class="mt-3 mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-text-3">Games</div>

    <button :class="gameClass(selectedGame === null)" @click="emit('select-game', null)">
      <Icon name="lucide:layout-grid" class="h-4.5 w-4.5 shrink-0 text-text-3 group-hover:text-text-2" :class="selectedGame === null ? 'text-white' : ''" />
      <span class="flex-1 truncate text-[13.5px] font-medium">All</span>
    </button>

    <template v-if="loading && !games.length">
      <div v-for="i in 6" :key="`erail-sk-${i}`" class="flex items-center gap-2.5 px-3 py-1.5" aria-hidden="true">
        <div class="pm-skeleton h-4.5 w-4.5 shrink-0 rounded" />
        <div class="pm-skeleton h-3.5 rounded" :style="{ width: `${45 + ((i * 7) % 40)}%` }" />
      </div>
    </template>

    <template v-else>
      <div v-for="game in games" :key="game.slug">
        <button :class="gameClass(gameActive(game))" @click="clickGame(game)">
          <Icon :name="game.icon" class="h-4.5 w-4.5 shrink-0 text-text-3 group-hover:text-text-2" :class="gameActive(game) ? 'text-white' : ''" />
          <span class="flex-1 truncate text-[13.5px] font-medium">{{ game.label }}</span>
          <Icon v-if="hasTournaments(game)" :name="isExpanded(game) ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="h-4 w-4 shrink-0 text-text-3" />
          <span v-else-if="count(game) > 0" class="font-mono shrink-0 text-[11px] text-text-3">{{ fmtcn(count(game)) }}</span>
        </button>

        <Transition name="rail-accordion" @enter="onEnter" @after-enter="onAfterEnter" @leave="onLeave">
          <div v-if="isExpanded(game)" class="overflow-hidden">
            <div class="flex flex-col gap-0.5 pt-0.5">
              <button :class="childClass(gameSelected(game))" @click="emit('select-game', game.slug)">
                <span class="flex-1 truncate text-[13px] font-medium">All {{ game.label }}</span>
                <span v-if="count(game) > 0" class="font-mono shrink-0 text-[11px] text-text-3">{{ fmtcn(count(game)) }}</span>
              </button>
              <button v-for="t in game.tournaments" :key="`${game.slug}-${t.name}`" :class="childClass(selectedGame === game.slug && selectedTournament === t.name)" @click="emit('select-tournament', game.slug, t.name)">
                <span class="flex-1 truncate text-[13px] font-medium">{{ t.name }}</span>
                <span v-if="count(t) > 0" class="font-mono shrink-0 text-[11px] text-text-3">{{ fmtcn(count(t)) }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </template>
  </nav>
</template>

<style scoped>
.rail-accordion-enter-active,
.rail-accordion-leave-active {
  overflow: hidden;
  transition:
    height 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 160ms cubic-bezier(0.22, 1, 0.36, 1);
}

.rail-accordion-enter-from,
.rail-accordion-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .rail-accordion-enter-active,
  .rail-accordion-leave-active {
    transition: none;
  }
}
</style>
