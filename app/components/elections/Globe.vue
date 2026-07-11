<script setup lang="ts">
import type { GeoPath, GeoPermissibleObjects, GeoProjection } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { countryName, numericToIso3 } from "~/utils/elections";
import type { CountryTally } from "~/composables/useElectionsFeed";

const props = defineProps<{
  countries: CountryTally[];
  selected: string | null;
}>();

const emit = defineEmits<{
  "update:selected": [iso: string | null];
}>();

const container = useTemplateRef<HTMLDivElement>("container");
const { current: theme } = useTheme();
const size = ref(0);

const features = shallowRef<Feature<Geometry, { name?: string }>[]>([]);
let projection: GeoProjection | null = null;
let pathGen: GeoPath | null = null;

const rotateVersion = ref(0);
const ready = ref(false);

const hoveredIso = ref<string | null>(null);
const reduceMotion = ref(false);
let dragging = false;
let moved = false;
let rafId: number | null = null;
let resizeObserver: ResizeObserver | null = null;

const discRadius = ref(0);
let centroids = new Map<string, [number, number]>();
let anim: { fromRot: [number, number, number]; toRot: [number, number, number]; fromScale: number; toScale: number; start: number; dur: number } | null = null;
const FOCUS_ZOOM = 2.1;
const FOCUS_MS = 760;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface GlobeColors {
  ocean: string;
  graticule: string;
  sphere: string;
  countryStroke: string;
  landInert: string;
  landMin: string;
  landMax: string;
  landHover: string;
  landSelected: string;
}

const globeColors = ref<GlobeColors>({
  ocean: "#0a0a0a",
  graticule: "#1c1c1c",
  sphere: "#252525",
  countryStroke: "#0a0a0a",
  landInert: "#161616",
  landMin: "#161616",
  landMax: "#6a6a6a",
  landHover: "#3a3a3a",
  landSelected: "#f0f0f0",
});

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function parseColor(value: string, fallback: Rgb): Rgb {
  const color = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return { r: Number.parseInt(color.slice(1, 3), 16), g: Number.parseInt(color.slice(3, 5), 16), b: Number.parseInt(color.slice(5, 7), 16) };
  }

  const rgb = color.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  return fallback;
}

