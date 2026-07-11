<script setup lang="ts">
import type { EventTeam, GammaMarket, GammaTag, MarketFeedEvent } from "~/types/gamma";
import { formatRangeLabel } from "~/utils/markets";
import { parseMarketOutcomes, sportsEventUrl } from "~/utils/sports";
import { fmtsp, fmtv, probb, proba } from "~/utils/prices";

const props = defineProps<{
  event: MarketFeedEvent;
}>();

const { isWatched, toggle: toggleWatchlist } = useWatchlist();
const watched = computed(() => isWatched(String(props.event.id)));
const toggleWatch = () => toggleWatchlist({ id: String(props.event.id), slug: props.event.slug, title: props.event.title ?? "Untitled market" });

function parseOutcomes(m: GammaMarket): string[] {
  if (!m.outcomes) return [];
  try {
    const a = JSON.parse(m.outcomes);
    return Array.isArray(a) ? a.filter((o): o is string => typeof o === "string") : [];
  } catch {
    return [];
  }
}

const dayChange = (m: GammaMarket) => {
  const n = Number.parseFloat(String(m.oneDayPriceChange ?? 0));
  return Number.isFinite(n) ? n : 0;
};

const topMarkets = computed(() =>
  (props.event.markets ?? [])
    .filter((m) => m.active !== false && m.closed !== true)
    .map((market) => {
      const { yes: yesPrice, no: noPrice } = parseOutcomePrices(market);
      const o = parseOutcomes(market);
      const yi = o.findIndex((x) => x.toLowerCase() === "yes");
      const ni = o.findIndex((x) => x.toLowerCase() === "no");
      return { market, title: market.groupItemTitle, yesPrice, noPrice, yesLabel: yi >= 0 ? o[yi]! : o[0] || "Yes", noLabel: ni >= 0 ? o[ni]! : o[1] || "No", delta: dayChange(market) };
    })
    .sort((a, b) => b.yesPrice - a.yesPrice),
);

const displayMarkets = computed(() => topMarkets.value.slice(0, 3));
const vol = computed(() => fmtv(Number.parseFloat(String(props.event.volume ?? 0))));
const category = computed(() => (props.event.tags as GammaTag[] | undefined)?.[0]?.label ?? "");
const GENERIC_TAGS = new Set(["sports", "games", "all", "esports"]);
const sportLabel = computed(() => {
  const t = (props.event.tags as GammaTag[] | undefined) ?? [];
  return (t.find((x) => x.label && !GENERIC_TAGS.has(x.label.toLowerCase()))?.label ?? "").replace(/\b\w/g, (c) => c.toUpperCase());
});
const isSports = computed(() => (props.event.markets ?? []).some((m) => Boolean(m.sportsMarketType)));

function teamLogoFor(outcome: string, i: number): string | undefined {
  const teams = (props.event.teams as EventTeam[] | undefined) ?? [];
  if (!teams.length) return undefined;
  const k = outcome.toLowerCase();
  const byName = teams.find((t) => t.name?.toLowerCase() === k || t.abbreviation?.toLowerCase() === k);
  return byName?.logo ?? (teams.find((t) => t.ordering === (i === 0 ? "home" : "away")) ?? teams[i])?.logo;
}

