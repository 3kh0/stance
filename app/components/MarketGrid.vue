<script setup lang="ts">
import type { MarketFeedEvent } from "~/types/gamma";
import { useInfiniteScroll } from "~/composables/useInfiniteScroll";

withDefaults(
  defineProps<{
    events: MarketFeedEvent[];
    loading?: boolean;
    error?: string | null;
    pageError?: string | null;
  }>(),
  { loading: false, error: null, pageError: null },
);

const emit = defineEmits<{ "reach-end": []; retry: []; "retry-page": [] }>();

useInfiniteScroll(() => emit("reach-end"), { threshold: 0.1 });
</script>

<template>
  <div class="pm-container pb-8">
    <div v-if="error && events.length === 0" class="flex min-h-60 items-center justify-center px-4">
      <div class="max-w-md text-center rounded-xl border border-border bg-(--color-card) p-6">
        <p class="text-(--market-no) text-base font-[650] leading-5.5 mb-2">{{ error }}</p>
        <p class="text-(--text-muted) text-sm leading-5 mb-4">The market data is unavailable right now.</p>
        <button class="pm-button pm-button--secondary pm-focus min-h-10 px-4 text-sm font-[590]" :disabled="loading" @click="emit('retry')">Retry</button>
      </div>
    </div>

    <div v-else-if="loading && events.length === 0" class="pm-grid">
      <div v-for="i in 6" :key="`skeleton-${i}`" class="market-skeleton">
        <div class="flex items-start gap-2 px-3 pt-3">
          <div class="w-9 h-9 pm-skeleton rounded-[7.2px] shrink-0" />
          <div class="flex-1 space-y-2">
            <div class="pm-skeleton h-4 w-3/4" />
            <div class="pm-skeleton h-4 w-1/2" />
          </div>
        </div>
        <div class="px-3 pt-4 space-y-2">
          <div class="pm-skeleton h-7 w-full rounded-md" />
          <div class="pm-skeleton h-7 w-full rounded-md" />
        </div>
        <div class="px-3 pt-4 pb-3 flex justify-between">
          <div class="pm-skeleton h-3 w-16" />
          <div class="pm-skeleton h-3 w-10" />
        </div>
      </div>
    </div>

    <div v-else-if="events.length === 0" class="flex min-h-60 items-center justify-center px-4">
      <div class="max-w-md text-center text-(--text-muted) text-sm leading-5">No markets to show here right now.</div>
    </div>

    <div v-else class="pm-grid transition-opacity duration-150" :class="{ 'opacity-60': loading }">
      <MarketCard v-for="(event, index) in events" :key="event.id" :event="event" :style="{ '--card-index': Math.min(index, 8) }" />
    </div>
    <div v-if="pageError && events.length > 0" class="flex justify-center px-4 py-4">
      <div class="inline-flex items-center gap-3 rounded-[7.2px] border border-[rgba(234,179,8,0.25)] bg-[rgba(234,179,8,0.08)] px-4 py-2 text-[#eab308] text-sm leading-5">
        <span>{{ pageError }}</span>
        <button class="pm-focus font-[650] hover:text-(--text-primary)" :disabled="loading" @click="emit('retry-page')">Retry</button>
      </div>
    </div>
    <div ref="sentinel" class="h-16" />
  </div>
</template>

<style scoped>
.market-skeleton {
  min-height: 168px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}
</style>
