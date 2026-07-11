<script setup lang="ts">
import type { GammaEvent } from "~/types/gamma";
import { fmtn } from "~/utils/prices";

defineProps<{
  event: GammaEvent;
  eventTags: string[];
  isSingleMarket: boolean;
  isFullyResolved: boolean;
  singleMarketChance: number;
  watched: boolean;
  isRefreshing: boolean;
}>();

const emit = defineEmits<{
  "toggle-watch": [];
  refresh: [];
}>();

const chancePctClass = (pct: number) => (pct >= 55 ? "text-yes" : pct <= 45 ? "text-no" : "text-text");
</script>

<template>
  <div class="pm-spring-in mb-6 flex items-start gap-3.5" style="--pm-spring-delay: 0ms">
    <MarketIcon :src="event.icon" :alt="event.title" class="h-12 w-12 shrink-0 rounded-lg border border-border bg-surface-2 object-cover" />
    <div class="min-w-0 flex-1">
      <div v-if="eventTags.length > 0" class="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-text-3">
        <template v-for="(tag, i) in eventTags" :key="tag">
          <span v-if="i > 0">·</span>
          <span>{{ tag }}</span>
        </template>
      </div>
      <h1 class="text-xl font-bold leading-snug text-white">{{ event.title }}</h1>
      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div v-if="isSingleMarket && !isFullyResolved" class="font-mono text-[28px] font-semibold leading-none" :class="chancePctClass(singleMarketChance)">
          <PercentOdometer :value="singleMarketChance" />
          <span class="font-sans ml-1 text-xs font-medium text-text-2">chance</span>
        </div>
        <span class="font-mono text-[11px] font-medium text-text-3">VOL ${{ fmtn(event.volume) }}</span>
        <div class="flex items-center gap-1.5">
          <button class="pm-focus flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition-colors duration-150" :class="watched ? 'border-white text-white' : 'border-border text-text-2 hover:border-border-2 hover:text-white'" @click="emit('toggle-watch')">
            <Icon name="lucide:star" class="h-3 w-3" :class="watched ? 'fill-current' : ''" />
            {{ watched ? "Watching" : "Watchlist" }}
          </button>
          <button class="pm-focus grid h-7 w-7 place-items-center rounded-md border border-border text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white" :class="{ 'animate-spin': isRefreshing }" :disabled="isRefreshing" title="Refresh odds" @click="emit('refresh')">
            <Icon name="lucide:refresh-cw" class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
