<script setup lang="ts">
import { firstEventSlug } from "~/utils/markets";

interface BreakingMarket {
  id: string;
  question: string;
  image?: string;
  outcomePrices?: string[];
  oneDayPriceChange: number;
  events?: { slug?: string }[];
}

const { data, pending, error, refresh } = await useFetch<{ markets?: BreakingMarket[] }>("/api/breaking");

const sorted = computed(() => [...(data.value?.markets ?? [])].filter((m) => m.id && m.question && firstEventSlug(m)).sort((a, b) => Math.abs(b.oneDayPriceChange || 0) - Math.abs(a.oneDayPriceChange || 0)));

const chance = (m: BreakingMarket) => Math.round((parseFloat(m.outcomePrices?.[0] ?? "0") || 0) * 100);
</script>

<template>
  <div class="pm-page">
    <section class="pm-container pt-6 pb-3 pm-spring-in" style="--pm-spring-delay: 0ms">
      <div class="pb-5 border-b border-border">
        <p class="text-xs leading-4 text-text-3">{{ new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }}</p>
        <h1 class="mt-1 text-2xl font-bold leading-8 text-white">Breaking News</h1>
        <span class="text-sm leading-5 text-text-2">Largest 24 hour market moves</span>
      </div>
    </section>

    <main class="pm-container pt-5 pb-8">
      <div v-if="pending" class="flex flex-col gap-3">
        <div v-for="i in 5" :key="i" class="flex min-h-18 items-center gap-3 rounded-xl border border-border bg-surface p-3">
          <div class="pm-skeleton h-4 w-6 shrink-0" />
          <div class="pm-skeleton h-10 w-10 shrink-0 rounded-lg" />
          <div class="min-w-0 flex-1">
            <div class="pm-skeleton mb-2 h-4 w-3/4" />
            <div class="pm-skeleton h-3 w-1/3" />
          </div>
        </div>
      </div>

      <div v-else-if="error" class="flex min-h-60 items-center justify-center px-4">
        <div class="max-w-md text-center rounded-xl border border-border bg-surface p-6">
          <p class="mb-2 text-base font-[650] leading-5.5 text-no">Error loading breaking markets</p>
          <p class="mb-4 text-sm leading-5 text-text-3">The biggest movers feed is unavailable right now.</p>
          <button class="pm-button pm-button--secondary pm-focus min-h-10 px-4 text-sm font-[590]" @click="() => refresh()">Retry</button>
        </div>
      </div>

      <div v-else-if="sorted.length === 0" class="flex min-h-60 items-center justify-center px-4 text-center text-sm leading-5 text-text-3">No breaking markets to show right now.</div>

      <div v-else class="flex flex-col gap-3">
        <NuxtLink
          v-for="(market, index) in sorted"
          :key="market.id"
          :to="`/event/${firstEventSlug(market)}`"
          class="group pm-focus pm-spring-in pm-spring-press flex min-h-18 items-center gap-3 rounded-xl border border-border bg-surface p-3 text-text transition-[border-color,background-color,transform] duration-150 hover:-translate-y-px hover:border-border-2 hover:bg-surface-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          :style="{ '--pm-spring-delay': `${60 + index * 40}ms` }"
        >
          <div class="font-mono w-6 shrink-0 text-right text-[11px] font-semibold leading-4 text-text-3">{{ index + 1 }}</div>

          <MarketIcon v-if="market.image" :src="market.image" :alt="market.question" class="h-10 w-10 shrink-0 rounded-lg border border-border object-cover" />
          <div v-else class="h-10 w-10 shrink-0 rounded-lg border border-border bg-surface-2" />

          <div class="min-w-0 flex-1">
            <h3 class="mb-1 line-clamp-2 text-[13.5px] font-semibold leading-snug text-white transition-colors duration-150 group-hover:text-white">{{ market.question }}</h3>
            <div class="flex items-center gap-3">
              <div class="font-mono text-[15px] font-semibold leading-none text-white"><PercentOdometer :value="chance(market)" /></div>

              <div :class="market.oneDayPriceChange >= 0 ? 'text-yes' : 'text-no'">
                <div class="font-mono flex items-center gap-1 text-xs font-semibold leading-4">
                  <Icon name="lucide:arrow-left" class="h-3.5 w-3.5" :class="market.oneDayPriceChange >= 0 ? 'rotate-135' : 'rotate-[-135deg]'" />
                  <PercentOdometer :value="Math.abs(market.oneDayPriceChange * 100)" />
                </div>
              </div>
            </div>
          </div>

          <div class="shrink-0 rotate-180 text-text-3 transition-colors duration-150 group-hover:text-text-2">
            <Icon name="lucide:arrow-left" class="h-4 w-4" />
          </div>
        </NuxtLink>
      </div>
    </main>
  </div>
</template>
