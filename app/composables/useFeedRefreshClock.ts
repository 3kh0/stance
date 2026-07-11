import { onBeforeUnmount, onMounted, ref } from "vue";

export function useFeedRefreshClock(refresh: () => void, { tickMs = 1000, refreshMs = 5000 }: { tickMs?: number; refreshMs?: number } = {}) {
  const now = ref(Date.now());
  let clockTimer: ReturnType<typeof setInterval> | null = null;
  let priceTimer: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    clockTimer = setInterval(() => (now.value = Date.now()), tickMs);
    priceTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      refresh();
    }, refreshMs);
  });

  onBeforeUnmount(() => {
    if (clockTimer) clearInterval(clockTimer);
    if (priceTimer) clearInterval(priceTimer);
  });

  return { now };
}
