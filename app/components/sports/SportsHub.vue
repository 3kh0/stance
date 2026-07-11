<script setup lang="ts">
import type { RailLeague } from "~/components/sports/LeagueRail.vue";
import type { GammaEvent, GammaTag } from "~/types/gamma";
import type { SubTag } from "~/types/markets";
import { isEsportsLeagueSlug, isGenericSportsTag, leagueIcon, leagueMeta, leagueOrder, leaguePathSlug, normalizeLeagueKey } from "~/utils/sports";

interface SportsRailFamily {
  slug: string;
  label: string;
  icon: string;
  allSlug?: string;
  childSlugs: string[];
  matchSlugs: string[];
  alwaysGroup?: boolean;
}

type RailTag = Pick<GammaTag, "slug" | "label"> & {
  id?: string | number;
  activeEventsCount?: number;
  count?: number;
};

const QUICK_RAIL_SLUGS = ["world-cup", "mlb", "nhl"];

const WORLD_CUP_TAG_ID = 102232;
const DIRECT_RAIL_SLUGS = ["golf", "f1", "boxing", "chess"];
const EXCLUDED_RAIL_TAGS = new Set(["fifa", "ice-hockey", "major-league-baseball", "mention-markets", "pop-culture"]);
const SPORTS_RAIL_FAMILIES: SportsRailFamily[] = [
  { slug: "ufc", label: "UFC", icon: leagueIcon("ufc"), allSlug: "ufc", childSlugs: [], matchSlugs: ["ufc"], alwaysGroup: true },
  { slug: "football", label: "Football", icon: leagueIcon("football"), childSlugs: ["nfl", "cfb", "fantasy-football"], matchSlugs: ["football", "nfl", "cfb", "fantasy-football"], alwaysGroup: true },
  { slug: "soccer", label: "Soccer", icon: leagueIcon("soccer"), allSlug: "soccer", childSlugs: ["world-cup", "epl", "mls", "ucl"], matchSlugs: ["soccer", "fifa-world-cup", "world-cup", "2026-fifa-world-cup", "fifwc", "epl", "mls", "ucl"], alwaysGroup: true },
  { slug: "tennis", label: "Tennis", icon: leagueIcon("tennis"), allSlug: "tennis", childSlugs: ["atp", "wta"], matchSlugs: ["tennis", "atp", "wta"], alwaysGroup: true },
  { slug: "cricket", label: "Cricket", icon: leagueIcon("cricket"), allSlug: "cricket", childSlugs: [], matchSlugs: ["cricket"], alwaysGroup: true },
  { slug: "basketball", label: "Basketball", icon: leagueIcon("basketball"), allSlug: "basketball", childSlugs: ["nba", "wnba", "bsn", "bkbsn"], matchSlugs: ["basketball", "nba", "wnba", "bsn", "bkbsn"], alwaysGroup: true },
  { slug: "baseball", label: "Baseball", icon: leagueIcon("baseball"), childSlugs: ["mlb"], matchSlugs: ["baseball", "mlb"], alwaysGroup: true },
  { slug: "hockey", label: "Hockey", icon: leagueIcon("hockey"), childSlugs: ["nhl"], matchSlugs: ["hockey", "nhl"], alwaysGroup: true },
  { slug: "rugby", label: "Rugby", icon: leagueIcon("rugby"), allSlug: "rugby", childSlugs: [], matchSlugs: ["rugby"], alwaysGroup: true },
  { slug: "table-tennis", label: "Table Tennis", icon: leagueIcon("table-tennis"), allSlug: "table-tennis", childSlugs: [], matchSlugs: ["table-tennis"], alwaysGroup: true },
];

const route = useRoute();

const routeLeague = computed<string | null>(() => {
  const value = route.params.league;
  const slug = Array.isArray(value) ? value[0] : value;
  return slug ? normalizeLeagueKey(slug) : null;
});

const { view, leagueSlug, loading, error, refresh, now, isLive, navigationEvents, navigationGameEvents, liveGroups, upcomingGroups, futuresEvents, worldCupActive, worldCupBadgeCount, setView, selectLeague } = useSportsFeed();

watch(routeLeague, (slug) => selectLeague(slug), { immediate: true });

const activeLeagueLabel = computed(() => (routeLeague.value ? (leagueMeta(routeLeague.value)?.label ?? humanizeLeagueSlug(leaguePathSlug(routeLeague.value))) : null));

useSeoMeta({
  title: () => (activeLeagueLabel.value ? `${activeLeagueLabel.value} — Sports — Stance` : "Sports — Stance"),
  description: () => (activeLeagueLabel.value ? `Live and upcoming ${activeLeagueLabel.value} markets: moneyline, spread, and totals.` : "Live and upcoming sports markets: moneyline, spread, and totals across every league."),
});

const { tradeSheetOpen, hatchetProps, bindHatchetRef, bindSheetHatchetRef, setSelectedOutcome, onSelectOdds, onLevelClick, rowProps, toggleBook, refreshBook } = useSportsTradingShell({ refresh, isLive, now });

