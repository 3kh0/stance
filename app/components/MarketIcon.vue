<script setup lang="ts">
const props = defineProps<{
  src?: string | null;
  alt?: string;
}>();

const invert = ref(false);

const cache = ((globalThis as unknown as { __pmIconInvert?: Map<string, boolean> }).__pmIconInvert ??= new Map<string, boolean>());

function analyze(src: string) {
  if (!import.meta.client) return;
  if (cache.has(src)) {
    invert.value = cache.get(src)!;
    return;
  }
  const probe = new Image();
  probe.onload = () => {
    try {
      const s = 16;
      const c = document.createElement("canvas");
      c.width = c.height = s;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(probe, 0, 0, s, s);
      const { data } = ctx.getImageData(0, 0, s, s);
      let lum = 0,
        sat = 0,
        opaque = 0,
        bright = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3]! < 16) continue;
        const r = data[i]!,
          g = data[i + 1]!,
          b = data[i + 2]!;
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        lum += l;
        sat += Math.max(r, g, b) - Math.min(r, g, b);
        if (l > 64) bright++;
        opaque++;
      }
      if (!opaque) return;
      const inv = lum / opaque < 24 && sat / opaque < 12 && bright / opaque < 0.01;
      cache.set(src, inv);
      invert.value = inv;
    } catch {}
  };
  probe.src = `/api/icon?url=${encodeURIComponent(src)}`;
}

watch(
  () => props.src,
  (src) => {
    invert.value = false;
    if (src) analyze(src);
  },
  { immediate: true },
);
</script>

<template>
  <NuxtImg v-if="src" :src="src" :alt="alt" width="128" loading="lazy" :class="{ 'pm-icon-invert': invert }" />
</template>

<style scoped>
.pm-icon-invert {
  filter: invert(1) hue-rotate(180deg);
  background-color: transparent !important;
  border-color: transparent !important;
}
</style>
