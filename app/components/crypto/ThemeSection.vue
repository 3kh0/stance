<script setup lang="ts">
import type { MarketFeedEvent } from "~/types/gamma";
import { coinFromEvent } from "~/utils/cryptoTaxonomy";

const props = defineProps<{
  events: MarketFeedEvent[];
  selectedCoin: string | null;
}>();

const filtered = computed(() => (props.selectedCoin ? props.events.filter((e) => coinFromEvent(e) === props.selectedCoin) : props.events));
</script>

<template>
  <section v-if="filtered.length > 0" class="flex flex-col gap-3">
    <h2 class="text-[10px] font-bold uppercase tracking-widest text-text-3">More Crypto Markets</h2>
    <div class="pm-grid">
      <MarketCard v-for="(event, index) in filtered" :key="event.id" :event="event" :style="{ '--card-index': Math.min(index, 8) }" />
    </div>
  </section>
</template>