const { data: tagsData } = useFetch<SubTag[]>("/api/category-tags", {
  query: { slug: "sports" },
  lazy: true,
});

function toRailLeague(tag: RailTag): RailLeague | null {
  const raw = normalizeLeagueKey(tag.slug);
  const tagId = Number(tag.id);
  if (!raw || !Number.isFinite(tagId) || tagId <= 0 || skipRailTag(raw, tag.label)) return null;
  const slug = leaguePathSlug(raw);
  const meta = leagueMeta(raw) ?? leagueMeta(slug);
  return {
    tagId,
    slug,
    label: meta?.label ?? tag.label ?? humanizeLeagueSlug(slug),
    icon: meta?.icon ?? leagueIcon(slug),
    count: tag.count ?? 0,
    futuresCount: tag.activeEventsCount ?? 0,
  };
}

const skipRailTag = (slug: string, label?: string | null) => isGenericSportsTag(slug) || isEsportsLeagueSlug(slug) || isEsportsLeagueSlug(label) || EXCLUDED_RAIL_TAGS.has(slug);

function mergeLeague(map: Map<string, RailLeague>, league: RailLeague | null) {
  if (!league) return;
  const ex = map.get(league.slug);
  if (!ex) {
    map.set(league.slug, { ...league });
    return;
  }
  ex.count = Math.max(ex.count, league.count);
  ex.futuresCount = Math.max(ex.futuresCount, league.futuresCount);
  ex.label = leagueMeta(ex.slug)?.label ?? ex.label;
  ex.icon = leagueIcon(ex.slug);
}

function feedLeagues(events: GammaEvent[], countTarget: "count" | "futuresCount" = "count"): RailLeague[] {
  const counts = new Map<string, { tag: GammaTag; eventIds: Set<string> }>();
  for (const event of events) {
    for (const tag of (event.tags as GammaTag[] | undefined) ?? []) {
      const raw = normalizeLeagueKey(tag.slug);
      if (!raw || skipRailTag(raw, tag.label)) continue;
      const slug = leaguePathSlug(raw);
      const cur = counts.get(slug) ?? { tag, eventIds: new Set<string>() };
      cur.eventIds.add(String(event.id));
      counts.set(slug, cur);
    }
  }
  return [...counts.entries()].map(([slug, v]) => toRailLeague({ ...v.tag, slug, count: countTarget === "count" ? v.eventIds.size : 0, activeEventsCount: countTarget === "futuresCount" ? v.eventIds.size : 0 })).filter((l): l is RailLeague => l !== null);
}

function familyForEvent(event: GammaEvent): SportsRailFamily | undefined {
  const slugs = new Set(((event.tags as GammaTag[] | undefined) ?? []).map((t) => normalizeLeagueKey(t.slug)).filter(Boolean));
  return SPORTS_RAIL_FAMILIES.find((f) => f.matchSlugs.some((s) => slugs.has(s)));
}

function dynamicFamilyChildren(events: GammaEvent[]): Map<string, Set<string>> {
  const extras = new Map<string, Set<string>>();
  for (const event of events) {
    const family = familyForEvent(event);
    if (!family) continue;
    for (const tag of (event.tags as GammaTag[] | undefined) ?? []) {
      const raw = normalizeLeagueKey(tag.slug);
      if (!raw || raw === family.slug || raw === family.allSlug || skipRailTag(raw, tag.label)) continue;
      const slug = leaguePathSlug(raw);
      if (slug === family.slug || slug === family.allSlug) continue;
      const set = extras.get(family.slug) ?? new Set<string>();
      set.add(slug);
      extras.set(family.slug, set);
    }
  }
  return extras;
}

const humanizeLeagueSlug = (v: string) =>
  v
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

const byOrderThenLabel = (a: RailLeague, b: RailLeague) => leagueOrder(a.slug) - leagueOrder(b.slug) || a.label.localeCompare(b.label);

const leagues = computed<RailLeague[]>(() =>
  (tagsData.value ?? [])
    .map(toRailLeague)
    .filter((l): l is RailLeague => l !== null)
    .sort(byOrderThenLabel),
);

