<script setup lang="ts">
let count = 0;
let prevOverflow = "";

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    panelClass?: string;
    closeOnBackdrop?: boolean;
    ariaLabel?: string;
    ariaLabelledby?: string;
  }>(),
  { panelClass: "", closeOnBackdrop: true, ariaLabel: "Dialog", ariaLabelledby: undefined },
);

const emit = defineEmits<{ close: [] }>();

const panelRef = ref<HTMLDivElement | null>(null);
const prevFocus = ref<HTMLElement | null>(null);

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

const getFocusable = (): HTMLElement[] => (panelRef.value ? Array.from(panelRef.value.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute("aria-hidden")) : []);

function onKeydown(e: KeyboardEvent) {
  if (!props.isOpen) return;
  if (e.key === "Escape") {
    e.preventDefault();
    emit("close");
    return;
  }
  if (e.key !== "Tab") return;
  const f = getFocusable();
  if (!f.length) return;
  const first = f[0]!,
    last = f[f.length - 1]!;
  const a = document.activeElement as HTMLElement | null;
  if (e.shiftKey && (a === first || !panelRef.value?.contains(a))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && a === last) {
    e.preventDefault();
    first.focus();
  }
}

function lock() {
  if (typeof document === "undefined") return;
  if (count === 0) {
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  count += 1;
}

function unlock() {
  if (typeof document === "undefined" || count === 0) return;
  count -= 1;
  if (count === 0) {
    document.body.style.overflow = prevOverflow;
    prevOverflow = "";
  }
}

watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      prevFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      lock();
      document.addEventListener("keydown", onKeydown);
      await nextTick();
      (getFocusable()[0] ?? panelRef.value)?.focus();
    } else {
      document.removeEventListener("keydown", onKeydown);
      unlock();
      prevFocus.value?.focus();
      prevFocus.value = null;
    }
  },
);

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  if (props.isOpen) unlock();
});

const onBackdropClick = (e: MouseEvent) => {
  if (props.closeOnBackdrop && e.target === e.currentTarget) emit("close");
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" mode="out-in">
      <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 max-sm:items-end" @click="onBackdropClick">
        <div
          ref="panelRef"
          :class="['modal__panel w-full max-w-110 mx-4 overflow-hidden rounded-xl border border-border bg-(--color-card) p-8 max-sm:mx-0 max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 max-sm:p-6 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]', panelClass]"
          role="dialog"
          aria-modal="true"
          :aria-label="ariaLabelledby ? undefined : ariaLabel"
          :aria-labelledby="ariaLabelledby"
          tabindex="-1"
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal__panel {
  animation: modal-in 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-leave-active .modal__panel {
  animation: modal-out 300ms ease;
}

@keyframes modal-in {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes modal-out {
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(0.95);
    opacity: 0;
  }
}

@media (max-width: 639px) {
  .modal__panel {
    animation: modal-in-sheet 300ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .modal-leave-active .modal__panel {
    animation: modal-out-sheet 220ms ease-in;
  }
}

@keyframes modal-in-sheet {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes modal-out-sheet {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal__panel,
  .modal-leave-active .modal__panel {
    animation: none;
  }
}
</style>
