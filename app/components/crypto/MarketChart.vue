<template>
  <div class="w-full">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Live market chart</div>
        <div class="mt-0.5 text-sm font-semibold text-text">{{ mode === "odds" ? `${outcomeTitle} probability` : `${info.display} / USD` }}</div>
      </div>

      <div class="inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Chart data">
        <button
          v-for="option in modes"
          :key="option.value"
          type="button"
          class="pm-focus h-8 rounded-md px-3 text-[11px] font-bold transition-colors duration-150"
          :class="mode === option.value ? 'bg-surface-2 text-white shadow-sm' : 'text-text-3 hover:text-text-2'"
          :aria-pressed="mode === option.value"
          @click="mode = option.value"
        >
          {{ option.value === "crypto" ? priceModeLabel : option.label }}
        </button>
      </div>
    </div>

    <Transition name="chart-mode" mode="out-in">
      <PriceChart v-if="mode === 'odds'" key="odds" :tokens="tokens" :outcome-title="outcomeTitle" :live-point="liveOddsPoint ?? undefined" :window-start-ms="info.windowStartMs ?? undefined" :window-end-ms="info.windowEndMs ?? undefined" @hover-value="$emit('hover-value', $event)" />

      <div v-else key="crypto" class="select-none">
        <div ref="chartContainer" class="crypto-chart__frame relative w-full" :style="{ height: `${CHART_HEIGHT}px` }" @pointermove="handlePointerMove" @pointerleave="clearHover">
          <div v-if="!chartPoints.length" class="absolute inset-0 flex items-center justify-center rounded-lg border border-border bg-surface text-sm text-text-3">{{ waitingLabel }}</div>
          <svg v-else class="block overflow-visible" :width="frameWidth" :height="CHART_HEIGHT" :viewBox="`0 0 ${frameWidth} ${CHART_HEIGHT}`" :aria-label="priceChartAriaLabel" role="img">
            <g class="crypto-chart__sections">
              <rect v-for="section in xSections" :key="section.key" :x="section.x" :y="plot.top" :width="section.width" :height="plot.height" />
            </g>

            <g class="crypto-chart__grid">
              <line v-for="tick in yTicks" :key="`y-${tick.value}`" :x1="plot.left" :x2="plot.right" :y1="tick.y" :y2="tick.y" />
              <line v-for="tick in xTicks" :key="`x-${tick.value}`" :x1="tick.x" :x2="tick.x" :y1="plot.top" :y2="plot.bottom" />
            </g>

            <g class="crypto-chart__axis">
              <text v-for="tick in yTicks" :key="`yl-${tick.value}`" :x="plot.right + 8" :y="tick.y + 4">${{ formatAxisPrice(tick.value) }}</text>
              <text v-for="tick in xTicks" :key="`xl-${tick.value}`" :x="tick.x" :y="CHART_HEIGHT - 8" text-anchor="middle">{{ formatTime(tick.value) }}</text>
            </g>

            <g v-if="benchmarkIndicator" class="crypto-chart__benchmark" :class="{ 'crypto-chart__benchmark--out': benchmarkIndicator.outOfRange !== null }">
              <line :x1="plot.left" :x2="plot.right" :y1="benchmarkIndicator.y" :y2="benchmarkIndicator.y" />
              <rect :x="plot.left + 8" :y="benchmarkIndicator.labelY - 13" :width="benchmarkIndicator.labelWidth" height="18" rx="4" />
              <text :x="plot.left + 15" :y="benchmarkIndicator.labelY">{{ benchmarkIndicator.label }}</text>
            </g>

            <path class="crypto-chart__line" :d="pricePath" />
            <circle v-if="endpointPoint" class="crypto-chart__endpoint" :cx="xScale(endpointPoint.time)" :cy="yScale(endpointPoint.value)" r="3.5" />

            <g v-if="hoverPoint" class="crypto-chart__hover">
              <line :x1="xScale(hoverPoint.time)" :x2="xScale(hoverPoint.time)" :y1="plot.top" :y2="plot.bottom" />
              <circle :cx="xScale(hoverPoint.time)" :cy="yScale(hoverPoint.value)" r="4" />
            </g>
          </svg>

          <div v-if="hoverPoint" class="pointer-events-none absolute z-10 -translate-y-1/2 rounded-md border border-border bg-[rgba(12,12,12,0.94)] px-2 py-1 shadow-lg" :style="hoverLabelStyle">
            <div class="font-mono text-[11px] font-bold tabular-nums text-white">${{ formatPrice(hoverPoint.value) }}</div>
            <div class="mt-0.5 text-[9px] font-medium text-text-3">{{ formatHoverTime(hoverPoint.time) }}</div>
          </div>
        </div>

        <div class="pt-4 text-sm text-text-3">Market window</div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { extent } from "d3-array";
