<script setup lang="ts">
import type { Outcome, Position } from "~/composables/useAccount";
import type { GammaEvent, GammaMarket } from "~/types/gamma";
import { getResolution } from "~/utils/markets";
import { fmtn } from "~/utils/prices";

interface MarketWithPrice extends GammaMarket {
  yesPrice: number;
}

interface RedeemableItem {
  market: MarketWithPrice;
  outcome: Outcome;
  position: Position;
}

const props = defineProps<{
  event: GammaEvent;
  resolvedMarkets: MarketWithPrice[];
  redeemablePositions: RedeemableItem[];
  totalRedeemablePayout: number;
  resolvedRedeemableChecked: boolean;
  redemptionMessage: string;
  resolutionLabel: (market: GammaMarket) => string;
  outcomeLabel: (market: GammaMarket, side: Outcome) => string;
}>();

const emit = defineEmits<{
  redeem: [item: RedeemableItem];
  "redeem-all": [];
}>();

const soleResolvedMarket = computed(() => (props.resolvedMarkets.length === 1 ? props.resolvedMarkets[0] : undefined));
const isYes = (m: GammaMarket) => getResolution(m) === "yes";
</script>

<template>
  <div class="sticky top-[calc(var(--header-height,110px)+16px)] overflow-hidden border border-border rounded-xl bg-(--color-card) p-4">
    <div class="flex items-center gap-3 border-b border-border pb-4 mb-4">
      <MarketIcon v-if="event?.icon" :src="event.icon" :alt="event.title" class="w-12 h-12 shrink-0 rounded-[7.2px] object-cover" />
      <div class="flex flex-col gap-0.5 min-w-0">
        <div class="overflow-hidden text-ellipsis whitespace-nowrap text-(--text-body) text-sm font-[590] leading-5">{{ event?.title }}</div>
        <div class="text-[13px] text-(--text-muted) leading-4.5">Market closed</div>
      </div>
    </div>

    <template v-if="soleResolvedMarket">
      <div class="flex flex-col items-center py-6 gap-3">
        <div class="text-(--text-muted) text-xs font-[650] tracking-widest uppercase">Resolved</div>
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" :class="isYes(soleResolvedMarket) ? 'bg-(--market-yes-bg)' : 'bg-(--market-no-bg)'">
            <Icon :name="isYes(soleResolvedMarket) ? 'lucide:check' : 'lucide:x'" class="w-5 h-5" :class="isYes(soleResolvedMarket) ? 'text-(--market-yes)' : 'text-(--market-no)'" />
          </div>
          <span class="text-4xl font-bold" :class="isYes(soleResolvedMarket) ? 'text-(--market-yes)' : 'text-(--market-no)'">{{ resolutionLabel(soleResolvedMarket) }}</span>
        </div>
        <div class="text-(--text-muted) text-sm text-center mt-1">
          {{ soleResolvedMarket.groupItemTitle || soleResolvedMarket.question }}
        </div>
      </div>
    </template>

    <template v-else>
      <div class="space-y-2">
        <div v-for="market in resolvedMarkets" :key="market.id" class="flex items-center justify-between py-2.5 border-b border-border last:border-0">
          <div class="text-(--text-body) text-sm font-[590] min-w-0 flex-1 pr-3 leading-5">{{ market.groupItemTitle || market.question }}</div>
          <div class="flex items-center gap-1.5 font-bold text-sm shrink-0" :class="isYes(market) ? 'text-(--market-yes)' : 'text-(--market-no)'">
            <Icon :name="isYes(market) ? 'lucide:check' : 'lucide:x'" class="w-4 h-4" />
            {{ resolutionLabel(market) }}
          </div>
        </div>
      </div>
    </template>

    <div v-if="redeemablePositions.length > 0" class="mt-4 border-t border-border pt-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <div class="text-(--text-body) text-sm font-[650] leading-5">Redeem winnings</div>
          <div class="text-(--text-muted) text-xs leading-4.5">
            <NumericOdometer :value="totalRedeemablePayout" prefix="$" :minimum-fraction-digits="2" :maximum-fraction-digits="2" />
            available
          </div>
        </div>
        <button class="pm-button pm-button--yes pm-focus min-h-10 px-4 text-sm font-[650]" @click="emit('redeem-all')">Redeem</button>
      </div>

      <div class="space-y-2">
        <div v-for="item in redeemablePositions" :key="item.position.positionKey" class="flex items-center justify-between gap-3 rounded-[7.2px] bg-white/3 px-3 py-2">
          <div class="min-w-0">
            <div class="truncate text-(--text-body) text-xs font-[650]">{{ item.market.groupItemTitle || item.market.question }}</div>
            <div class="text-(--text-muted) text-xs">
              {{ outcomeLabel(item.market, item.outcome) }}
              ·
              <NumericOdometer :value="item.position.shares" :maximum-fraction-digits="2" />
              shares
            </div>
          </div>
          <button class="pm-focus shrink-0 text-(--market-yes) text-xs font-[650] hover:text-(--text-primary)" @click="emit('redeem', item)">Redeem</button>
        </div>
      </div>
    </div>

    <div v-else-if="resolvedRedeemableChecked" class="mt-4 border-t border-border pt-4 text-(--text-muted) text-xs leading-5">
      {{ redemptionMessage || "" }}
    </div>

    <div class="mt-4 pt-4 border-t border-border flex items-center gap-2 text-(--text-muted) text-xs">
      <Icon name="lucide:info" class="w-3.5 h-3.5 shrink-0" />
      ${{ fmtn(event?.volume || 0) }} total volume
    </div>
  </div>
</template>