const headToHead = computed(() => {
  if (!isSports.value) return null;
  const ml = (props.event.markets ?? []).filter((m) => m.sportsMarketType === "moneyline" && m.active !== false && m.closed !== true);
  if (!ml.length) return null;

  const teamMl = ml.find((m) => {
    const [a, b] = parseMarketOutcomes(m);
    return !(a.toLowerCase() === "yes" && b.toLowerCase() === "no");
  });
  if (teamMl) {
    const [teamA, teamB] = parseMarketOutcomes(teamMl);
    const { yes, no } = parseOutcomePrices(teamMl);
    return { teamA, teamB, priceA: yes, priceB: no, logoA: teamLogoFor(teamA, 0), logoB: teamLogoFor(teamB, 1), drawPrice: null as number | null, startTime: teamMl.gameStartTime };
  }

  const teams = (props.event.teams as EventTeam[] | undefined) ?? [];
  if (teams.length < 2) return null;
  const home = teams.find((t) => t.ordering === "home") ?? teams[0]!;
  const away = teams.find((t) => t.ordering === "away") ?? teams[1]!;
  const win = (team: EventTeam) => ml.find((m) => (m.groupItemTitle ?? "").toLowerCase() === team.name.toLowerCase());
  const ma = win(home);
  const mb = win(away);
  if (!ma || !mb) return null;
  const draw = ml.find((m) => /draw/i.test(m.groupItemTitle ?? m.question ?? ""));
  return {
    teamA: home.name,
    teamB: away.name,
    priceA: parseOutcomePrices(ma).yes,
    priceB: parseOutcomePrices(mb).yes,
    logoA: home.logo,
    logoB: away.logo,
    drawPrice: draw ? parseOutcomePrices(draw).yes : null,
    startTime: ma.gameStartTime ?? draw?.gameStartTime,
  };
});

const displayTitle = computed(() => (headToHead.value ? `${headToHead.value.teamA} vs ${headToHead.value.teamB}` : (props.event.title ?? "")));