import { scaleLinear } from "d3-scale";
import { curveLinear, line } from "d3-shape";
import type { CryptoPricePoint } from "~/composables/useCryptoPriceFeed";
import type { CryptoUpDownInfo } from "~/utils/crypto";
import type { FinanceUpDownInfo } from "~/utils/finance";
import { fmtm as formatPrice } from "~/utils/prices";

type ChartMode = "odds" | "crypto";
type ChartPoint = { time: number; value: number };

const props = defineProps<{
  info: CryptoUpDownInfo | FinanceUpDownInfo;
  active?: boolean;
  tokens: Array<{ tokenId: string; label: string }>;
  outcomeTitle: string;
  liveOddsPoint?: ChartPoint | null;
  pricePoints: CryptoPricePoint[];
  priceToBeat: number | null;
  currentPrice: number | null;
  priceModeLabel?: string;
  waitingLabel?: string;
  priceChartAriaLabel?: string;
}>();

defineEmits<{
  (e: "hover-value", value: number | null): void;
}>();

const modes: Array<{ label: string; value: ChartMode }> = [
  { label: "Market odds", value: "odds" },
  { label: "Crypto price", value: "crypto" },
];
const priceModeLabel = computed(() => props.priceModeLabel ?? "Crypto price");
const waitingLabel = computed(() => props.waitingLabel ?? "Waiting for Chainlink price data...");
const priceChartAriaLabel = computed(() => props.priceChartAriaLabel ?? "Live crypto price with price-to-beat line");
const mode = ref<ChartMode>("crypto");
const chartContainer = ref<HTMLElement | null>(null);
const chartWidth = ref(0);
const hoverPoint = ref<ChartPoint | null>(null);
const now = ref(Date.now());
const CHART_HEIGHT = 300;
const CRYPTO_WINDOW_MS = 60_000;
const SECTION_MS = 10_000;
const MARGIN = { top: 10, right: 76, bottom: 30, left: 8 };
let resizeObserver: ResizeObserver | null = null;
let frameId: number | null = null;

const frameWidth = computed(() => Math.max(chartWidth.value, MARGIN.left + MARGIN.right + 1));

const plot = computed(() => {
  const w = frameWidth.value;
  return { top: MARGIN.top, right: w - MARGIN.right, bottom: CHART_HEIGHT - MARGIN.bottom, left: MARGIN.left, width: w - MARGIN.left - MARGIN.right, height: CHART_HEIGHT - MARGIN.top - MARGIN.bottom };
});

const xDomainEnd = computed(() => Math.max(now.value, props.pricePoints.at(-1)?.timestamp ?? now.value));

const chartPoints = computed<ChartPoint[]>(() => {
  const end = xDomainEnd.value,
    start = end - CRYPTO_WINDOW_MS;
  return props.pricePoints
    .filter((p) => p.timestamp >= start && p.timestamp <= end)
    .map((p) => ({ time: p.timestamp, value: p.value }))
    .sort((a, b) => a.time - b.time);
});

const endpointPoint = computed<ChartPoint | null>(() => {
  const v = props.currentPrice ?? chartPoints.value.at(-1)?.value;
  return v === undefined || v === null ? null : { time: xDomainEnd.value, value: v };
});

const linePoints = computed(() => {
  const e = endpointPoint.value;
  return e ? [...chartPoints.value.filter((p) => p.time < e.time), e] : chartPoints.value;
});

const xScale = computed(() =>
  scaleLinear()
    .domain([xDomainEnd.value - CRYPTO_WINDOW_MS, xDomainEnd.value])
    .range([plot.value.left, plot.value.right]),
);

const yScale = computed(() => {
  const [d0, d1] = extent(chartPoints.value.map((p) => p.value)) as [number | undefined, number | undefined];
  let min = d0 ?? 0,
    max = d1 ?? min + 1;
  const center = (min + max) / 2,
    minRange = Math.max(center * 0.00025, 4);
  if (max - min < minRange) {
    min = center - minRange / 2;
    max = center + minRange / 2;
  } else {
    const pad = (max - min) * 0.18;
    min -= pad;
    max += pad;
  }
  return scaleLinear().domain([min, max]).range([plot.value.bottom, plot.value.top]).nice(4);
});

