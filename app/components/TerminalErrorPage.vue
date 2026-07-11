<script setup lang="ts">
import type { MarketFeedEvent } from "~/types/gamma";

defineProps<{
  statusCode: number;
  title: string;
  description: string;
  requestedPath: string;
}>();

const emit = defineEmits<{
  navigate: [path: string];
}>();

const { data: homepageMarkets } = useFetch<MarketFeedEvent[]>("/api/init", { default: () => [] });

const floatingMarketSlots = [
  { left: "max(24px, 4vw)", top: "max(28px, 7vh)", transform: "rotate(-6deg)" },
  { right: "max(28px, 5vw)", top: "max(160px, 24vh)", transform: "rotate(5deg)" },
  { left: "max(56px, 12vw)", bottom: "max(36px, 9vh)", transform: "rotate(4deg)" },
  { right: "max(80px, 12vw)", bottom: "max(42px, 11vh)", transform: "rotate(-4deg)" },
];

const starField = [
  { left: "8%", top: "18%", opacity: 0.28, transform: "scale(1.2)" },
  { left: "18%", top: "68%", opacity: 0.18, transform: "scale(0.8)" },
  { left: "31%", top: "14%", opacity: 0.2, transform: "scale(0.7)" },
  { left: "43%", top: "76%", opacity: 0.24, transform: "scale(1)" },
  { left: "58%", top: "19%", opacity: 0.16, transform: "scale(0.75)" },
  { left: "67%", top: "82%", opacity: 0.26, transform: "scale(1.15)" },
  { left: "76%", top: "12%", opacity: 0.2, transform: "scale(0.9)" },
  { left: "88%", top: "62%", opacity: 0.18, transform: "scale(0.8)" },
  { left: "93%", top: "29%", opacity: 0.24, transform: "scale(1.1)" },
  { left: "24%", top: "42%", opacity: 0.14, transform: "scale(0.7)" },
  { left: "51%", top: "47%", opacity: 0.18, transform: "scale(0.8)" },
  { left: "82%", top: "77%", opacity: 0.16, transform: "scale(0.7)" },
];

const cycleIndex = ref(0);
const floatingMarketsVisible = ref(true);
const floatingMarketBatch = ref(0);
const nSlots = floatingMarketSlots.length;

const visibleFloatingMarkets = computed<MarketFeedEvent[]>(() => {
  const markets = homepageMarkets.value;
  if (!markets.length) return [];
  if (markets.length <= nSlots) return markets;
  return floatingMarketSlots.map((_, i) => markets[(cycleIndex.value + i) % markets.length]).filter((m): m is MarketFeedEvent => Boolean(m));
});

const canCycleMarkets = computed(() => homepageMarkets.value.length > nSlots);

let cycleTimer: ReturnType<typeof setInterval> | null = null;
let swapTimer: ReturnType<typeof setTimeout> | null = null;

const stopCycle = () => {
  if (cycleTimer) clearInterval(cycleTimer);
  cycleTimer = null;
};
const stopSwap = () => {
  if (swapTimer) clearTimeout(swapTimer);
  swapTimer = null;
};

function showNextMarketBatch() {
  if (swapTimer || !canCycleMarkets.value) return;
  floatingMarketsVisible.value = false;
  swapTimer = setTimeout(() => {
    const n = homepageMarkets.value.length;
    if (n <= nSlots) {
      cycleIndex.value = 0;
    } else {
      cycleIndex.value = (cycleIndex.value + nSlots) % n;
      floatingMarketBatch.value += 1;
    }
    swapTimer = null;
    requestAnimationFrame(() => (floatingMarketsVisible.value = true));
  }, 260);
}

function startCyclingMarkets() {
  if (cycleTimer || !canCycleMarkets.value) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  cycleTimer = setInterval(showNextMarketBatch, 4800);
}

onMounted(startCyclingMarkets);
onBeforeUnmount(() => {
  stopCycle();
  stopSwap();
});

watch(canCycleMarkets, (ok) => {
  if (ok) return startCyclingMarkets();
  stopCycle();
  stopSwap();
  floatingMarketsVisible.value = true;
  cycleIndex.value = 0;
});

watch(
  () => homepageMarkets.value.length,
  (n) => {
    if (cycleIndex.value >= n) cycleIndex.value = 0;
  },
);
</script>

<template>
  <div class="pm-page relative flex min-h-[calc(100dvh-3rem)] items-center justify-center overflow-hidden px-4 py-10">
    <div class="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <span v-for="(star, index) in starField" :key="index" class="absolute h-1 w-1 rounded-full bg-white shadow-[0_0_8px_rgba(240,240,240,0.55)]" :style="star" />
    </div>

    <div v-if="visibleFloatingMarkets.length" class="absolute inset-0 z-10 hidden overflow-hidden sm:block">
      <div v-for="(slot, index) in floatingMarketSlots" :key="index" class="absolute w-75 md:w-85" :style="slot">
        <Transition
          mode="out-in"
          enter-active-class="transition duration-500 ease-out motion-reduce:transition-none"
          enter-from-class="opacity-0 scale-[0.97] translate-y-2"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-200 ease-out motion-reduce:transition-none"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-[0.97] -translate-y-2"
        >
          <div
            v-if="floatingMarketsVisible && visibleFloatingMarkets[index]"
            :key="`${floatingMarketBatch}-${visibleFloatingMarkets[index]!.id}`"
            class="will-change-transform opacity-40 transition-[opacity,transform] duration-200 ease-out hover:scale-[1.01] hover:opacity-95 focus-within:scale-[1.01] focus-within:opacity-95 motion-reduce:transition-none"
          >
            <MarketCard :event="visibleFloatingMarkets[index]!" />
          </div>
        </Transition>
      </div>
    </div>

    <section class="relative z-20 flex w-full max-w-2xl flex-col items-center text-center">
      <div class="font-mono text-[112px] font-semibold leading-none text-white sm:text-[168px] md:text-[208px]">{{ statusCode }}</div>
      <div class="-mt-2 font-mono text-[15px] font-semibold uppercase tracking-widest text-no sm:-mt-4">0% yes</div>
      <h1 class="mt-5 max-w-xl text-[24px] font-extrabold leading-tight text-white sm:text-[32px]">{{ title }}</h1>
      <p class="mt-3 max-w-md text-[13px] leading-5 text-text-2">{{ description }}</p>
      <p class="my-3 max-w-full truncate font-mono text-[11px] text-text-3">{{ requestedPath }}</p>

      <div class="flex flex-wrap justify-center gap-2">
        <button type="button" class="pm-button pm-button--primary pm-focus min-h-9 px-3 text-[13px]" @click="emit('navigate', '/')">
          <Icon name="lucide:trending-up" class="h-4 w-4" />
          Trending
        </button>
        <button type="button" class="pm-button pm-button--secondary pm-focus min-h-9 px-3 text-[13px]" @click="emit('navigate', '/new')">
          <Icon name="lucide:sparkles" class="h-4 w-4" />
          New markets
        </button>
      </div>
    </section>
  </div>
</template>
