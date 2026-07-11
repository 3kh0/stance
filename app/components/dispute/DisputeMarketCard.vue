<script setup lang="ts">
import type { DisputeMarket, DisputeStage } from "~/types/markets";
import { disputeStageLabel } from "~/types/markets";
import { fmtcp, fmtv } from "~/utils/prices";
import { formatRelativeTime } from "~/utils/markets";

const props = defineProps<{
  market: DisputeMarket;
  selected?: boolean;
  now: number;
}>();

const emit = defineEmits<{ select: [market: DisputeMarket] }>();

const eventUrl = computed(() => (props.market.slug ? `/event/${props.market.slug}?x=${props.market.id}` : null));
const yesLabel = computed(() => props.market.outcomes[0] ?? "Yes");
const noLabel = computed(() => props.market.outcomes[1] ?? "No");
const updatedLabel = computed(() => {
  const timestamp = Date.parse(props.market.updatedAt ?? props.market.closedTime ?? props.market.endDate ?? "");
  return Number.isFinite(timestamp) ? formatRelativeTime(timestamp, props.now) : "recently";
});

const countdownLabel = computed(() => {
  if (!props.market.countdownTarget) return null;
  const target = Date.parse(props.market.countdownTarget);
  if (!Number.isFinite(target)) return null;
  const diff = target - props.now;
  if (diff <= 0) return "due now";
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${Math.max(minutes, 1)}m`;
});

const STAGE_CLS: Record<string, string> = {
  disputed: "border-no/20 bg-no-bg text-no",
  voting: "border-no/20 bg-no-bg text-no",
  resolved: "border-yes/20 bg-yes-bg text-yes",
  settled: "border-yes/20 bg-yes-bg text-yes",
};
const pillClass = (s: DisputeStage) => STAGE_CLS[s] ?? "border-border bg-surface-2 text-text-2";
</script>

<template>
  <article
    role="button"
    tabindex="0"
    class="pm-focus group/card flex w-full flex-col gap-3 rounded-xl border bg-surface p-4 text-left transition-[border-color,transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:border-border-2 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] motion-reduce:hover:translate-y-0"
    :class="selected ? 'border-border-2' : 'border-border'"
    @click="emit('select', market)"
    @keydown.enter.prevent="emit('select', market)"
    @keydown.space.prevent="emit('select', market)"
  >
    <div class="flex items-start gap-2.5">
      <div class="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-2">
        <MarketIcon v-if="market.image" :src="market.image" :alt="market.question" class="h-full w-full object-cover" />
        <Icon v-else name="lucide:gavel" class="h-4.5 w-4.5 text-text-3" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="mb-1 flex min-w-0 items-center gap-2">
          <span class="inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[10px] font-bold uppercase tracking-widest" :class="pillClass(market.stage)">
            {{ disputeStageLabel(market.stage) }}
          </span>
          <span class="truncate font-mono text-[10.5px] font-medium text-text-3">{{ updatedLabel }}</span>
        </div>
        <h2 class="line-clamp-2 text-[13.5px] font-semibold leading-snug text-white">
          {{ market.question }}
        </h2>
      </div>
      <NuxtLink v-if="eventUrl" :to="eventUrl" class="-mr-1.5 -mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-3 opacity-0 transition-[color,opacity] duration-150 hover:text-white group-hover/card:opacity-100 pointer-coarse:opacity-100" aria-label="Open market" @click.stop>
        <Icon name="lucide:external-link" class="h-3.5 w-3.5" />
      </NuxtLink>
    </div>
    <div class="grid grid-cols-2 gap-1.5">
      <div class="rounded-lg border border-yes/20 bg-yes-bg px-2.5 py-2">
        <div class="truncate text-[10px] font-bold uppercase tracking-widest text-yes">{{ yesLabel }}</div>
        <div class="font-mono mt-1 text-[18px] font-semibold leading-none text-yes tabular-nums">
          <PercentOdometer :value="Math.round(market.yesPrice * 100)" />
        </div>
      </div>
      <div class="rounded-lg border border-no/15 bg-no-bg px-2.5 py-2">
        <div class="truncate text-[10px] font-bold uppercase tracking-widest text-no">{{ noLabel }}</div>
        <div class="font-mono mt-1 text-[18px] font-semibold leading-none text-no tabular-nums">
          <PercentOdometer :value="Math.round(market.noPrice * 100)" />
        </div>
      </div>
    </div>
    <div class="flex items-center justify-between gap-3 border-t border-border pt-2">
      <div>
        <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Volume</div>
        <div class="font-mono text-xs font-medium text-text-2 tabular-nums">{{ fmtv(market.volume) }}</div>
      </div>
      <div class="text-right">
        <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">{{ countdownLabel ? "Deadline" : "Status" }}</div>
        <div class="font-mono text-xs font-semibold tabular-nums" :class="countdownLabel ? 'text-white' : 'text-text-2'">{{ countdownLabel ?? fmtcp(market.yesPrice) }}</div>
      </div>
    </div>
  </article>
</template>