const isMounted = ref(false);
onMounted(() => (isMounted.value = true));
const gameTime = computed(() => {
  if (!isMounted.value || !headToHead.value?.startTime) return "";
  const d = new Date(headToHead.value.startTime);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const sod = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((sod(d) - sod(new Date())) / 86_400_000);
  if (days === 0) return time;
  if (days === 1) return `Tomorrow ${time}`;
  if (days === -1) return `Yesterday ${time}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
});

const isBinary = computed(() => topMarkets.value.length === 1);
const binary = computed(() => topMarkets.value[0]);
const isRange = computed(() => {
  if (isBinary.value || headToHead.value) return false;
  const t = topMarkets.value.filter((m) => m.title);
  return t.length >= 3 && t.filter((m) => isRangeLabel(m.title)).length >= Math.ceil(t.length * 0.6);
});
const isCurrencyRange = computed(() => (props.event.markets ?? []).some((m) => (m.question ?? "").includes("$")));
const leadingRange = computed(() => topMarkets.value[0] ?? null);
const rangeBuckets = computed(() => {
  const total = topMarkets.value.reduce((s, m) => s + Math.max(m.yesPrice, 0), 0) || 1;
  return topMarkets.value.map((m) => ({ id: m.market.id, weight: (Math.max(m.yesPrice, 0) / total) * 100, lead: m.market.id === leadingRange.value?.market.id, lower: rangeLowerBound(m.title) })).sort((a, b) => a.lower - b.lower);
});
const isResolved = computed(() => props.event.closed === true || topMarkets.value.length === 0);
const eventUrl = computed(() => (isSports.value ? sportsEventUrl(props.event) : `/event/${props.event.slug ?? props.event.id}?x=${props.event.id}`));

const pct = (p: number) => Math.round(p * 100);
const pctClass = (p: number) => proba(pct(p));
const barClass = (p: number) => probb(pct(p));
const deltaLabel = (d: number) => fmtsp(Math.round(d * 1000) / 10);
const deltaClass = (d: number) => (d > 0.0005 ? "text-yes" : d < -0.0005 ? "text-no" : "text-text-3");
</script>

<template>
  <NuxtLink
    v-if="!isResolved"
    :to="eventUrl"
    class="group/card flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-[border-color,transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:border-border-2 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
  >
    <div class="flex items-start gap-2.5">
      <div class="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-2">
        <MarketIcon v-if="event.icon || event.image" :src="event.icon || event.image" :alt="event.title || 'Market image'" class="h-full w-full object-cover" />
      </div>
      <div class="min-w-0 flex-1">
        <div v-if="category" class="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-text-3">
          {{ category }}
        </div>
        <h3 class="line-clamp-2 text-[13.5px] font-semibold leading-snug text-white">
          {{ displayTitle }}
        </h3>
      </div>
      <button
        class="-mr-1.5 -mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-md transition-[color,opacity] duration-150 hover:text-white"
        :class="watched ? 'text-white' : 'text-text-3 opacity-0 group-hover/card:opacity-100 pointer-coarse:opacity-100'"
        :aria-label="watched ? 'Remove from watchlist' : 'Add to watchlist'"
        :title="watched ? 'Remove from watchlist' : 'Add to watchlist'"
        @click.prevent.stop="toggleWatch"
      >
        <Icon name="lucide:star" class="h-3.5 w-3.5" :class="watched ? 'fill-current' : ''" />
      </button>
    </div>

    <template v-if="headToHead">
      <div class="flex flex-1 flex-col justify-center gap-2.5 py-0.5">
        <div class="flex items-center gap-2.5">
          <div v-if="headToHead.logoA" class="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-2">
            <MarketIcon :src="headToHead.logoA" :alt="headToHead.teamA" class="h-full w-full object-contain" />
          </div>
          <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">{{ headToHead.teamA }}</span>
          <span class="font-mono shrink-0 text-[15px] font-semibold leading-none" :class="pctClass(headToHead.priceA)"><PercentOdometer :value="pct(headToHead.priceA)" /></span>
        </div>
        <div class="flex items-center gap-2.5">
          <div v-if="headToHead.logoB" class="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-2">
            <MarketIcon :src="headToHead.logoB" :alt="headToHead.teamB" class="h-full w-full object-contain" />
          </div>
          <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-white">{{ headToHead.teamB }}</span>
          <span class="font-mono shrink-0 text-[15px] font-semibold leading-none" :class="pctClass(headToHead.priceB)"><PercentOdometer :value="pct(headToHead.priceB)" /></span>
        </div>
      </div>

      <div class="flex flex-col gap-2 border-t border-border pt-2.5">
        <div v-if="headToHead.drawPrice !== null" class="grid grid-cols-[1fr_auto_1fr] gap-1.5">
          <button class="flex h-9 min-w-0 items-center justify-center rounded-md border border-yes/20 bg-yes-bg px-2 text-xs font-semibold text-yes transition-colors duration-150 hover:bg-yes-hover">
            <span class="truncate" :title="headToHead.teamA">{{ headToHead.teamA }}</span>
          </button>
          <button class="flex h-9 items-center justify-center rounded-md border border-border bg-surface-2 px-3 text-xs font-semibold text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white">DRAW</button>
          <button class="flex h-9 min-w-0 items-center justify-center rounded-md border border-no/15 bg-no-bg px-2 text-xs font-semibold text-no transition-colors duration-150 hover:bg-no-hover">
            <span class="truncate" :title="headToHead.teamB">{{ headToHead.teamB }}</span>
          </button>
        </div>
        <div v-else class="grid grid-cols-2 gap-1.5">
          <button class="font-mono flex h-9 min-w-0 items-center justify-between gap-1.5 rounded-md border border-yes/20 bg-yes-bg px-2.5 text-xs font-semibold text-yes transition-colors duration-150 hover:bg-yes-hover">
            <span class="truncate font-sans" :title="headToHead.teamA">{{ headToHead.teamA }}</span>
            <span class="shrink-0">{{ pct(headToHead.priceA) }}¢</span>
          </button>
          <button class="font-mono flex h-9 min-w-0 items-center justify-between gap-1.5 rounded-md border border-no/15 bg-no-bg px-2.5 text-xs font-semibold text-no transition-colors duration-150 hover:bg-no-hover">
            <span class="truncate font-sans" :title="headToHead.teamB">{{ headToHead.teamB }}</span>
            <span class="shrink-0">{{ pct(headToHead.priceB) }}¢</span>
          </button>
        </div>
        <div class="font-mono flex items-center gap-1.5 text-[10.5px] font-medium text-text-3">
          <span>{{ vol }} Vol</span>
          <template v-if="sportLabel"
            ><span aria-hidden="true">·</span><span>{{ sportLabel }}</span></template
          >
          <template v-if="gameTime"
            ><span aria-hidden="true">·</span><span>{{ gameTime }}</span></template
          >
        </div>
      </div>
    </template>

    <div v-else-if="isBinary && binary" class="flex flex-1 items-center gap-2.5">
      <span class="font-mono min-w-14 shrink-0 text-[22px] font-semibold leading-none" :class="pctClass(binary.yesPrice)">
        <PercentOdometer :value="pct(binary.yesPrice)" />
      </span>
      <div class="flex flex-1 flex-col gap-1">
        <div class="h-0.75 overflow-hidden rounded-sm bg-border-2">
          <div class="h-full rounded-sm transition-[width] duration-300" :class="barClass(binary.yesPrice)" :style="{ width: `${pct(binary.yesPrice)}%` }" />
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-medium text-text-2">chance of {{ binary.yesLabel }}</span>
          <span class="font-mono text-[11px] font-medium" :class="deltaClass(binary.delta)">{{ deltaLabel(binary.delta) }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="isRange && leadingRange" class="flex flex-1 flex-col justify-end gap-2.5">
      <div class="flex items-center gap-2.5">
        <span class="font-mono shrink-0 text-[22px] font-semibold leading-none" :class="pctClass(leadingRange.yesPrice)">
          <PercentOdometer :value="pct(leadingRange.yesPrice)" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="truncate text-[15px] font-semibold leading-tight text-white">{{ formatRangeLabel(leadingRange.title, isCurrencyRange) }}</div>
          <div class="text-[11px] font-medium text-text-2">most likely range</div>
        </div>
      </div>
      <div class="flex h-1.5 w-full gap-px overflow-hidden rounded-sm bg-surface-2" aria-hidden="true">
        <div v-for="bucket in rangeBuckets" :key="bucket.id" class="h-full first:rounded-l-sm last:rounded-r-sm transition-[width] duration-300" :class="bucket.lead ? barClass(leadingRange.yesPrice) : 'bg-border-2'" :style="{ width: `${Math.max(bucket.weight, 1.5)}%` }" />
      </div>
    </div>

    <div v-else class="flex flex-1 flex-col justify-end gap-2">
      <div v-for="item in displayMarkets" :key="item.market.id" class="flex items-center gap-2.5">
        <span class="min-w-0 flex-1 truncate text-[12.5px] font-medium text-text">{{ item.title || item.market.question }}</span>
        <span class="font-mono w-9 shrink-0 text-right text-xs font-semibold" :class="pctClass(item.yesPrice)"><PercentOdometer :value="pct(item.yesPrice)" /></span>
        <div class="w-12 shrink-0 overflow-hidden rounded-sm">
          <div class="h-0.75 bg-border-2">
            <div class="h-full" :class="barClass(item.yesPrice)" :style="{ width: `${pct(item.yesPrice)}%` }" />
          </div>
        </div>
      </div>
      <div v-if="topMarkets.length > displayMarkets.length" class="text-[10.5px] font-medium text-text-3">+{{ topMarkets.length - displayMarkets.length }} more outcomes</div>
    </div>

    <div v-if="!headToHead" class="flex items-center justify-between gap-2 border-t border-border pt-2">
      <div class="flex flex-col">
        <span class="text-[10px] uppercase tracking-wide text-text-3">Volume</span>
        <span class="font-mono text-xs font-medium text-text-2">{{ vol }}</span>
      </div>
      <div v-if="binary" class="flex gap-1.5">
        <button class="font-mono h-7.5 rounded-md border border-yes/20 bg-yes-bg px-3 text-xs font-semibold text-yes transition-colors duration-150 hover:bg-yes-hover pointer-coarse:h-9">YES {{ pct(binary.yesPrice) }}¢</button>
        <button class="font-mono h-7.5 rounded-md border border-no/15 bg-no-bg px-3 text-xs font-semibold text-no transition-colors duration-150 hover:bg-no-hover pointer-coarse:h-9">NO {{ pct(binary.noPrice) }}¢</button>
      </div>
    </div>
  </NuxtLink>
</template>
