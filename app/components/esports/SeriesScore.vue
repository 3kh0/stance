<script setup lang="ts">
import type { GammaEvent } from "~/types/gamma";
import type { SportsMatchup } from "~/composables/useSportsMatchup";
import { buildEsportsSeries } from "~/utils/sports";

const props = defineProps<{
  event: GammaEvent;
  matchup: SportsMatchup;
  bare?: boolean;
}>();

const gridState = useEsportsSeriesState(toRef(props, "event"));
const series = computed(() => buildEsportsSeries(props.event, props.matchup, gridState.value));

const rows = computed(() => {
  const s = series.value;
  if (!s) return [];
  const m = props.matchup;
  return [
    { side: "a" as const, name: m.teamA, abbrev: m.abbrevA, logo: m.logoA, color: m.colorA, won: s.wonA },
    { side: "b" as const, name: m.teamB, abbrev: m.abbrevB, logo: m.logoB, color: m.colorB, won: s.wonB },
  ];
});

const gridStyle = computed(() => (series.value ? { gridTemplateColumns: `minmax(7rem,1fr) repeat(${series.value.bestOf}, 2.25rem)` } : undefined));
</script>

<template>
  <div v-if="series" :class="bare ? 'mt-5 border-t border-border pt-4' : 'pm-spring-in mb-6 overflow-hidden rounded-lg border border-border bg-surface'" :style="bare ? undefined : '--pm-spring-delay: 40ms'">
    <div v-if="!bare" class="flex items-center justify-between border-b border-border px-4 py-2.5">
      <span class="text-[10px] font-bold uppercase tracking-widest text-text-3">Series</span>
      <span class="font-mono text-[10px] font-bold uppercase tracking-widest text-text-3">Best of {{ series.bestOf }}</span>
    </div>

    <div class="overflow-x-auto">
      <div :class="bare ? '' : 'min-w-max px-4 py-3.5'">
        <div class="grid items-center gap-x-2" :style="gridStyle">
          <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">{{ bare ? `Best of ${series.bestOf}` : "" }}</div>
          <div v-for="m in series.maps" :key="`h-${m.map}`" class="text-center" :class="m.live ? 'text-no' : 'text-text-3'">
            <span class="font-mono inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider">
              <span v-if="m.live" class="relative flex h-1 w-1">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-no opacity-75" />
                <span class="relative inline-flex h-1 w-1 rounded-full bg-no" />
              </span>
              M{{ m.map }}
            </span>
          </div>
        </div>

        <div v-for="row in rows" :key="row.side" class="mt-3 grid items-center gap-x-2" :style="gridStyle">
          <div class="flex min-w-0 items-center gap-2">
            <div v-if="row.logo" class="grid h-6 w-6 shrink-0 place-items-center overflow-hidden">
              <MarketIcon :src="row.logo" :alt="row.name" class="h-full w-full object-contain" />
            </div>
            <div v-else class="grid h-6 w-6 shrink-0 place-items-center rounded border border-border bg-surface-2 text-[9px] font-bold text-text-3">{{ row.abbrev }}</div>
            <span class="truncate text-[13px] font-semibold text-white">{{ row.name }}</span>
            <span v-if="!bare && (series.wonA || series.wonB)" class="font-mono ml-1 shrink-0 text-[13px] font-bold tabular-nums" :class="row.won >= (row.side === 'a' ? series.wonB : series.wonA) && row.won > 0 ? 'text-white' : 'text-text-3'">{{ row.won }}</span>
          </div>
          <div v-for="m in series.maps" :key="`${row.side}-${m.map}`" class="grid place-items-center">
            <span v-if="series.hasRounds && (row.side === 'a' ? m.scoreA : m.scoreB) !== undefined" class="font-mono text-[13px] font-bold leading-none tabular-nums" :class="m.winner ? (m.winner === row.side ? 'text-white' : 'text-text-3') : 'text-text'">{{ row.side === "a" ? m.scoreA : m.scoreB }}</span>
            <Icon v-else-if="m.winner === row.side" name="lucide:check" class="h-3.5 w-3.5" :class="row.color ? '' : 'text-yes'" :style="row.color ? { color: row.color } : undefined" />
            <span v-else class="font-mono text-[13px] leading-none text-text-3">–</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
