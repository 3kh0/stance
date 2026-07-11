<script setup lang="ts">
const props = withDefaults(defineProps<{ count?: number; seed?: number }>(), { count: 80, seed: 1337 });

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
}

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const stars = computed<Star[]>(() => {
  const r = mulberry32(props.seed);
  return Array.from({ length: props.count }, () => {
    const bright = r() > 0.85;
    return { x: r() * 100, y: r() * 100, size: bright ? 1.6 + r() * 1.1 : 0.6 + r() * 1, opacity: bright ? 0.45 + r() * 0.3 : 0.12 + r() * 0.28, delay: r() * 6 };
  });
});
</script>

<template>
  <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <span v-for="(star, i) in stars" :key="i" class="ef-star" :style="{ left: `${star.x}%`, top: `${star.y}%`, width: `${star.size}px`, height: `${star.size}px`, '--o': star.opacity, animationDelay: `${star.delay}s` }" />
  </div>
</template>

<style scoped>
.ef-star {
  position: absolute;
  border-radius: 9999px;
  background: var(--color-white);
  opacity: var(--o);
  animation: ef-twinkle 5s ease-in-out infinite;
}

@keyframes ef-twinkle {
  0%,
  100% {
    opacity: var(--o);
  }
  50% {
    opacity: calc(var(--o) * 0.3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ef-star {
    animation: none;
    opacity: var(--o);
  }
}
</style>
