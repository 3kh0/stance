<template>
  <div class="w-full select-none">
    <div class="relative">
      <div class="mb-4.5 flex min-h-8 items-start justify-between gap-3">
        <div v-if="endLabels" class="min-w-0 flex-1" />
        <div v-else-if="tokens.length === 1" class="flex min-w-0 flex-1 justify-end pt-1.5">
          <span class="text-(--text-muted) text-sm leading-5">{{ hoveredDate || lastDateLabel }}</span>
        </div>

        <div v-else class="flex min-w-0 flex-1 flex-wrap gap-x-4.5 gap-y-2.5 pt-1 max-[700px]:gap-x-3 max-[700px]:gap-y-2">
          <div v-for="(token, i) in tokens" :key="token.tokenId" class="inline-flex min-w-0 items-center gap-1.75 text-(--text-meta) text-[15px] leading-5 max-[700px]:text-[13px]">
            <span class="w-2 h-2 shrink-0 rounded-full" :style="{ backgroundColor: seriesColor(i) }" />
            <span class="max-w-42.5 overflow-hidden text-ellipsis whitespace-nowrap">{{ token.label || outcomeTitle }}</span>
            <span class="text-(--text-body) font-bold tabular-nums">
              <PercentOdometer v-if="hoveredValues[i] != null" :value="Math.round(hoveredValues[i] ?? 0)" />
              <PercentOdometer v-else-if="lastPrices[i] != null" :value="Math.round(lastPrices[i] ?? 0)" />
              <span v-else>—</span>
            </span>
          </div>
        </div>

        <slot name="controls" />
      </div>

      <div class="relative">
        <div ref="chartContainer" class="price-chart__frame w-full" :style="{ height: `${CHART_HEIGHT}px` }" @pointermove="handlePointerMove" @pointerleave="clearHover">
          <div v-if="loading && !hasChartData" class="absolute inset-0 rounded-[7.2px] bg-(--color-secondary)" />
          <div v-else-if="chartError" class="absolute inset-0 flex items-center justify-center text-(--text-muted) text-sm">Chart data unavailable</div>
          <svg v-else-if="chartWidth > 0" class="price-chart__svg" :width="chartWidth" :height="CHART_HEIGHT" :viewBox="`0 0 ${chartWidth} ${CHART_HEIGHT}`" aria-label="Market price history" role="img">
            <g class="price-chart__grid">
              <line v-for="tick in yTicks" :key="`y-${tick}`" :x1="chartPlot.left" :x2="chartPlot.right" :y1="tick.y" :y2="tick.y" />
              <line v-for="tick in xTicks" :key="`x-${tick.value}`" :x1="tick.x" :x2="tick.x" :y1="chartPlot.top" :y2="chartPlot.bottom" />
            </g>

            <g class="price-chart__axis">
              <text v-for="tick in yTicks" :key="`yl-${tick.value}`" :x="endLabels ? chartWidth - 4 : chartPlot.right + 8" :text-anchor="endLabels ? 'end' : 'start'" :y="tick.y + 4">{{ tick.label }}</text>
              <text v-for="tick in xTicks" :key="`xl-${tick.value}`" :x="tick.x" :y="CHART_HEIGHT - 8" text-anchor="middle">{{ tick.label }}</text>
            </g>

            <g :key="animationKey" class="price-chart__series-layer" :style="{ '--plot-width': `${chartPlot.width}px` }">
              <rect class="price-chart__sweep" :x="chartPlot.left - 18" :y="chartPlot.top" width="36" :height="chartPlot.height" />
              <path v-for="(series, i) in renderedSeries" :key="`${series.tokenId}-${animationKey}`" class="price-chart__line" :d="series.path" pathLength="1" :stroke="series.color" :style="{ animationDelay: `${i * 80}ms`, color: series.color, strokeWidth: i === 0 ? 1.75 : 1.35 }" />
            </g>

            <g v-if="hasChartData" class="price-chart__endpoints">
              <circle v-for="series in renderedEndpoints" :key="`end-${series.tokenId}`" :cx="series.lastX" :cy="series.lastY" r="3.25" :fill="series.color" />
            </g>

            <g v-if="isHovering && hoverX !== null" class="price-chart__hover">
              <line :x1="hoverX" :x2="hoverX" :y1="chartPlot.top" :y2="chartPlot.bottom" />
              <circle v-for="point in hoverPoints" :key="point.tokenId" :cx="hoverX" :cy="point.y" r="4" :fill="point.color" />
            </g>
          </svg>
        </div>

        <div v-if="tokens.length === 1 && isHovering && hoverLabelX !== null && hoverLabelY !== null && hoveredValues[0] != null" class="price-chart__hover-label absolute z-10 pointer-events-none" :style="{ left: hoverLabelX + 'px', top: hoverLabelY + 'px' }">
          <div class="price-chart__tag price-chart__tag--single flex items-center gap-1.5 rounded-md px-2 py-0.75 text-[11px] font-bold" :style="{ '--series-color': seriesColor(0) }">
            <span class="max-w-24 overflow-hidden text-ellipsis whitespace-nowrap text-text-2">{{ singleOutcomeLabel }}</span>
            <span class="tabular-nums" :style="{ color: seriesColor(0) }">{{ Math.round(hoveredValues[0] ?? 0) }}%</span>
          </div>
        </div>

        <div v-for="label in hoverLabels" :key="label.tokenId" class="price-chart__hover-label absolute z-10 pointer-events-none" :style="{ left: label.x + 'px', top: label.y + 'px' }">
          <div class="price-chart__tag flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold">
            <span class="h-4 w-1 shrink-0 rounded-full" :style="{ backgroundColor: label.color }" />
            <span class="max-w-35 overflow-hidden text-ellipsis whitespace-nowrap text-text">{{ label.text }}</span>
            <span class="tabular-nums text-text">{{ Math.round(label.value) }}%</span>
          </div>
        </div>

        <template v-if="endLabels && hasChartData && !isHovering">
          <div v-for="item in endLabelItems" :key="`endlabel-${item.tokenId}`" class="absolute z-10 pointer-events-none -translate-y-1/2" :style="{ left: `${chartPlot.right + 10}px`, top: `${item.y}px` }">
            <div class="max-w-24 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-bold leading-tight max-[520px]:max-w-16" :style="{ color: item.color }">{{ item.label }}</div>
            <div class="font-mono text-xl font-bold leading-none tabular-nums" :style="{ color: item.color }">{{ Math.round(item.value) }}%</div>
          </div>
        </template>
      </div>

      <div class="flex items-center justify-between gap-4 pt-4.5 max-[700px]:flex-col max-[700px]:items-start">
        <div class="min-w-22.5 text-(--text-muted) text-sm leading-5">
          <template v-if="tokens.length > 1">{{ hoveredDate || rangeLabel }}</template>
          <template v-else>{{ rangeLabel }}</template>
        </div>
        <div v-if="!fixedWindow" class="flex items-center justify-end gap-3.5">
          <button
            v-for="range in timeRanges"
            :key="range.value"
            class="font-mono rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-4 transition-colors duration-150"
            :class="activeRange === range.value ? 'border-white text-white' : 'border-border text-text-2 hover:border-border-2 hover:text-white'"
            @click="setTimeRange(range.value)"
          >
            {{ range.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { extent } from "d3-array";
import { scaleLinear } from "d3-scale";
import { curveMonotoneX, line } from "d3-shape";

const props = defineProps({
  tokens: { type: Array, required: true },
  outcomeTitle: { type: String, default: undefined },
  livePoint: { type: Object, default: null },
  windowStartMs: { type: Number, default: null },
  windowEndMs: { type: Number, default: null },
  defaultRange: { type: String, default: null },
  endLabels: { type: Boolean, default: false },
});

const emit = defineEmits(["hover-value"]);

const CHART_HEIGHT = 300;
const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#db2777", "#ca8a04"];
const END_LABEL_AREA = { wide: 104, narrow: 76 };
const Y_AXIS_AREA = 36;
const END_LABEL_H = 44;
const END_LABEL_GAP = 8;

const chartContainer = ref(null);
const chartWidth = ref(0);
const activeRange = ref(props.windowStartMs ? "1h" : props.defaultRange || "max");
const loading = ref(true);
const chartError = ref(false);

const hoveredValues = ref([]);
const hoveredDate = ref("");
const lastPrices = ref([]);
const lastTimestamp = ref(null);
const isHovering = ref(false);
const hoverX = ref(null);
const hoverLabelX = ref(null);
const hoverLabelY = ref(null);
const hoverLabels = ref([]);
const timeline = ref([]);
const seriesData = ref([]);
const animationKey = ref(0);

const lastDateLabel = computed(() => (lastTimestamp.value ? formatChartDate(lastTimestamp.value) : ""));
const singleOutcomeLabel = computed(() => props.outcomeTitle || props.tokens[0]?.label || "Yes");
const hasChartData = computed(() => seriesData.value.some((s) => s.data.length > 0));
const fixedWindow = computed(() => props.windowStartMs != null && props.windowEndMs != null);

const seriesColor = (i) => props.tokens[i]?.color || COLORS[i % COLORS.length] || COLORS[0];

const pct = (p) => Math.round(p * 10000) / 100;
const labelFor = (i) => props.tokens[i]?.label || props.outcomeTitle || `Outcome ${i + 1}`;
const emptySeries = (i) => ({ tokenId: props.tokens[i]?.tokenId || String(i), text: labelFor(i), color: seriesColor(i), data: [], last: null });
const stackY = (items, h, gap, bottom) => {
  items.sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i += 1) items[i].y = Math.max(items[i].y, items[i - 1].y + h + gap);
  const overflow = items.length ? items[items.length - 1].y - bottom : 0;
  if (overflow > 0) items.forEach((x) => (x.y -= overflow));
  return items;
};

const timeRanges = [
  { label: "1H", value: "1h" },
  { label: "3H", value: "3h" },
  { label: "6H", value: "6h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "1M", value: "1m" },
  { label: "ALL", value: "max" },
];

const RANGE_SECONDS = { "1h": 3600, "3h": 10800, "6h": 21600, "1d": 86400, "1w": 604800, "1m": 2592000 };

const UPSTREAM_INTERVALS = new Set(["1h", "6h", "1d", "1w", "1m", "max"]);

const rangeLabel = computed(() => (fixedWindow.value ? "Market window" : timeRanges.find((r) => r.value === activeRange.value)?.label || ""));

let resizeObserver = null;

const TAG_HEIGHT = 26;
const TAG_GAP = 5;
const TAG_GUTTER = 8;
const TAG_MAX_TEXT_WIDTH = 140;

const chartMargin = computed(() => (props.endLabels ? { top: 10, right: (chartWidth.value > 0 && chartWidth.value < 520 ? END_LABEL_AREA.narrow : END_LABEL_AREA.wide) + Y_AXIS_AREA + 12, bottom: 30, left: 8 } : { top: 10, right: 46, bottom: 30, left: 8 }));

const chartPlot = computed(() => {
  const m = chartMargin.value;
  const w = Math.max(chartWidth.value, m.left + m.right + 1);
  const h = CHART_HEIGHT - m.top - m.bottom;
  return { top: m.top, right: w - m.right, bottom: m.top + h, left: m.left, width: w - m.left - m.right, height: h };
});

const allPoints = computed(() => seriesData.value.flatMap((s) => s.data));

const xScale = computed(() => {
  const [a, b] = fixedWindow.value ? [(props.windowStartMs ?? 0) / 1000, (props.windowEndMs ?? 0) / 1000] : extent(timeline.value);
  const min = a ?? 0;
  return scaleLinear()
    .domain([min, Math.max(b ?? min + 1, min + 1)])
    .range([chartPlot.value.left, chartPlot.value.right]);
});

const yScale = computed(() => {
  let [min = 0, max = 100] = extent(allPoints.value.map((p) => p.value));
  if (max === min) [min, max] = [min - 5, max + 5];
  const range = Math.max(max - min, 1);
  if (range < 18) {
    const mid = (min + max) / 2;
    min = mid - 9;
    max = mid + 9;
  } else {
    min -= range * 0.12;
    max += range * 0.12;
  }
  return scaleLinear()
    .domain([clamp(Math.floor(min), 0, 100), clamp(Math.ceil(max), 0, 100)])
    .range([chartPlot.value.bottom, chartPlot.value.top])
    .nice(4);
});

const pathBuilder = computed(() =>
  line()
    .x((p) => xScale.value(p.time))
    .y((p) => yScale.value(p.value))
    .curve(curveMonotoneX),
);

const renderedSeries = computed(() =>
  seriesData.value.map((s) => {
    const l = s.last;
    return { ...s, path: pathBuilder.value(s.data) || "", lastX: l ? xScale.value(l.time) : chartPlot.value.left, lastY: l ? yScale.value(l.value) : chartPlot.value.bottom };
  }),
);

const renderedEndpoints = computed(() => renderedSeries.value.filter((s) => s.last !== null));

const endLabelItems = computed(() => {
  if (!props.endLabels) return [];
  const plot = chartPlot.value;
  const half = END_LABEL_H / 2;
  return stackY(
    renderedSeries.value.filter((s) => s.last !== null).map((s, i) => ({ tokenId: s.tokenId || String(i), label: s.text || labelFor(i), color: s.color, value: s.last.value, y: clamp(s.lastY, plot.top + half, plot.bottom - half) })),
    END_LABEL_H,
    END_LABEL_GAP,
    CHART_HEIGHT - half,
  );
});

const yTicks = computed(() => yScale.value.ticks(4).map((v) => ({ value: v, label: `${Math.round(v)}%`, y: yScale.value(v) })));

const xTicks = computed(() => {
  if (!fixedWindow.value && !timeline.value.length) return [];
  const [min, max] = xScale.value.domain();
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];
  const span = max - min;
  const n = chartWidth.value < 520 ? 3 : 4;
  const out = [];
  let prev = null;
  for (let i = 0; i < n; i += 1) {
    const v = min + (span * i) / (n - 1);
    const label = formatAxisDate(v, span);
    if (label !== prev) out.push({ value: v, label, x: xScale.value(v) });
    prev = label;
  }
  return out;
});

const hoverPoints = computed(() => {
  const t = getHoveredTime();
  if (t == null) return [];
  return seriesData.value.flatMap((s, i) => {
    const p = findPointForTime(s.data, t);
    return p ? [{ tokenId: s.tokenId || String(i), color: s.color, y: yScale.value(p.value) }] : [];
  });
});

const formatChartDate = (ts) => new Date(ts * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const formatAxisDate = (ts, span = 0) => {
  const d = new Date(ts * 1000);
  return span > 0 && span <= 172800 ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const estimateTagWidth = (text, value) => Math.ceil(32 + Math.min(text.length * 7.2, TAG_MAX_TEXT_WIDTH) + `${Math.round(value)}%`.length * 7.2);
const getHoveredTime = () => (hoverX.value === null || !timeline.value.length ? null : findNearestTime(xScale.value.invert(hoverX.value)));
const findNearestTime = (ts) => (timeline.value.length ? timeline.value.reduce((best, t) => (Math.abs(t - ts) < Math.abs(best - ts) ? t : best), timeline.value[0]) : null);
const findPointForTime = (points, time) => points.find((p) => p.time === time) || null;

function updateHoverLabels(pointX) {
  const w = chartWidth.value || 0;
  const lo = TAG_HEIGHT / 2 + TAG_GUTTER;
  const labels = seriesData.value
    .map((s, i) => {
      const v = hoveredValues.value[i];
      return v == null ? null : { tokenId: s.tokenId || String(i), text: labelFor(i), value: v, color: s.color, y: clamp(yScale.value(v), lo, CHART_HEIGHT - lo) };
    })
    .filter((l) => l !== null);
  const widest = Math.max(...labels.map((l) => estimateTagWidth(l.text, l.value)), TAG_GUTTER);
  const right = Math.max(TAG_GUTTER, w - widest - TAG_GUTTER);
  const x = pointX + 14 + widest > w ? clamp(pointX - widest - 14, TAG_GUTTER, right) : clamp(pointX + 14, TAG_GUTTER, right);
  hoverLabels.value = stackY(
    labels.map((l) => ({ ...l, x })),
    TAG_HEIGHT,
    TAG_GAP,
    CHART_HEIGHT - lo,
  );
}

function resetChart() {
  timeline.value = [];
  seriesData.value = [];
  lastPrices.value = [];
  lastTimestamp.value = null;
  loading.value = false;
}
function rangeQuery(token, interval) {
  let startTs, endTs;
  if (fixedWindow.value) {
    startTs = Math.floor((props.windowStartMs ?? 0) / 1000);
    endTs = Math.ceil((props.windowEndMs ?? 0) / 1000);
  } else if (Number.isFinite(token.startTs) && Number.isFinite(token.endTs)) {
    endTs = token.endTs;
    startTs = interval === "max" ? token.startTs : Math.max(token.startTs, token.endTs - (RANGE_SECONDS[interval] ?? 0));
  } else if (!UPSTREAM_INTERVALS.has(interval) && RANGE_SECONDS[interval]) {
    endTs = Math.floor(Date.now() / 1000);
    startTs = endTs - RANGE_SECONDS[interval];
  }
  return startTs !== undefined && endTs !== undefined ? `&startTs=${startTs}&endTs=${endTs}` : "";
}

async function loadChartData(interval) {
  if (!props.tokens.length) {
    resetChart();
    return;
  }
  loading.value = true;
  chartError.value = false;
  clearHover();

  const results = await Promise.allSettled(props.tokens.map((token) => $fetch(`/api/market/history?tokenId=${encodeURIComponent(token.tokenId)}&interval=${interval}${rangeQuery(token, interval)}`)));
  let anySuccess = false;
  const newLastPrices = [];
  const allTimes = new Set();
  const sortedHistories = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value?.history?.length) {
      const seen = new Set();
      const sorted = result.value.history
        .slice()
        .sort((a, b) => a.t - b.t)
        .filter((p) => (seen.has(p.t) ? false : (seen.add(p.t), true)));
      sorted.forEach((p) => allTimes.add(p.t));
      sortedHistories.push(sorted);
      const last = sorted[sorted.length - 1];
      newLastPrices.push(last ? pct(last.p) : null);
      anySuccess = true;
    } else {
      sortedHistories.push(null);
      newLastPrices.push(null);
    }
  }

  const nextTimeline = Array.from(allTimes).sort((a, b) => a - b);
  timeline.value = nextTimeline;
  lastTimestamp.value = nextTimeline.length ? nextTimeline[nextTimeline.length - 1] : null;

  seriesData.value = sortedHistories.map((sorted, index) => {
    if (!sorted || !nextTimeline.length) return emptySeries(index);
    const byTime = new Map(sorted.map((p) => [p.t, pct(p.p)]));
    let lastKnown = null;
    const data = nextTimeline.flatMap((time) => {
      const direct = byTime.get(time);
      if (direct != null) return [{ time, value: (lastKnown = direct) }];
      return lastKnown == null ? [] : [{ time, value: lastKnown }];
    });
    return { ...emptySeries(index), data, last: data[data.length - 1] || null };
  });

  lastPrices.value = newLastPrices;
  chartError.value = !anySuccess;
  loading.value = false;
  animationKey.value += 1;
  appendLivePoint(props.livePoint ?? null);
}

function appendLivePoint(point) {
  if (!point || !Number.isFinite(point.time) || !Number.isFinite(point.value) || !seriesData.value[0]) return;
  const start = fixedWindow.value ? (props.windowStartMs ?? 0) / 1000 : Number.NEGATIVE_INFINITY;
  const end = fixedWindow.value ? (props.windowEndMs ?? Number.POSITIVE_INFINITY) / 1000 : Number.POSITIVE_INFINITY;
  if (point.time < start || point.time > end) return;

  const first = seriesData.value[0];
  const data = first.data.slice();
  const last = data[data.length - 1];
  if (last && point.time < last.time) return;
  if (last && (point.time === last.time || (last.value === point.value && point.time - last.time < 1))) data[data.length - 1] = point;
  else data.push(point);

  const trimmed = data.slice(-2_000);
  seriesData.value = [{ ...first, data: trimmed, last: trimmed[trimmed.length - 1] ?? null }, ...seriesData.value.slice(1)];
  const times = timeline.value.slice();
  if (!times.length || point.time > times[times.length - 1]) times.push(point.time);
  timeline.value = times.slice(-2_000);
  lastPrices.value = [point.value, ...lastPrices.value.slice(1)];
  lastTimestamp.value = point.time;
}

async function setTimeRange(interval) {
  activeRange.value = interval;
  await loadChartData(interval);
}

function handlePointerMove(event) {
  if (!chartContainer.value || !timeline.value.length) return;
  const rect = chartContainer.value.getBoundingClientRect();
  const pointX = clamp(event.clientX - rect.left, chartPlot.value.left, chartPlot.value.right);
  const nearestTime = findNearestTime(xScale.value.invert(pointX));
  if (nearestTime == null) return;

  const values = seriesData.value.map((s) => findPointForTime(s.data, nearestTime)?.value ?? null);
  hoveredValues.value = values;
  hoveredDate.value = formatChartDate(nearestTime);
  hoverX.value = xScale.value(nearestTime);
  isHovering.value = true;

  if (props.tokens.length === 1) {
    const val = values[0];
    const gutter = 8;
    hoverLabelX.value = clamp(pointX + 12, gutter, Math.max(gutter, chartWidth.value - 104 - gutter));
    hoverLabelY.value = val != null ? yScale.value(val) : null;
    emit("hover-value", val ?? null);
  } else {
    hoverLabelX.value = null;
    hoverLabelY.value = null;
    updateHoverLabels(pointX);
  }
}

function clearHover() {
  hoveredValues.value = [];
  hoveredDate.value = "";
  isHovering.value = false;
  hoverX.value = null;
  hoverLabelX.value = null;
  hoverLabelY.value = null;
  hoverLabels.value = [];
  if (props.tokens.length === 1) emit("hover-value", null);
}

watch(
  () => props.tokens.map((t) => t.tokenId).join(","),
  async (a, b) => {
    if (a === b) return;
    lastPrices.value = [];
    await loadChartData(activeRange.value);
  },
);
watch(
  () => (props.livePoint ? `${props.livePoint.time}:${props.livePoint.value}` : ""),
  () => appendLivePoint(props.livePoint ?? null),
);

onMounted(async () => {
  if (!chartContainer.value) return;
  chartWidth.value = chartContainer.value.clientWidth || 0;
  resizeObserver = new ResizeObserver((entries) => {
    chartWidth.value = entries[0]?.contentRect.width || chartContainer.value?.clientWidth || 0;
  });
  resizeObserver.observe(chartContainer.value);
  await loadChartData(activeRange.value);
});

onUnmounted(() => resizeObserver?.disconnect());
</script>

<style scoped>
.price-chart__frame {
  position: relative;
  touch-action: none;
}

.price-chart__svg {
  display: block;
  overflow: visible;
}

.price-chart__grid line {
  stroke: var(--color-border);
  stroke-width: 1;
}

.price-chart__axis text {
  fill: var(--color-text-3);
  font-family: "IBM Plex Mono", monospace;
  font-size: 10px;
  font-weight: 500;
}

.price-chart__line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: price-chart-draw 760ms cubic-bezier(0.2, 0.72, 0.1, 1) forwards;
}

.price-chart__sweep {
  fill: rgba(240, 240, 240, 0.05);
  opacity: 0;
  filter: blur(12px);
  transform: translateX(0);
  animation: price-chart-sweep 760ms cubic-bezier(0.2, 0.72, 0.1, 1) forwards;
}

.price-chart__endpoints circle {
  stroke: var(--color-bg);
  stroke-width: 2;
}

.price-chart__hover line {
  stroke: var(--color-border-2);
  stroke-width: 1;
}

.price-chart__hover circle {
  stroke: var(--color-bg);
  stroke-width: 2;
}

.price-chart__hover-label {
  transform: translateY(-50%);
}

.price-chart__tag {
  width: max-content;
  max-width: 208px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--color-bg) 72%, transparent);
}

.price-chart__tag--single {
  border-left: 2px solid var(--series-color);
}

@keyframes price-chart-draw {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes price-chart-sweep {
  0% {
    opacity: 0;
    transform: translateX(0);
  }

  14%,
  82% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translateX(var(--plot-width));
  }
}

@media (prefers-reduced-motion: reduce) {
  .price-chart__line,
  .price-chart__sweep {
    animation: none;
    opacity: 0;
    stroke-dashoffset: 0;
  }
}
</style>