function mixColor(from: Rgb, to: Rgb, amount: number): string {
  const t = clamp01(amount);
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r} ${g} ${b})`;
}

function readThemeColors() {
  if (!import.meta.client) return;

  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: Rgb) => parseColor(styles.getPropertyValue(name), fallback);
  const bg = read("--color-bg", { r: 0, g: 0, b: 0 });
  const surface = read("--color-surface", { r: 12, g: 12, b: 12 });
  const surface2 = read("--color-surface-2", { r: 17, g: 17, b: 17 });
  const border = styles.getPropertyValue("--color-border").trim() || "#1c1c1c";
  const border2 = styles.getPropertyValue("--color-border-2").trim() || "#252525";
  const text = read("--color-text", { r: 224, g: 224, b: 224 });
  const selected = styles.getPropertyValue("--color-white").trim() || "#f0f0f0";

  globeColors.value = {
    ocean: mixColor(bg, surface, 0.65),
    graticule: border,
    sphere: border2,
    countryStroke: mixColor(bg, surface, 0.45),
    landInert: mixColor(surface, text, 0.08),
    landMin: mixColor(surface, text, 0.08),
    landMax: mixColor(surface, text, 0.44),
    landHover: mixColor(surface2, text, 0.28),
    landSelected: selected,
  };
}

function isoForFeature(feature: Feature<Geometry, { name?: string }>): string | null {
  const numeric = String(feature.id ?? "").padStart(3, "0");
  return numericToIso3[numeric] ?? null;
}

const countByIso = computed(() => {
  const map = new Map<string, number>();
  for (const c of props.countries) map.set(c.iso, c.count);
  return map;
});
const maxCount = computed(() => Math.max(1, ...props.countries.map((c) => c.count)));

function fillFor(iso: string | null): string {
  const colors = globeColors.value;
  if (iso && iso === props.selected) return colors.landSelected;
  if (iso && iso === hoveredIso.value) return colors.landHover;
  if (!iso) return colors.landInert;
  const count = countByIso.value.get(iso) ?? 0;
  if (count === 0) return colors.landMin;
  return mixColor(parseColor(colors.landMin, { r: 22, g: 22, b: 22 }), parseColor(colors.landMax, { r: 106, g: 106, b: 106 }), count / maxCount.value);
}

interface RenderedCountry {
  key: string;
  iso: string | null;
  name: string;
  d: string;
  fill: string;
  interactive: boolean;
}

const renderedCountries = computed<RenderedCountry[]>(() => {
  void rotateVersion.value;
  void size.value;
  if (!pathGen || !ready.value) return [];
  const out: RenderedCountry[] = [];
  for (const feature of features.value) {
    const d = pathGen(feature as GeoPermissibleObjects);
    if (!d) continue;
    const iso = isoForFeature(feature);
    out.push({ key: String(feature.id), iso, name: iso ? countryName(iso) : (feature.properties?.name ?? ""), d, fill: fillFor(iso), interactive: Boolean(iso) });
  }
  return out;
});

const spherePath = computed(() => {
  void rotateVersion.value;
  void size.value;
  return pathGen && ready.value ? pathGen({ type: "Sphere" } as GeoPermissibleObjects) : null;
});

const graticulePath = ref<string | null>(null);
let graticule: GeoPermissibleObjects | null = null;
function refreshGraticule() {
  graticulePath.value = pathGen && graticule ? pathGen(graticule) : null;
}

const baseScale = () => size.value / 2 - 2;
const isCountryFocused = () => Boolean(props.selected && centroids.has(props.selected));

function setScale(s: number) {
  if (projection) projection.scale(s);
  discRadius.value = s;
}

function bumpFrame() {
  rotateVersion.value++;
  refreshGraticule();
}

function applyProjection() {
  if (!projection || size.value <= 0) return;
  projection.translate([size.value / 2, size.value / 2]);
  setScale(baseScale() * (isCountryFocused() ? FOCUS_ZOOM : 1));
  if (isCountryFocused()) recenterOnSelected();
}

function recenterOnSelected() {
  const c = props.selected ? centroids.get(props.selected) : null;
  if (!projection || !c) return;
  projection.rotate([-c[0], -c[1], 0]);
  bumpFrame();
}

function shortestDelta(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function lerpRot(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + shortestDelta(a[0], b[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function startAnim(toRot: [number, number, number], toScale: number) {
  if (!projection) return;
  if (reduceMotion.value) {
    projection.rotate(toRot);
    setScale(toScale);
    bumpFrame();
    return;
  }
  anim = { fromRot: projection.rotate(), toRot, fromScale: discRadius.value, toScale, start: performance.now(), dur: FOCUS_MS };
  if (rafId === null) rafId = requestAnimationFrame(tick);
}

function tick(now: number) {
  rafId = requestAnimationFrame(tick);
  if (!projection) return;
  if (anim) {
    const t = Math.min(1, (now - anim.start) / anim.dur);
    const e = 1 - Math.pow(1 - t, 3);
    projection.rotate(lerpRot(anim.fromRot, anim.toRot, e));
    setScale(anim.fromScale + (anim.toScale - anim.fromScale) * e);
    bumpFrame();
    if (t >= 1) anim = null;
    return;
  }
  if (isCountryFocused() || reduceMotion.value || dragging || hoveredIso.value) return;
  const [lambda, phi, gamma] = projection.rotate();
  projection.rotate([lambda + 0.18, phi, gamma]);
  bumpFrame();
}

watch(
  () => props.selected,
  (iso) => {
    if (!projection || !ready.value) return;
    const target = iso ? centroids.get(iso) : null;
    if (target) startAnim([-target[0], -target[1], 0], baseScale() * FOCUS_ZOOM);
    else startAnim(projection.rotate(), baseScale());
  },
);

function onPointerDown(event: PointerEvent) {
  if (!projection) return;
  anim = null;
  dragging = true;
  moved = false;
  (event.target as Element).setPointerCapture?.(event.pointerId);
  const start = { x: event.clientX, y: event.clientY, rotate: projection.rotate() };
  const sensitivity = 0.3;

  const onMove = (e: PointerEvent) => {
    if (!projection) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    const phi = Math.max(-90, Math.min(90, start.rotate[1] - dy * sensitivity));
    projection.rotate([start.rotate[0] + dx * sensitivity, phi, start.rotate[2]]);
    bumpFrame();
  };
  const onUp = (e: PointerEvent) => {
    dragging = false;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    (event.target as Element).releasePointerCapture?.(e.pointerId);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function onCountryClick(iso: string | null) {
  if (moved || !iso) return;
  emit("update:selected", props.selected === iso ? null : iso);
}

onMounted(async () => {
  if (!import.meta.client || !container.value) return;
  reduceMotion.value = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  readThemeColors();

  const measure = () => {
    const rect = container.value?.getBoundingClientRect();
    size.value = Math.floor(Math.min(rect?.width ?? 0, rect?.height ?? Infinity)) || 0;
    applyProjection();
    refreshGraticule();
  };
  measure();
  resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(container.value);

  const [geo, topo, atlas] = await Promise.all([import("d3-geo"), import("topojson-client"), $fetch<unknown>("/geo/countries-110m.json")]);

  const topology = atlas as any;
  const collection = topo.feature(topology, topology.objects.countries) as unknown as FeatureCollection<Geometry, { name?: string }>;
  features.value = collection.features;

  const cent = new Map<string, [number, number]>();
  for (const feature of collection.features) {
    const iso = isoForFeature(feature);
    if (iso && !cent.has(iso)) cent.set(iso, geo.geoCentroid(feature) as [number, number]);
  }
  centroids = cent;

  projection = geo.geoOrthographic().clipAngle(90).rotate([-10, -25, 0]);
  pathGen = geo.geoPath(projection);
  graticule = geo.geoGraticule10() as GeoPermissibleObjects;
  applyProjection();
  refreshGraticule();
  ready.value = true;
  rotateVersion.value++;
  if (!reduceMotion.value) rafId = requestAnimationFrame(tick);
});

watch(theme, async () => {
  await nextTick();
  readThemeColors();
});

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  resizeObserver?.disconnect();
});
</script>

<template>
  <div class="relative mx-auto w-full max-w-100">
    <div ref="container" class="elections-globe relative aspect-square w-full" @pointerdown="onPointerDown">
      <svg v-if="ready && size > 0" :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" class="elections-globe__svg" role="img" aria-label="World elections globe">
        <circle :cx="size / 2" :cy="size / 2" :r="discRadius" :fill="globeColors.ocean" :stroke="globeColors.graticule" stroke-width="1" />
        <path v-if="graticulePath" :d="graticulePath" fill="none" :stroke="globeColors.graticule" stroke-width="0.5" opacity="0.6" />
        <path
          v-for="country in renderedCountries"
          :key="country.key"
          :d="country.d"
          :fill="country.fill"
          :stroke="globeColors.countryStroke"
          stroke-width="0.4"
          :class="['elections-globe__country', { 'elections-globe__country--interactive': country.interactive }]"
          @click="onCountryClick(country.iso)"
          @pointerenter="country.interactive ? (hoveredIso = country.iso) : null"
          @pointerleave="hoveredIso = null"
        />
        <circle v-if="spherePath" :cx="size / 2" :cy="size / 2" :r="discRadius" fill="none" :stroke="globeColors.sphere" stroke-width="1" />
      </svg>

      <div v-else class="absolute inset-0 m-auto aspect-square w-full rounded-full pm-skeleton" />
    </div>
  </div>
</template>

<style scoped>
.elections-globe {
  touch-action: none;
  cursor: grab;
}

.elections-globe:active {
  cursor: grabbing;
}

.elections-globe__svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.elections-globe__country {
  transition: fill 150ms ease;
}

.elections-globe__country--interactive {
  cursor: pointer;
}
</style>
