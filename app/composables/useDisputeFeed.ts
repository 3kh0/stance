import type { DisputeFeedResponse, DisputeStageFilter } from "~/types/markets";
import { getFeedErrorMessage } from "~/utils/marketFeed";

const DISPUTE_FEED_POLL_MS = 15_000;

export function useDisputeFeed() {
  const stage = ref<DisputeStageFilter>("all");
  const { start, done } = useLoader();

  const {
    data,
    error: fetchError,
    pending,
    refresh,
  } = useFetch<DisputeFeedResponse>("/api/disputes", {
    query: { stage },
    default: () => ({ markets: [], updatedAt: new Date(0).toISOString(), scanned: 0 }),
  });

  const error = computed(() => (fetchError.value ? getFeedErrorMessage(fetchError.value) : null));
  const markets = computed(() => data.value?.markets ?? []);
  const updatedAt = computed(() => data.value?.updatedAt ?? null);
  const scanned = computed(() => data.value?.scanned ?? 0);

  async function retry() {
    try {
      start();
      await refresh();
    } finally {
      done();
    }
  }

  let timer: ReturnType<typeof setInterval> | null = null;
  let refreshing = false;

  async function poll() {
    if (refreshing || (typeof document !== "undefined" && document.hidden)) return;
    refreshing = true;
    try {
      await refresh();
    } finally {
      refreshing = false;
    }
  }

  const onVisibilityChange = () => void (document.hidden || poll());

  onMounted(() => {
    timer = setInterval(() => void poll(), DISPUTE_FEED_POLL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
  });

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  });

  return {
    error,
    loading: pending,
    markets,
    retry,
    scanned,
    selectStage: (next: DisputeStageFilter) => void (stage.value === next || (stage.value = next)),
    stage,
    updatedAt,
  };
}