const pathBuilder = computed(() =>
  line<ChartPoint>()
    .x((p) => xScale.value(p.time))
    .y((p) => yScale.value(p.value))
    .curve(curveLinear),
);
const pricePath = computed(() => pathBuilder.value(linePoints.value) || "");
const benchmarkIndicator = computed(() => {
  if (props.active === false || props.priceToBeat === null) return null;
  const rawY = yScale.value(props.priceToBeat),
    { top, bottom } = plot.value,
    out = rawY < top ? "above" : rawY > bottom ? "below" : null,
    y = Math.min(Math.max(rawY, top + 7), bottom - 7);
  return { y, labelY: out === "above" ? top + 17 : out === "below" ? bottom - 8 : y - 7, label: out === "above" ? "↑ PRICE TO BEAT" : out === "below" ? "↓ PRICE TO BEAT" : "PRICE TO BEAT", labelWidth: out ? 122 : 104, outOfRange: out };
});
const yTicks = computed(() => yScale.value.ticks(4).map((value) => ({ value, y: yScale.value(value) })));
const xTicks = computed(() => {
  const [start = 0, end = 0] = xScale.value.domain(),
    count = chartWidth.value < 520 ? 4 : 7;
  return Array.from({ length: count }, (_, i) => {
    const value = start + ((end - start) * i) / (count - 1);
    return { value, x: xScale.value(value) };
  });
});

const xSections = computed(() => {
  const [start = 0, end = 0] = xScale.value.domain(),
    sections: Array<{ key: number; x: number; width: number }> = [];
  for (let s = Math.floor(start / SECTION_MS) * SECTION_MS, i = 0; s < end; s += SECTION_MS, i++) {
    if (i % 2 === 0) continue;
    const vs = Math.max(s, start);
    sections.push({ key: s, x: xScale.value(vs), width: Math.max(0, xScale.value(Math.min(s + SECTION_MS, end)) - xScale.value(vs)) });
  }
  return sections;
});

const hoverLabelStyle = computed(() => {
  if (!hoverPoint.value) return {};
  const x = xScale.value(hoverPoint.value.time),
    left = x + 132 > chartWidth.value ? x - 130 : x + 12;
  return { left: `${Math.max(8, left)}px`, top: `${yScale.value(hoverPoint.value.value)}px` };
});

function handlePointerMove(e: PointerEvent) {
  if (!chartContainer.value || !chartPoints.value.length) return;
  const rect = chartContainer.value.getBoundingClientRect(),
    ts = xScale.value.invert(Math.min(Math.max(e.clientX - rect.left, plot.value.left), plot.value.right));
  hoverPoint.value = chartPoints.value.reduce((near, p) => (Math.abs(p.time - ts) < Math.abs(near.time - ts) ? p : near));
}

const clearHover = () => {
  hoverPoint.value = null;
};
const formatAxisPrice = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const formatTime = (ts: number) => new Date(ts).toLocaleTimeString("en-US", { minute: "2-digit", second: "2-digit" });
const formatHoverTime = (ts: number) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });

function observeChart() {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (!chartContainer.value) return;
  chartWidth.value = chartContainer.value.clientWidth;
  resizeObserver = new ResizeObserver((entries) => (chartWidth.value = entries[0]?.contentRect.width || chartContainer.value?.clientWidth || 0));
  resizeObserver.observe(chartContainer.value);
}

watch(chartContainer, (el) => {
  if (el) observeChart();
  else {
    resizeObserver?.disconnect();
    resizeObserver = null;
  }
});

onMounted(() => {
  const tick = () => {
    now.value = Date.now();
    frameId = requestAnimationFrame(tick);
  };
  frameId = requestAnimationFrame(tick);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  if (frameId !== null) cancelAnimationFrame(frameId);
});
</script>

<style scoped>
.crypto-chart__frame {
  touch-action: none;
}

.crypto-chart__grid line {
  stroke: var(--color-border);
  stroke-width: 1;
}

.crypto-chart__sections rect {
  fill: rgba(255, 255, 255, 0.018);
}

.crypto-chart__axis text {
  fill: var(--color-text-3);
  font-family: "IBM Plex Mono", monospace;
  font-size: 10px;
  font-weight: 500;
}

.crypto-chart__line {
  fill: none;
  stroke: #f0f0f0;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.75;
}

.crypto-chart__endpoint {
  fill: var(--color-white);
  stroke: var(--color-bg);
  stroke-width: 2;
  transition: cy 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.crypto-chart__benchmark line {
  stroke: #26a69a;
  stroke-dasharray: 5 4;
  stroke-width: 1.25;
}

.crypto-chart__benchmark--out line {
  stroke-dasharray: 3 4;
}

.crypto-chart__benchmark rect {
  fill: rgba(9, 40, 37, 0.94);
  stroke: rgba(38, 166, 154, 0.35);
}

.crypto-chart__benchmark text {
  fill: #26a69a;
  font-family: "IBM Plex Mono", monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.crypto-chart__hover line {
  stroke: var(--color-border-2);
  stroke-width: 1;
}

.crypto-chart__hover circle {
  fill: var(--color-white);
  stroke: var(--color-bg);
  stroke-width: 2;
}

.chart-mode-enter-active,
.chart-mode-leave-active {
  transition: opacity 120ms ease-out;
}

.chart-mode-enter-from,
.chart-mode-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .chart-mode-enter-active,
  .chart-mode-leave-active {
    transition: none;
  }
}
</style>
