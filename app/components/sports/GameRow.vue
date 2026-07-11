<script setup lang="ts">
import type { Outcome } from "~/types/account";
import EventSportsLineSlider from "~/components/event/SportsLineSlider.vue";
import type { OrderbookLevel } from "~/types/gamma";
import type { BookLevelSelection } from "~/utils/markets";
import type { SportsGame, SportsLineOption, SportsOdds } from "~/utils/sports";
import { fmtcn } from "~/utils/prices";

const props = defineProps<{
  game: SportsGame;
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
}>();

const emit = defineEmits<{
  "select-odds": [odds: SportsOdds];
  "toggle-book": [];
  "level-click": [payload: { side: BookLevelSelection["side"]; level: OrderbookLevel }];
  "refresh-book": [];
}>();

const volLabel = computed(() => `$${fmtcn(props.game.volume)} Vol`);

const startLabel = computed(() => {
  const ms = props.game.startMs;
  if (ms === null) return "";
  const d = new Date(ms);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((dayStart(d) - dayStart(new Date(props.now))) / 86_400_000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
});

const isSelected = (odds: SportsOdds | null) => Boolean(odds?.market && odds.market.id === props.selectedMarketId && odds.outcome === props.selectedOutcome);

const selectedLineKind = computed<"spread" | "total" | null>(() => {
  if (props.game.spreadOptions.some((o) => o.teams.some(isSelected))) return "spread";
  if (props.game.totalOptions.some((o) => o.teams.some(isSelected))) return "total";
  return null;
});

function activeOption(options: SportsLineOption[], fallback: SportsOdds | null): SportsLineOption | null {
  if (!options.length) return null;
  const selected = options.find((o) => o.teams.some(isSelected));
  if (selected) return selected;
  const fid = fallback?.market?.id;
  return options.find((o) => o.teams[0].market!.id === fid) ?? options[0]!;
}

const activeSpread = computed(() => activeOption(props.game.spreadOptions, props.game.teams[0].spread));
const activeTotal = computed(() => activeOption(props.game.totalOptions, props.game.teams[0].total));

const teamRows = computed(() =>
  props.game.teams.map((team, i) => ({
    team,
    color: team.color ?? null,
    ml: team.moneyline,
    sp: activeSpread.value?.teams[i] ?? team.spread,
    tot: activeTotal.value?.teams[i] ?? team.total,
  })),
);

const sliderOptions = computed(() => (selectedLineKind.value === "spread" ? props.game.spreadOptions : selectedLineKind.value === "total" ? props.game.totalOptions : []));
const sliderLines = computed(() => sliderOptions.value.map((o) => o.line));
const activeLine = computed(() => sliderOptions.value.find((o) => o.teams.some(isSelected))?.line ?? null);

function selectLine(line: number) {
  const option = sliderOptions.value.find((o) => o.line === line);
  if (!option) return;
  emit("select-odds", option.teams.find((o) => o.outcome === props.selectedOutcome) ?? option.teams[0]);
}
</script>

<template>
  <NuxtLink :to="game.url" class="rounded-xl border bg-surface transition-colors duration-150" :class="expanded ? 'border-border-2' : 'border-border hover:border-border-2'">
    <div class="px-3.5 py-3">
      <div class="mb-2.5 flex items-center gap-2 text-[11px]">
        <span v-if="live" class="inline-flex items-center gap-1.5 font-semibold uppercase text-no">
          <span class="relative flex h-1.5 w-1.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-no opacity-75" />
            <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-no" />
          </span>
          {{ game.period || "Live" }}
        </span>
        <span v-else-if="startLabel" class="font-medium text-text-2">{{ startLabel }}</span>
        <span v-if="game.tournament" class="min-w-0 truncate font-medium text-text-3">{{ game.tournament }}</span>
        <span class="font-mono shrink-0 text-text-3">{{ volLabel }}</span>
        <button
          type="button"
          class="pm-focus ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-semibold transition-colors duration-150"
          :class="expanded ? 'border-border-2 bg-surface-2 text-white' : 'border-border text-text-2 hover:border-border-2 hover:text-white'"
          @click.prevent.stop="emit('toggle-book')"
        >
          <Icon name="lucide:book-open" class="h-3 w-3" />
          <span class="max-sm:hidden">Order Book</span>
        </button>
      </div>
      <div class="flex flex-col gap-1.5">
        <div v-for="({ team, color, ml, sp, tot }, i) in teamRows" :key="i" class="flex items-center gap-2.5">
          <div v-if="live" class="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-surface-2 font-mono text-[12px] font-bold tabular-nums text-white">
            <span v-if="team.score" class="truncate px-0.5 text-[11px]">{{ team.score }}</span>
            <span v-else class="text-text-3">0</span>
          </div>
          <div class="grid h-7 w-7 shrink-0 place-items-center overflow-hidden">
            <MarketIcon v-if="team.logo" :src="team.logo" :alt="team.name" class="h-full w-full object-contain p-0.5" />
            <span v-else class="text-[9px] font-bold text-text-3">{{ team.abbrev }}</span>
          </div>
          <div class="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span class="truncate text-[13px] font-semibold text-white">{{ team.name }}</span>
            <span v-if="team.record" class="font-mono shrink-0 text-[10.5px] text-text-3">{{ team.record }}</span>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <div class="w-22">
              <SportsOddsButton :odds="ml" :color="color" :selected="isSelected(ml)" @select="ml && emit('select-odds', ml)" />
            </div>
            <div class="hidden w-30 sm:block">
              <SportsOddsButton :odds="sp" :color="color" :selected="isSelected(sp)" @select="sp && emit('select-odds', sp)" />
            </div>
            <div class="hidden w-22 md:block">
              <SportsOddsButton :odds="tot" :selected="isSelected(tot)" @select="tot && emit('select-odds', tot)" />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="sliderLines.length > 1" class="border-t border-border" @click.prevent.stop>
      <EventSportsLineSlider :lines="sliderLines" :active-line="activeLine" @select="selectLine" />
    </div>
    <Transition name="sports-book">
      <div v-if="expanded" class="border-t border-border px-3.5 pb-2" @click.stop>
        <EventMarketOrderbook
          :loading="bookLoading"
          :error="bookError"
          :has-liquidity="hasBookLiquidity"
          :asks="asks"
          :bids="bids"
          :is-single-market="false"
          :selected-outcome="selectedOutcome"
          :outcome-labels="outcomeLabels"
          :selected-outcome-label="selectedOutcomeLabel"
          :spread="bookSpread"
          :last-price="lastBookPrice"
          :user-orders="[]"
          :active="expanded"
          @level-click="emit('level-click', $event)"
          @refresh="emit('refresh-book')"
        />
      </div>
    </Transition>
  </NuxtLink>
</template>

<style scoped>
.sports-book-enter-active,
.sports-book-leave-active {
  overflow: hidden;
  transition:
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.sports-book-enter-from,
.sports-book-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.sports-book-enter-to,
.sports-book-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
