<script setup lang="ts">
import type { DisputeMarket, DisputeStage } from "~/types/markets";
import { disputeStageLabel } from "~/types/markets";
import { fmtcp, fmtv } from "~/utils/prices";
import { formatRelativeTime } from "~/utils/markets";

const props = defineProps<{
  market: DisputeMarket;
  now: number;
}>();

const eventUrl = computed(() => (props.market.slug ? `/event/${props.market.slug}?x=${props.market.id}` : null));
const resolverUrl = computed(() => (props.market.resolvedBy ? `https://polygonscan.com/address/${props.market.resolvedBy}` : null));
const conditionUrl = computed(() => (props.market.conditionId ? `https://polygonscan.com/search?f=0&q=${encodeURIComponent(props.market.conditionId)}` : null));
const yesLabel = computed(() => props.market.outcomes[0] ?? "Yes");
const noLabel = computed(() => props.market.outcomes[1] ?? "No");

const deadlineLabel = computed(() => {
  if (!props.market.countdownTarget) return null;
  const target = Date.parse(props.market.countdownTarget);
  if (!Number.isFinite(target)) return null;
  const diff = target - props.now;
  if (diff <= 0) return "Deadline reached";
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h remaining`;
  if (hours > 0) return `${hours}h ${minutes % 60}m remaining`;
  return `${Math.max(minutes, 1)}m remaining`;
});

const entryTimeLabel = (at: string | null) => {
  const t = Date.parse(at ?? "");
  return Number.isFinite(t) ? formatRelativeTime(t, props.now) : "time unavailable";
};
const shortAddress = (a: string | null) => (!a ? "Not exposed by Gamma" : a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a);

const STAGE_CLS: Record<string, string> = {
  disputed: "border-no/20 bg-no-bg text-no",
  voting: "border-no/20 bg-no-bg text-no",
  resolved: "border-yes/20 bg-yes-bg text-yes",
  settled: "border-yes/20 bg-yes-bg text-yes",
};
const stageClass = (s: DisputeStage) => STAGE_CLS[s] ?? "border-border bg-surface-2 text-text-2";

const NEXT: Record<DisputeStage, string> = {
  clarification: "Resolution context is being clarified before or during the UMA request.",
  proposed: "If the proposal is not disputed before the deadline, UMA can resolve this market.",
  disputed: "The first dispute usually resets the request; a later dispute can escalate to UMA DVM voting.",
  reproposed: "A new proposal is live. If it is disputed again, the question can move to UMA DVM voting.",
  voting: "UMA token holders vote on the answer, then the market can move to final resolution.",
  resolved: "The final answer is available. Settlement and redemption are the remaining steps.",
  settled: "The market has finished the UMA settlement path.",
};
const nextSteps = (s: DisputeStage) => NEXT[s];
</script>

<template>
  <section class="flex min-h-0 flex-col rounded-xl border border-border bg-surface">
    <div class="border-b border-border p-4">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <span class="inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-bold uppercase tracking-widest" :class="stageClass(market.stage)">
              {{ disputeStageLabel(market.stage) }}
            </span>
            <span v-if="deadlineLabel" class="font-mono text-[11px] font-semibold text-white tabular-nums">{{ deadlineLabel }}</span>
          </div>
          <h2 class="text-[15px] font-semibold leading-snug text-white">
            {{ market.question }}
          </h2>
        </div>
        <NuxtLink v-if="eventUrl" :to="eventUrl" class="pm-focus grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-bg text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" aria-label="Open market">
          <Icon name="lucide:external-link" class="h-4 w-4" />
        </NuxtLink>
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="rounded-lg border border-border bg-bg px-3 py-2">
          <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Current</div>
          <div class="font-mono mt-1 text-sm font-semibold text-white tabular-nums">{{ fmtcp(market.yesPrice) }}</div>
        </div>
        <div class="rounded-lg border border-border bg-bg px-3 py-2">
          <div class="truncate text-[10px] font-bold uppercase tracking-widest text-yes">{{ yesLabel }}</div>
          <div class="font-mono mt-1 text-sm font-semibold text-yes tabular-nums">{{ fmtcp(market.yesPrice) }}</div>
        </div>
        <div class="rounded-lg border border-border bg-bg px-3 py-2">
          <div class="truncate text-[10px] font-bold uppercase tracking-widest text-no">{{ noLabel }}</div>
          <div class="font-mono mt-1 text-sm font-semibold text-no tabular-nums">{{ fmtcp(market.noPrice) }}</div>
        </div>
        <div class="rounded-lg border border-border bg-bg px-3 py-2">
          <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Volume</div>
          <div class="font-mono mt-1 text-sm font-semibold text-text-2 tabular-nums">{{ fmtv(market.volume) }}</div>
        </div>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <a href="https://oracle.uma.xyz/" target="_blank" rel="noreferrer" class="pm-focus inline-flex h-8 items-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white">
          <Icon name="lucide:scale" class="h-3.5 w-3.5" />
          UMA Oracle
        </a>
        <a v-if="resolverUrl" :href="resolverUrl" target="_blank" rel="noreferrer" class="pm-focus inline-flex h-8 items-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white">
          <Icon name="lucide:scan-line" class="h-3.5 w-3.5" />
          Resolver
        </a>
        <a v-if="conditionUrl" :href="conditionUrl" target="_blank" rel="noreferrer" class="pm-focus inline-flex h-8 items-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white">
          <Icon name="lucide:box" class="h-3.5 w-3.5" />
          Condition
        </a>
      </div>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-[11px] font-bold uppercase tracking-widest text-text-3">Audit Log</h3>
        <span class="text-[11px] text-text-3">Gamma-derived v1</span>
      </div>
      <ol class="space-y-2">
        <li v-for="(entry, index) in market.timeline" :key="entry.id" class="grid grid-cols-[28px_1fr] gap-3 rounded-lg border border-border bg-bg p-3">
          <div class="font-mono grid h-7 w-7 place-items-center rounded-full border border-border bg-surface-2 text-[11px] font-semibold text-text-2 tabular-nums">{{ market.timeline.length - index }}</div>
          <div class="min-w-0">
            <div class="mb-1 flex flex-wrap items-center gap-2">
              <span class="text-[13px] font-semibold text-white">{{ entry.label }}</span>
              <span class="font-mono text-[10.5px] font-medium text-text-3 tabular-nums">{{ entryTimeLabel(entry.occurredAt) }}</span>
            </div>
            <p class="text-xs leading-4 text-text-2">{{ entry.description }}</p>
            <div class="mt-2 grid gap-1 text-[11px] leading-4 text-text-3 sm:grid-cols-2">
              <div v-if="entry.outcome">
                Outcome: <span class="text-text-2">{{ entry.outcome }}</span>
              </div>
              <div>
                Actor: <span class="font-mono text-text-2">{{ shortAddress(entry.actor) }}</span>
              </div>
              <div v-if="entry.bond">
                Bond: <span class="font-mono text-text-2 tabular-nums">{{ entry.bond }} USDC</span>
              </div>
              <div v-if="entry.reward">
                Reward: <span class="font-mono text-text-2 tabular-nums">{{ entry.reward }} USDC</span>
              </div>
            </div>
            <a v-if="entry.txUrl" :href="entry.txUrl" target="_blank" rel="noreferrer" class="pm-focus mt-2 inline-flex items-center gap-1 text-xs font-semibold text-text-2 hover:text-white">
              Polygonscan tx
              <Icon name="lucide:external-link" class="h-3 w-3" />
            </a>
          </div>
        </li>
      </ol>
      <div class="mt-4 rounded-lg border border-border bg-bg p-3">
        <div class="mb-1 text-[10px] font-bold uppercase tracking-widest text-text-3">Next Steps</div>
        <p class="text-xs leading-5 text-text-2">{{ nextSteps(market.stage) }}</p>
      </div>
    </div>
  </section>
</template>
