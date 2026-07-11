<script setup lang="ts">
const props = defineProps<{
  lines: number[];
  activeLine: number | null;
}>();

const emit = defineEmits<{
  select: [line: number];
}>();

const activeIndex = computed(() => {
  if (props.activeLine === null) return 0;
  const i = props.lines.indexOf(props.activeLine);
  return i >= 0 ? i : 0;
});

const prev = () => {
  const i = activeIndex.value;
  if (i > 0) emit("select", props.lines[i - 1]!);
};
const next = () => {
  const i = activeIndex.value;
  if (i < props.lines.length - 1) emit("select", props.lines[i + 1]!);
};
const lineLabel = (n: number) => Math.abs(n);
</script>

<template>
  <div v-if="lines.length > 1" class="flex items-center gap-2 border-t border-border px-4 py-3">
    <button class="pm-focus grid h-6 w-6 shrink-0 place-items-center rounded text-text-3 transition-colors duration-150 hover:text-white disabled:opacity-30" :disabled="activeIndex <= 0" aria-label="Previous line" @click="prev">
      <Icon name="lucide:chevron-left" class="h-4 w-4" />
    </button>
    <div class="relative min-w-0 flex-1">
      <div class="flex items-end justify-between px-1">
        <button v-for="line in lines" :key="line" class="pm-focus font-mono relative flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold transition-colors duration-150" :class="line === activeLine ? 'text-white' : 'text-text-3 hover:text-text-2'" @click="emit('select', line)">
          <span>{{ lineLabel(line) }}</span>
          <span v-if="line === activeLine" class="h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-white" />
          <span v-else class="h-1.5" />
        </button>
      </div>
    </div>
    <button class="pm-focus grid h-6 w-6 shrink-0 place-items-center rounded text-text-3 transition-colors duration-150 hover:text-white disabled:opacity-30" :disabled="activeIndex >= lines.length - 1" aria-label="Next line" @click="next">
      <Icon name="lucide:chevron-right" class="h-4 w-4" />
    </button>
  </div>
</template>
