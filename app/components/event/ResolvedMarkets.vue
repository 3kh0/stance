<script setup lang="ts">
import type { GammaMarket } from "~/types/gamma";
import { getResolution } from "~/utils/markets";
import { fmtn } from "~/utils/prices";

interface MarketWithPrice extends GammaMarket {
  yesPrice: number;
}

defineProps<{
  resolvedMarkets: MarketWithPrice[];
  showResolved: boolean;
  resolutionLabel: (market: GammaMarket) => string;
}>();

const emit = defineEmits<{
  "update:showResolved": [value: boolean];
}>();

const isYes = (m: GammaMarket) => getResolution(m) === "yes";
</script>

<template>
  <div v-if="resolvedMarkets.length > 0" class="mt-4">
    <button class="pm-focus mt-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-text-3 transition-colors duration-150 hover:text-text-2" @click="emit('update:showResolved', !showResolved)">
      <span>View resolved</span>
      <Icon name="lucide:chevron-down" class="w-4 h-4 transition-transform" :class="{ 'rotate-180': showResolved }" />
    </button>

    <div v-if="showResolved" class="mt-4 space-y-6">
      <div v-for="market in resolvedMarkets" :key="market.id">
        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium mb-1">{{ market.groupItemTitle }}</div>
            <div class="text-xs text-(--text-meta)">${{ fmtn(market.volumeNum || 0) }} Vol.</div>
          </div>
          <div class="flex items-center gap-3 h-full">
            <div class="text-xl font-semibold flex items-center" :class="isYes(market) ? 'text-(--market-yes)' : 'text-(--market-no)'">{{ resolutionLabel(market) }}</div>
            <div class="w-6 h-6 rounded-full flex items-center justify-center" :class="isYes(market) ? 'bg-(--market-yes-bg)' : 'bg-(--market-no-bg)'">
              <Icon :name="isYes(market) ? 'lucide:check' : 'lucide:x'" class="w-4 h-4" :class="isYes(market) ? 'text-(--market-yes)' : 'text-(--market-no)'" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
