<script setup lang="ts">
import type { SportsView } from "~/utils/sportsFeed";
import { fmtcn } from "~/utils/prices";

export interface RailLeague {
  tagId: number;
  slug: string;
  label: string;
  icon: string;
  count: number;
  futuresCount: number;
  children?: RailLeague[];
}

const props = defineProps<{
  leagues: RailLeague[];
  view: SportsView;
  activeSlug: string | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  "set-view": [view: SportsView];
  "select-league": [slug: string | null];
}>();

const displayCount = (l: RailLeague) => (props.view === "futures" ? l.futuresCount : l.count);
const activeCls = (a: boolean) => (a ? "bg-surface-2 text-white" : "text-text-2 hover:bg-surface hover:text-white");
const viewClass = (a: boolean) => ["pm-focus flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors duration-150", activeCls(a)];
const leagueClass = (a: boolean) => ["pm-focus group flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-colors duration-150", activeCls(a)];
const childClass = (a: boolean) => ["pm-focus group flex w-full items-center gap-2.5 rounded-lg py-1.5 pl-8 pr-3 text-left transition-colors duration-150", activeCls(a)];

const expandedSlugs = ref<string[]>([]);
const expandedSet = computed(() => new Set(expandedSlugs.value));

const hasChildren = (l: RailLeague) => Boolean(l.children?.length);
const childIsActive = (l: RailLeague) => Boolean(l.children?.some((c) => c.slug === props.activeSlug));
const leagueIsActive = (l: RailLeague) => props.activeSlug === l.slug || childIsActive(l);
const leagueIsExpanded = (l: RailLeague) => hasChildren(l) && (expandedSet.value.has(l.slug) || childIsActive(l) || props.activeSlug === l.slug);

function toggleLeague(slug: string) {
  const next = new Set(expandedSlugs.value);
  if (next.has(slug)) next.delete(slug);
  else next.add(slug);
  expandedSlugs.value = [...next];
}

function selectLeague(l: RailLeague) {
  if (hasChildren(l)) toggleLeague(l.slug);
  else emit("select-league", l.slug);
}

watch(
  () => props.activeSlug,
  (slug) => {
    if (slug === null) return;
    const parent = props.leagues.find((l) => l.slug === slug || l.children?.some((c) => c.slug === slug));
    if (!parent?.children?.length || expandedSet.value.has(parent.slug)) return;
    expandedSlugs.value = [...expandedSlugs.value, parent.slug];
  },
  { immediate: true },
);
</script>

<template>
  <nav class="flex h-full w-full flex-col gap-1 overflow-y-auto pb-6 scrollbar-gutter-stable">
    <button :class="viewClass(view === 'live')" @click="emit('set-view', 'live')">
      <Icon name="lucide:radio" class="h-4 w-4 shrink-0" />
      Live
    </button>
    <button :class="viewClass(view === 'futures')" @click="emit('set-view', 'futures')">
      <Icon name="lucide:bar-chart-3" class="h-4 w-4 shrink-0" />
      Futures
    </button>
    <div class="mt-3 mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-text-3">All Sports</div>
    <button :class="leagueClass(activeSlug === null)" @click="emit('select-league', null)">
      <Icon name="lucide:layout-grid" class="h-4.5 w-4.5 shrink-0 text-text-3 group-hover:text-text-2" :class="activeSlug === null ? 'text-white' : ''" />
      <span class="flex-1 truncate text-[13.5px] font-medium">All</span>
    </button>
    <template v-if="loading && !leagues.length">
      <div v-for="i in 10" :key="`rail-sk-${i}`" class="flex items-center gap-2.5 px-3 py-1.5" aria-hidden="true">
        <div class="pm-skeleton h-4.5 w-4.5 shrink-0 rounded" />
        <div class="pm-skeleton h-3.5 rounded" :style="{ width: `${45 + ((i * 7) % 40)}%` }" />
      </div>
    </template>

    <template v-else>
      <div v-for="league in leagues" :key="league.slug">
        <button :class="leagueClass(leagueIsActive(league))" @click="selectLeague(league)">
          <Icon :name="league.icon" class="h-4.5 w-4.5 shrink-0 text-text-3 group-hover:text-text-2" :class="leagueIsActive(league) ? 'text-white' : ''" />
          <span class="flex-1 truncate text-[13.5px] font-medium">{{ league.label }}</span>
          <Icon v-if="hasChildren(league)" :name="leagueIsExpanded(league) ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="h-4 w-4 shrink-0 text-text-3" />
          <span v-else-if="displayCount(league) > 0" class="font-mono shrink-0 text-[11px] text-text-3">{{ fmtcn(displayCount(league)) }}</span>
        </button>
        <div v-if="leagueIsExpanded(league)" class="mt-0.5 flex flex-col gap-0.5">
          <button v-for="child in league.children" :key="`${league.slug}-${child.slug}`" :class="childClass(activeSlug === child.slug)" @click="emit('select-league', child.slug)">
            <Icon :name="child.icon" class="h-4 w-4 shrink-0 text-text-3 group-hover:text-text-2" :class="activeSlug === child.slug ? 'text-white' : ''" />
            <span class="flex-1 truncate text-[13px] font-medium">{{ child.label }}</span>
            <span v-if="displayCount(child) > 0" class="font-mono shrink-0 text-[11px] text-text-3">{{ fmtcn(displayCount(child)) }}</span>
          </button>
        </div>
      </div>
    </template>
  </nav>
</template>
