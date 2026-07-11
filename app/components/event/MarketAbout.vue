<script setup lang="ts">
import type { GammaMarket } from "~/types/gamma";

const props = defineProps<{
  market: GammaMarket;
  resolutionSource?: string;
}>();

const expanded = ref(false);
const rules = computed(() => (props.market.description ?? "").trim());
const isLong = computed(() => rules.value.length > 320);
const sourceUrl = computed(() => props.market.resolutionSource?.trim() || props.resolutionSource?.trim() || "");
const sourceLabel = computed(() => {
  if (!sourceUrl.value) return "";
  try {
    const u = new URL(sourceUrl.value);
    return u.host.replace(/^www\./, "") + u.pathname.replace(/\/$/, "");
  } catch {
    return sourceUrl.value;
  }
});

const resolver = computed(() => props.market.resolvedBy?.trim() || "");
const resolverShort = computed(() => (resolver.value ? `${resolver.value.slice(0, 8)}…` : ""));
const resolverUrl = computed(() => (resolver.value ? `https://polygonscan.com/address/${resolver.value}` : ""));

function fmtDate(iso: string | undefined, withTime: boolean): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET`;
}

const endDate = computed(() => fmtDate(props.market.endDate, false));
const openedDate = computed(() => fmtDate(props.market.startDate, true));
</script>

<template>
  <div class="flex flex-col gap-6 text-[12.5px] leading-relaxed">
    <section v-if="rules">
      <h3 class="mb-2 text-[13px] font-bold text-white">Rules</h3>
      <p class="whitespace-pre-line text-text-2" :class="{ 'line-clamp-4': isLong && !expanded }">{{ rules }}</p>
      <button v-if="isLong" class="pm-focus mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-text-3 transition-colors duration-150 hover:text-white" @click="expanded = !expanded">
        {{ expanded ? "See less" : "See more" }}
        <Icon :name="expanded ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="h-3.5 w-3.5" />
      </button>
    </section>

    <dl v-if="endDate || openedDate" class="flex flex-col gap-1.5">
      <div v-if="endDate" class="flex items-baseline gap-2">
        <dt class="font-bold text-white">End Date:</dt>
        <dd class="font-mono tabular-nums text-text-2">{{ endDate }}</dd>
      </div>
      <div v-if="openedDate" class="flex items-baseline gap-2">
        <dt class="font-bold text-white">Market Opened:</dt>
        <dd class="font-mono tabular-nums text-text-2">{{ openedDate }}</dd>
      </div>
    </dl>

    <section v-if="sourceUrl || resolver">
      <h3 class="mb-2 text-[13px] font-bold text-white">Sources</h3>
      <div class="grid gap-2 sm:grid-cols-2">
        <a v-if="sourceUrl" :href="sourceUrl" target="_blank" rel="noopener noreferrer" class="pm-focus group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-border-hover">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg text-text-3 transition-colors duration-150 group-hover:text-white">
            <Icon name="lucide:link" class="h-4 w-4" />
          </span>
          <span class="min-w-0">
            <span class="block text-[11px] text-text-3">Resolution Source</span>
            <span class="block truncate text-[12.5px] text-yes">{{ sourceLabel }}</span>
          </span>
        </a>
        <a v-if="resolver" :href="resolverUrl" target="_blank" rel="noopener noreferrer" class="pm-focus group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-border-hover">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg text-[9px] font-black tracking-tight text-no">UMA</span>
          <span class="min-w-0">
            <span class="block text-[11px] text-text-3">Resolver</span>
            <span class="font-mono block truncate text-[12.5px] text-yes">{{ resolverShort }}</span>
          </span>
        </a>
      </div>
    </section>
  </div>
</template>
