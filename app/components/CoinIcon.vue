<script setup lang="ts">
const props = withDefaults(defineProps<{ icon?: string; label: string; size?: number }>(), { size: 20 });
const monogram = computed(
  () =>
    props.label
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "?",
);
</script>

<template>
  <span class="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2 font-mono font-semibold text-text-3" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.42)}px` }">
    {{ monogram }}
    <Icon v-if="icon" :name="icon" class="absolute inset-0 h-full w-full" />
  </span>
</template>