const railLeagues = computed<RailLeague[]>(() => {
  const bySlug = new Map<string, RailLeague>();
  for (const league of leagues.value) mergeLeague(bySlug, league);
  for (const league of feedLeagues(navigationGameEvents.value)) mergeLeague(bySlug, league);
  for (const league of feedLeagues(navigationEvents.value, "futuresCount")) mergeLeague(bySlug, league);

  if (worldCupActive.value) {
    mergeLeague(bySlug, { tagId: WORLD_CUP_TAG_ID, slug: "world-cup", label: leagueMeta("world-cup")?.label ?? "World Cup", icon: leagueIcon("world-cup"), count: worldCupBadgeCount.value, futuresCount: worldCupBadgeCount.value });
  }

  const familyExtras = dynamicFamilyChildren(navigationEvents.value);
  const groupedChildSlugs = new Set<string>();
  const result: RailLeague[] = [];

  for (const slug of QUICK_RAIL_SLUGS) {
    const league = bySlug.get(slug);
    if (league) result.push({ ...league });
  }

  for (const family of SPORTS_RAIL_FAMILIES) {
    const childSlugs = [...new Set([...(family.allSlug ? [family.allSlug] : []), ...family.childSlugs, ...(familyExtras.get(family.slug) ?? [])])];
    const children = childSlugs
      .map((slug) => {
        const child = bySlug.get(slug);
        if (!child) return null;
        groupedChildSlugs.add(slug);
        return {
          ...child,
          label: slug === family.allSlug ? "All" : child.label,
          icon: slug === family.allSlug ? family.icon : child.icon,
        };
      })
      .filter((child): child is RailLeague => child !== null)
      .sort((a, b) => (a.slug === family.allSlug ? -1 : b.slug === family.allSlug ? 1 : byOrderThenLabel(a, b)));

    if (!children.length || (!family.alwaysGroup && children.length < 2)) continue;

    const onlyAll = family.allSlug && children.length === 1 && children[0]!.slug === family.allSlug;
    if (onlyAll) {
      result.push({ tagId: children[0]!.tagId, slug: family.slug, label: family.label, icon: family.icon, count: children[0]!.count, futuresCount: children[0]!.futuresCount });
      continue;
    }

    const allChild = family.allSlug ? children.find((child) => child.slug === family.allSlug) : undefined;
    result.push({
      tagId: allChild?.tagId ?? children[0]!.tagId,
      slug: family.slug,
      label: family.label,
      icon: family.icon,
      count: allChild?.count ?? children.reduce((sum, child) => sum + child.count, 0),
      futuresCount: allChild?.futuresCount ?? children.reduce((sum, child) => sum + child.futuresCount, 0),
      children,
    });
  }

  for (const slug of DIRECT_RAIL_SLUGS) {
    if (QUICK_RAIL_SLUGS.includes(slug)) continue;
    const league = bySlug.get(slug);
    if (league) result.push({ ...league });
  }

  const alreadyTopLevel = new Set([...QUICK_RAIL_SLUGS, ...DIRECT_RAIL_SLUGS, ...SPORTS_RAIL_FAMILIES.map((family) => family.slug)]);
  for (const league of [...bySlug.values()].sort(byOrderThenLabel)) {
    if (alreadyTopLevel.has(league.slug) || groupedChildSlugs.has(league.slug)) continue;
    result.push({ ...league });
  }

  return result;
});

const moreOpen = ref(false);

const onSetView = (next: "live" | "futures") => setView(next);
const onSelectLeague = (slug: string | null) => void navigateTo(slug ? `/sports/${leaguePathSlug(slug)}` : "/sports");
const onSheetSelectLeague = (slug: string | null) => {
  onSelectLeague(slug);
  moreOpen.value = false;
};

const gameSections = computed(() => [
  { key: "live", label: "Live", live: true, groups: liveGroups.value },
  { key: "soon", label: "Starting Soon", live: false, groups: upcomingGroups.value },
]);
const hasGames = computed(() => liveGroups.value.length > 0 || upcomingGroups.value.length > 0);
</script>

<template>
  <div class="flex">
    <aside class="sticky top-0 hidden h-[calc(100dvh-3rem)] w-56 shrink-0 flex-col border-r border-border px-2 py-3 xl:flex">
      <SportsLeagueRail :leagues="railLeagues" :view="view" :active-slug="leagueSlug" :loading="loading && !railLeagues.length" @set-view="onSetView" @select-league="onSelectLeague" />
    </aside>
    <SportsHubPanel
      :hub-name="activeLeagueLabel ?? 'Sports'"
      :view="view"
      :loading="loading"
      :error="!!error"
      :has-games="hasGames"
      :futures-events="futuresEvents"
      :game-sections="gameSections"
      error-title="Couldn't load sports markets"
      empty-futures-message="No futures markets here right now."
      empty-live-message="No live or upcoming games here right now."
      hatchet-empty-hint="Tap any moneyline, spread, or total to load the order ticket here."
      :column-headers="{ primary: 'Moneyline', secondary: 'Spread', tertiary: 'Total' }"
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
          <button class="rounded-md px-3.5 py-1.5 transition-colors" :class="view === 'live' ? 'bg-surface-2 text-white' : 'text-text-2'" @click="onSetView('live')">Live</button>
          <button class="rounded-md px-3.5 py-1.5 transition-colors" :class="view === 'futures' ? 'bg-surface-2 text-white' : 'text-text-2'" @click="onSetView('futures')">Futures</button>
        </div>
        <SportsMobileLeagueChips :items="leagues" :active-slug="leagueSlug" @select="onSelectLeague" @more="moreOpen = true" />
      </template>
    </SportsHubPanel>

    <BottomSheet :open="moreOpen" aria-label="All leagues" @close="moreOpen = false">
      <div class="px-2 pb-4">
        <SportsLeagueRail :leagues="railLeagues" :view="view" :active-slug="leagueSlug" :loading="loading && !railLeagues.length" @set-view="onSetView" @select-league="onSheetSelectLeague" />
      </div>
    </BottomSheet>
  </div>
</template>
