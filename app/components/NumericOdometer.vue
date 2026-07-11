<template>
  <TransitionGroup
    tag="span"
    :aria-label="ariaLabel"
    class="font-mono relative inline-flex items-baseline [clip-path:inset(0)] align-baseline tabular-nums whitespace-nowrap tracking-normal font-features-['tnum'_1,'kern'_0] [font-kerning:none]"
    enter-from-class="opacity-0 translate-y-[0.8em]"
    enter-active-class="[transition:opacity_200ms_ease,transform_320ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    leave-to-class="opacity-0 -translate-y-[0.6em]"
    leave-active-class="absolute [transition:opacity_150ms_ease,transform_200ms_ease] motion-reduce:transition-none"
  >
    <span v-for="(col, i) in columns" :key="col.key" class="inline-block">
      <span v-if="!col.isDigit" class="whitespace-pre">{{ col.char }}</span>
      <span v-else class="relative inline-block [clip-path:inset(0)]">
        <span class="invisible" aria-hidden="true">0</span>
        <span
          class="absolute top-0 left-0 flex w-full flex-col will-change-transform"
          :style="{
            transform: `translateY(-${col.val * 10}%)`,
            transition: reduceMotion || !isMounted ? 'none' : `transform 320ms cubic-bezier(0.22, 1, 0.36, 1) ${(columns.length - i - 1) * 30}ms`,
          }"
        >
          <span v-for="n in 10" :key="n" class="block text-center">{{ n - 1 }}</span>
        </span>
      </span>
    </span>
  </TransitionGroup>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    value: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }>(),
  { prefix: "", suffix: "", decimals: undefined, minimumFractionDigits: undefined, maximumFractionDigits: undefined },
);

const isMounted = ref(false);
const reduceMotion = ref(false);

onMounted(() => {
  reduceMotion.value = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => requestAnimationFrame(() => (isMounted.value = true)));
});

const { ariaLabel, columns } = useOdometer(() => props.value, { prefix: props.prefix, suffix: props.suffix, decimals: props.decimals, minimumFractionDigits: props.minimumFractionDigits, maximumFractionDigits: props.maximumFractionDigits });
</script>
