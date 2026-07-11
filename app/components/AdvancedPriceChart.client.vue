<template>
  <div class="w-full select-none">
    <div class="mb-4.5 flex min-h-8 items-center justify-end gap-3">
      <div class="flex items-center justify-end gap-3.5">
        <button
          v-for="iv in CANDLE_INTERVALS"
          :key="iv"
          class="font-mono rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-4 transition-colors duration-150"
          :class="interval === iv ? 'border-white text-white' : 'border-border text-text-2 hover:border-border-2 hover:text-white'"
          @click="setInterval(iv)"
        >
          {{ CANDLE_INTERVAL_LABELS[iv] }}
        </button>
      </div>
    </div>

    <div class="relative">
      <div ref="chartContainer" class="advanced-chart__frame w-full" :style="{ height: `${CHART_HEIGHT}px` }" />
      <div v-if="loading" class="absolute inset-0 rounded-[7.2px] bg-(--color-secondary)" />
      <div v-else-if="chartError" class="absolute inset-0 flex items-center justify-center text-(--text-muted) text-sm">Chart data unavailable</div>
      <div v-else-if="!hasData" class="absolute inset-0 flex items-center justify-center text-(--text-muted) text-sm">No candle data for this range</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CandlestickData, IChartApi, ISeriesApi, Time, UTCTimestamp } from "lightweight-charts";
import { CANDLE_INTERVAL_LABELS, CANDLE_INTERVAL_SECONDS, CANDLE_INTERVALS, mergeLiveCandle, toPercentCandle } from "~/composables/useCandleData";
import type { Candle, CandleInterval, RawCandle } from "~/composables/useCandleData";

const props = defineProps<{
  tokens: Array<{ tokenId: string; label?: string; color?: string; startTs?: number; endTs?: number }>;
  outcomeTitle?: string;
  livePoint?: { time: number; value: number } | null;
  windowStartMs?: number | null;
  windowEndMs?: number | null;
  defaultInterval?: CandleInterval;
}>();

const CHART_HEIGHT = 300;
const YES = "#26a69a";
const NO = "#ef5350";

const chartContainer = ref<HTMLElement | null>(null);
const interval = ref<CandleInterval>(props.defaultInterval && CANDLE_INTERVALS.includes(props.defaultInterval) ? props.defaultInterval : "1h");
const loading = ref(true);
const chartError = ref(false);
const hasData = ref(false);

const primaryToken = computed(() => props.tokens[0] ?? null);

let chart: IChartApi | null = null;
let series: ISeriesApi<"Candlestick"> | null = null;
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;
let lastCandle: Candle | null = null;
let loadToken = 0;

function readColors() {
  const s = getComputedStyle(document.documentElement);
  const get = (n: string, f: string) => s.getPropertyValue(n).trim() || f;
  return { bg: get("--color-bg", "#000000"), border: get("--color-border", "rgba(255,255,255,0.08)"), text: get("--color-text-3", "#8a8a8a") };
}

function applyTheme() {
  if (chart) chart.applyOptions(theme(readColors()));
}

function theme(c: ReturnType<typeof readColors>) {
  return { layout: { background: { color: c.bg }, textColor: c.text, attributionLogo: false }, grid: { vertLines: { color: c.border }, horzLines: { color: c.border } }, rightPriceScale: { borderColor: c.border }, timeScale: { borderColor: c.border } };
}

const candle = (c: Candle) => ({ ...c, time: c.time as UTCTimestamp }) as CandlestickData<Time>;

function rangeQuery(t: NonNullable<typeof primaryToken.value>) {
  if (Number.isFinite(props.windowStartMs) && Number.isFinite(props.windowEndMs)) return `&startTs=${Math.floor((props.windowStartMs as number) / 1000)}&endTs=${Math.ceil((props.windowEndMs as number) / 1000)}`;
  if (Number.isFinite(t.startTs) && Number.isFinite(t.endTs)) return `&startTs=${t.startTs}&endTs=${t.endTs}`;
  return "";
}

async function loadCandles() {
  const t = primaryToken.value;
  if (!t) {
    loading.value = false;
    hasData.value = false;
    return;
  }

  const rid = ++loadToken;
  loading.value = true;
  chartError.value = false;

  try {
    const res = await $fetch<{ candles: RawCandle[] }>(`/api/market/ohlc?tokenId=${encodeURIComponent(t.tokenId)}&interval=${interval.value}${rangeQuery(t)}`);
    if (rid !== loadToken) return;

    const cs = (res.candles ?? []).map(toPercentCandle);
    hasData.value = cs.length > 0;
    lastCandle = cs[cs.length - 1] ?? null;
    if (series) {
      series.setData(cs.map(candle));
      chart?.timeScale().fitContent();
    }
    applyLivePoint();
  } catch {
    if (rid !== loadToken) return;
    chartError.value = true;
    hasData.value = false;
  } finally {
    if (rid === loadToken) loading.value = false;
  }
}

function applyLivePoint() {
  if (!series || !props.livePoint) return;
  const merged = mergeLiveCandle(lastCandle, props.livePoint, CANDLE_INTERVAL_SECONDS[interval.value]);
  if (!merged) return;
  lastCandle = merged;
  series.update(candle(merged));
  hasData.value = true;
}

function setInterval(iv: CandleInterval) {
  if (interval.value === iv) return;
  interval.value = iv;
  loadCandles();
}

watch(
  () => (props.livePoint ? `${props.livePoint.time}:${props.livePoint.value}` : ""),
  () => applyLivePoint(),
);

watch(
  () => primaryToken.value?.tokenId,
  (next, prev) => {
    if (next && next !== prev) loadCandles();
  },
);

onMounted(async () => {
  if (!chartContainer.value) return;

  const LWC = await import("lightweight-charts");
  if (!chartContainer.value) return;

  const c = readColors();
  chart = LWC.createChart(chartContainer.value, {
    width: chartContainer.value.clientWidth,
    height: CHART_HEIGHT,
    ...theme(c),
    layout: { background: { type: LWC.ColorType.Solid, color: c.bg }, textColor: c.text, attributionLogo: false },
    rightPriceScale: { borderColor: c.border, scaleMargins: { top: 0.1, bottom: 0.1 } },
    timeScale: { borderColor: c.border, timeVisible: true, secondsVisible: false },
    crosshair: { mode: LWC.CrosshairMode.Normal },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    kineticScroll: { touch: true, mouse: false },
    localization: { priceFormatter: (p: number) => `${p.toFixed(1)}%` },
  });

  series = chart.addSeries(LWC.CandlestickSeries, {
    upColor: YES,
    downColor: NO,
    borderUpColor: YES,
    borderDownColor: NO,
    wickUpColor: YES,
    wickDownColor: NO,
    priceFormat: { type: "price", precision: 1, minMove: 0.1 },
  });

  resizeObserver = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width || chartContainer.value?.clientWidth || 0;
    if (w > 0) chart?.applyOptions({ width: w });
  });
  resizeObserver.observe(chartContainer.value);
  themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
  await loadCandles();
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  themeObserver?.disconnect();
  chart?.remove();
  chart = null;
  series = null;
});
</script>

<style scoped>
.advanced-chart__frame {
  position: relative;
  touch-action: none;
}
</style>
