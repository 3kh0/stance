<template>
  <div ref="root" class="relative shrink-0">
    <button
      class="pm-focus inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[11px] font-bold text-text-2 transition-colors duration-150 hover:border-border-2 hover:text-white"
      type="button"
      aria-haspopup="listbox"
      :aria-expanded="open"
      aria-label="Choose candle outcome"
      @click="open = !open"
    >
      <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: selected?.color || '#888888' }" />
      <span class="max-w-32 overflow-hidden text-ellipsis whitespace-nowrap">{{ selected?.label || "Outcome" }}</span>
      <svg class="h-3 w-3 transition-transform duration-150" :class="{ 'rotate-180': open }" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="m3 4.5 3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <Transition name="series-menu">
      <div v-if="open" class="absolute right-0 top-10 z-40 w-64 overflow-hidden rounded-lg border border-border bg-[rgba(12,12,12,0.98)] shadow-[0_18px_60px_rgba(0,0,0,0.55)]" role="listbox" aria-label="Candle outcome">
        <div class="border-b border-border px-3 py-2.5">
          <span class="text-[10px] font-bold uppercase tracking-widest text-text-3">Candle outcome</span>
        </div>
        <div class="series-picker__options max-h-72 overflow-y-auto p-1.5">
          <button v-for="o in options" :key="o.tokenId" class="pm-focus flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[12px] transition-colors duration-100 hover:bg-surface-2" type="button" role="option" :aria-selected="o.tokenId === selectedId" @click="select(o.tokenId)">
            <span class="grid h-4 w-4 shrink-0 place-items-center rounded-full border" :class="o.tokenId === selectedId ? 'border-accent bg-accent text-accent-fg' : 'border-border-2 text-transparent'">
              <svg class="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="m2.25 6.25 2.15 2.1 5.35-5.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: o.color || '#888888' }" />
            <span class="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap" :class="o.tokenId === selectedId ? 'text-white' : 'text-text-2'">{{ o.label }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  options: Array<{ tokenId: string; label: string; color?: string }>;
  selectedId: string | null;
}>();

const emit = defineEmits<{ (e: "select", tokenId: string): void }>();

const root = ref<HTMLElement | null>(null);
const open = ref(false);
const selected = computed(() => props.options.find((o) => o.tokenId === props.selectedId) ?? null);
const select = (id: string) => {
  emit("select", id);
  open.value = false;
};
const onDoc = (e: MouseEvent) => {
  if (!root.value?.contains(e.target as Node)) open.value = false;
};
const onKey = (e: KeyboardEvent) => {
  if (e.key === "Escape") open.value = false;
};
onMounted(() => {
  document.addEventListener("click", onDoc);
  document.addEventListener("keydown", onKey);
});
onUnmounted(() => {
  document.removeEventListener("click", onDoc);
  document.removeEventListener("keydown", onKey);
});
</script>

<style scoped>
.series-picker__options {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-hover) transparent;
}

.series-menu-enter-active,
.series-menu-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.215, 0.61, 0.355, 1),
    transform 0.18s cubic-bezier(0.215, 0.61, 0.355, 1);
  transform-origin: top right;
  will-change: transform, opacity;
}

.series-menu-enter-from,
.series-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .series-menu-enter-active,
  .series-menu-leave-active {
    transition: none;
  }
}
</style>
