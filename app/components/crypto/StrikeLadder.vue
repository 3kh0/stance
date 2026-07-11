<script setup lang="ts">
import type { StrikeLadder } from "~/utils/cryptoTaxonomy";
import { probb, proba } from "~/utils/prices";

const props = defineProps<{
  ladder: StrikeLadder;
}>();

const event = computed(() => props.ladder.event);
const eventUrl = computed(() => `/event/${event.value.slug ?? event.value.id}?x=${event.value.id}`);

const leading = computed(() => props.ladder.rows.reduce<(typeof props.ladder.rows)[number] | null>((best, r) => (best === null || r.yesPct > best.yesPct ? r : best), null));

const buckets = computed(() => {
  const total = props.ladder.rows.reduce((s, r) => s + Math.max(r.yesPct, 0), 0) || 1;
  return [...props.ladder.rows].sort((a, b) => a.sortValue - b.sortValue).map((r) => ({ id: r.market.id, weight: (Math.max(r.yesPct, 0) / total) * 100, lead: r.market.id === leading.value?.market.id }));
});

const MAX_ROWS = 7;
const visibleRows = computed(() => {
  const rows = props.ladder.rows;
  return rows.length <= MAX_ROWS
    ? rows
    : [...rows]
        .sort((a, b) => Math.abs(a.yesPct - 50) - Math.abs(b.yesPct - 50))
        .slice(0, MAX_ROWS)
        .sort((a, b) => a.sortValue - b.sortValue);
});
const hiddenCount = computed(() => props.ladder.rows.length - visibleRows.value.length);

const pctClass = proba;
const barClass = probb;
</script>

<template>
  <NuxtLink
    :to="eventUrl"
    class="group/ladder flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-[border-color,transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:border-border-2 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
  >
    <div class="flex items-start gap-2.5">
      <div class="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-2">
        <MarketIcon v-if="event.icon || event.image" :src="event.icon || event.image" :alt="ladder.title" class="h-full w-full object-cover" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-text-3">{{ ladder.horizon.label }}</div>
        <h3 class="line-clamp-2 text-[13.5px] font-semibold leading-snug text-white">{{ ladder.title }}</h3>
      </div>
    </div>

    <div v-if="ladder.distribution && leading" class="flex flex-col gap-2.5">
      <div class="flex items-center gap-2.5">
        <span class="font-mono shrink-0 text-[22px] font-semibold leading-none" :class="pctClass(leading.yesPct)">
          <PercentOdometer :value="leading.yesPct" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="truncate text-[15px] font-semibold leading-tight text-white">{{ leading.label }}</div>
          <div class="text-[11px] font-medium text-text-2">most likely range</div>
        </div>
      </div>
      <div class="flex h-1.5 w-full gap-px overflow-hidden rounded-sm bg-surface-2" aria-hidden="true">
        <div v-for="bucket in buckets" :key="bucket.id" class="h-full first:rounded-l-sm last:rounded-r-sm transition-[width] duration-300" :class="bucket.lead ? barClass(leading.yesPct) : 'bg-border-2'" :style="{ width: `${Math.max(bucket.weight, 1.5)}%` }" />
      </div>
    </div>

    <template v-else>
      <div class="flex flex-col gap-1.5">
        <div v-for="row in visibleRows" :key="row.market.id" class="flex items-center gap-2.5">
          <span class="font-mono w-16 shrink-0 text-[12.5px] font-semibold tabular-nums text-text-2">{{ row.label }}</span>
          <div class="h-1 flex-1 overflow-hidden rounded-sm bg-border-2">
            <div class="h-full rounded-sm transition-[width] duration-300" :class="barClass(row.yesPct)" :style="{ width: `${row.yesPct}%` }" />
          </div>
          <span class="font-mono w-9 shrink-0 text-right text-xs font-semibold tabular-nums" :class="pctClass(row.yesPct)">
            <PercentOdometer :value="row.yesPct" />
          </span>
        </div>
      </div>
      <div v-if="hiddenCount > 0" class="text-[10.5px] font-medium text-text-3 transition-colors group-hover/ladder:text-text-2">+{{ hiddenCount }} more strikes →</div>
    </template>
  </NuxtLink>
</template>
