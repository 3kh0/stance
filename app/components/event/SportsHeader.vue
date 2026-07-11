<script setup lang="ts">
import type { Outcome } from "~/types/account";
import type { GammaEvent } from "~/types/gamma";
import type { SportsMatchup } from "~/composables/useSportsMatchup";

const props = defineProps<{
  event: GammaEvent;
  eventTags: string[];
  matchup: SportsMatchup;
  watched: boolean;
  isRefreshing: boolean;
  embedActive?: boolean;
}>();

const emit = defineEmits<{
  "toggle-watch": [];
  refresh: [];
  "select-outcome": [marketId: string, outcome: Outcome];
}>();

const mounted = ref(false);
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  mounted.value = true;
  timer = setInterval(() => (now.value = Date.now()), 1000);
});
onUnmounted(() => timer && clearInterval(timer));

const startMs = computed(() => {
  const raw = props.matchup.startTime || props.event.startTime;
  if (!raw) return null;
  const ms = Date.parse(raw.replace(" ", "T").replace(/\+00$/, "Z"));
  return Number.isFinite(ms) ? ms : null;
});

const upcoming = computed(() => startMs.value !== null && startMs.value - now.value > 0);

const countdown = computed(() => {
  if (!mounted.value || startMs.value === null) return "";
  const diff = startMs.value - now.value;
  if (diff <= 0) return "";
  const t = Math.floor(diff / 1000),
    h = Math.floor(t / 3600),
    m = Math.floor((t % 3600) / 60),
    s = t % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
});

