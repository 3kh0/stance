<template>
  <div class="inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Chart style">
    <button
      v-for="o in MODES"
      :key="o.value"
      type="button"
      class="pm-focus h-7 rounded-md px-2.5 text-[11px] font-bold transition-colors duration-150"
      :class="modelValue === o.value ? 'bg-surface-2 text-white shadow-sm' : 'text-text-3 hover:text-text-2'"
      :aria-pressed="modelValue === o.value"
      @click="emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
type ChartMode = "simple" | "advanced";
defineProps<{ modelValue: ChartMode }>();
const emit = defineEmits<{ "update:modelValue": [ChartMode] }>();
const MODES = [
  { value: "simple", label: "Line" },
  { value: "advanced", label: "Candles" },
] as const;
</script>
