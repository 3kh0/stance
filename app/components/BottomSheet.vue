<script setup lang="ts">
const props = withDefaults(defineProps<{ open: boolean; ariaLabel?: string }>(), { ariaLabel: "Sheet" });
const emit = defineEmits<{ close: [] }>();

const panelRef = ref<HTMLElement | null>(null);
const dragY = ref(0);
const dragging = ref(false);
let startY = 0;
let startTime = 0;
let prevOverflow = "";

function lock(on: boolean) {
  if (typeof document === "undefined") return;
  if (on) {
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = prevOverflow;
    prevOverflow = "";
  }
}

watch(
  () => props.open,
  (open) => {
    lock(open);
    if (open) {
      dragY.value = 0;
      dragging.value = false;
      nextTick(() => panelRef.value?.focus());
    }
  },
);

onBeforeUnmount(() => {
  if (props.open) lock(false);
});

function onTouchStart(e: TouchEvent) {
  const t = e.touches[0];
  if (!t) return;
  dragging.value = true;
  startY = t.clientY;
  startTime = e.timeStamp;
}

function onTouchMove(e: TouchEvent) {
  const t = e.touches[0];
  if (dragging.value && t) dragY.value = Math.max(0, t.clientY - startY);
}

function onTouchEnd(e: TouchEvent) {
  if (!dragging.value) return;
  dragging.value = false;
  if (dragY.value > 96 || dragY.value / Math.max(e.timeStamp - startTime, 1) > 0.5) emit("close");
  dragY.value = 0;
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    e.preventDefault();
    emit("close");
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="fixed inset-0 z-50 flex flex-col justify-end" @keydown="onKeydown">
        <div class="sheet__backdrop absolute inset-0 bg-black/75" aria-hidden="true" @click="emit('close')" />
        <div
          ref="panelRef"
          class="sheet__panel relative flex max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
          :class="{ 'sheet__panel--dragging': dragging }"
          :style="dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined"
          role="dialog"
          aria-modal="true"
          :aria-label="ariaLabel"
          tabindex="-1"
        >
          <div class="shrink-0 cursor-grab touch-none py-2.5 active:cursor-grabbing" @touchstart.passive="onTouchStart" @touchmove.passive="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd">
            <div class="mx-auto h-1 w-9 rounded-full bg-border-2" />
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet__panel,
.sheet-enter-active .sheet__panel {
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.sheet__panel--dragging {
  transition: none;
}

.sheet-leave-active .sheet__panel {
  transition: transform 220ms ease-in;
}

.sheet-enter-from .sheet__panel,
.sheet-leave-to .sheet__panel {
  transform: translateY(100%);
}

.sheet-enter-active .sheet__backdrop,
.sheet-leave-active .sheet__backdrop {
  transition: opacity 220ms ease;
}

.sheet-enter-from .sheet__backdrop,
.sheet-leave-to .sheet__backdrop {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .sheet__panel,
  .sheet-enter-active .sheet__panel,
  .sheet-leave-active .sheet__panel,
  .sheet-enter-active .sheet__backdrop,
  .sheet-leave-active .sheet__backdrop {
    transition: none;
  }
}
</style>