const matchTime = computed(() => {
  if (!mounted.value || startMs.value === null) return "";
  const d = new Date(startMs.value);
  return `${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ${d.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
});

const scoreNumA = computed(() => Number.parseFloat(props.matchup.scoreA ?? ""));
const scoreNumB = computed(() => Number.parseFloat(props.matchup.scoreB ?? ""));
const scoresComparable = computed(() => Number.isFinite(scoreNumA.value) && Number.isFinite(scoreNumB.value) && scoreNumA.value !== scoreNumB.value);

function scoreClass(side: "a" | "b") {
  if (!props.matchup.ended || !scoresComparable.value) return "text-white";
  const leads = side === "a" ? scoreNumA.value > scoreNumB.value : scoreNumB.value > scoreNumA.value;
  return leads ? "text-white" : "text-text-3";
}

function setCellClass(side: "a" | "b", index: number) {
  const a = Number.parseFloat(props.matchup.setsA?.[index]?.games ?? "");
  const b = Number.parseFloat(props.matchup.setsB?.[index]?.games ?? "");
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return "text-white";
  return (side === "a" ? a > b : b > a) ? "text-white" : "text-text-3";
}
</script>

<template>
  <div class="pm-spring-in mb-6 overflow-hidden" style="--pm-spring-delay: 0ms">
    <div class="flex items-center justify-between gap-3 px-4 py-3">
      <div v-if="eventTags.length > 0" class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-text-3">
        <template v-for="(tag, i) in eventTags" :key="tag">
          <span v-if="i > 0">·</span>
          <span>{{ tag }}</span>
        </template>
      </div>
      <div class="ml-auto flex items-center gap-1.5">
        <button class="pm-focus flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition-colors duration-150" :class="watched ? 'border-white text-white' : 'border-border text-text-2 hover:border-border-2 hover:text-white'" @click="emit('toggle-watch')">
          <Icon name="lucide:star" class="h-3 w-3" :class="watched ? 'fill-current' : ''" />
          {{ watched ? "Watching" : "Watchlist" }}
        </button>
        <button class="pm-focus grid h-7 w-7 place-items-center rounded-md border border-border text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" :class="{ 'animate-spin': isRefreshing }" :disabled="isRefreshing" title="Refresh odds" @click="emit('refresh')">
          <Icon name="lucide:refresh-cw" class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <div class="px-4 pt-5 pb-4">
      <h1 class="text-center text-xl font-bold text-white">{{ matchup.teamA }} vs {{ matchup.teamB }}</h1>
      <div v-if="upcoming && !embedActive" class="mt-2 flex h-4.5 items-center justify-center text-[12px] text-text-2">
        <span v-if="countdown" class="inline-flex cursor-default items-center gap-1.5" :title="matchTime">
          <Icon name="lucide:timer" class="h-3.5 w-3.5" />
          <span class="font-mono font-medium text-text">{{ countdown }}</span>
        </span>
      </div>

      <div v-if="!embedActive" class="mt-6 grid grid-cols-[1fr_auto_1fr] items-end gap-4">
        <div class="flex flex-col items-center gap-2">
          <div v-if="matchup.logoA" class="grid h-14 w-14 place-items-center overflow-hidden">
            <MarketIcon :src="matchup.logoA" :alt="matchup.teamA" class="h-full w-full object-contain p-1.5" />
          </div>
          <div v-else class="grid h-14 w-14 place-items-center rounded-lg border border-border bg-surface-2 text-[11px] font-bold text-text-3">{{ matchup.abbrevA }}</div>
          <span class="text-[13px] font-semibold text-white">{{ matchup.teamA }}</span>
          <span v-if="matchup.recordA" class="font-mono text-[10.5px] font-semibold text-text-3">{{ matchup.recordA }}</span>
        </div>

        <div class="pb-1 text-center">
          <div class="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-bold tracking-[-0.3px] text-white">
            <StanceLogo :size="16" />
            <span>Stance</span>
          </div>
          <div v-if="(matchup.live || matchup.ended) && matchup.setsA?.length" class="font-mono mb-1.5 flex items-start justify-center gap-3 text-3xl font-bold leading-none tabular-nums">
            <div v-for="(set, i) in matchup.setsA" :key="i" class="flex flex-col items-center gap-1.5">
              <span :class="setCellClass('a', i)"
                >{{ set.games }}<sup v-if="set.tiebreak" class="ml-0.5 align-super text-[0.45em] font-semibold text-text-3">{{ set.tiebreak }}</sup></span
              >
              <span :class="setCellClass('b', i)"
                >{{ matchup.setsB?.[i]?.games }}<sup v-if="matchup.setsB?.[i]?.tiebreak" class="ml-0.5 align-super text-[0.45em] font-semibold text-text-3">{{ matchup.setsB?.[i]?.tiebreak }}</sup></span
              >
            </div>
          </div>
          <div v-else-if="(matchup.live || matchup.ended) && (matchup.scoreA || matchup.scoreB)" class="font-mono mb-1.5 text-3xl font-bold leading-none tabular-nums">
            <span :class="scoreClass('a')">{{ matchup.scoreA ?? "0" }}</span>
            <span class="mx-2 text-text-3">-</span>
            <span :class="scoreClass('b')">{{ matchup.scoreB ?? "0" }}</span>
          </div>
          <div v-if="matchup.ended" class="font-mono text-[10px] font-bold uppercase tracking-widest text-text-3">Final</div>
          <div v-else-if="matchup.live && matchup.period" class="font-mono inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-no">
            <span class="relative flex h-1.5 w-1.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-no opacity-75" />
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-no" />
            </span>
            {{ matchup.period }}
          </div>
        </div>

        <div class="flex flex-col items-center gap-2">
          <div v-if="matchup.logoB" class="grid h-14 w-14 place-items-center overflow-hidden">
            <MarketIcon :src="matchup.logoB" :alt="matchup.teamB" class="h-full w-full object-contain p-1.5" />
          </div>
          <div v-else class="grid h-14 w-14 place-items-center rounded-lg border border-border bg-surface-2 text-[11px] font-bold text-text-3">{{ matchup.abbrevB }}</div>
          <span class="text-[13px] font-semibold text-white">{{ matchup.teamB }}</span>
          <span v-if="matchup.recordB" class="font-mono text-[10.5px] font-semibold text-text-3">{{ matchup.recordB }}</span>
        </div>
      </div>

      <EsportsSeriesScore bare :event="event" :matchup="matchup" />
    </div>
  </div>
</template>
