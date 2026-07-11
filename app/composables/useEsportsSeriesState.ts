import type { GammaEvent } from "~/types/gamma";
import type { GridSeriesState } from "~/utils/sports";

const POLL_MS = 5000;

export function useEsportsSeriesState(event: Ref<GammaEvent | null | undefined>) {
  const seriesId = computed(() => event.value?.eventMetadata?.gridSeriesId?.trim() || null);
  const isLive = computed(() => event.value?.live === true);
  const state = ref<GridSeriesState | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;

  async function load() {
    const id = seriesId.value;
    if (!id) return void (state.value = null);
    try {
      state.value = await $fetch<GridSeriesState>("/api/esports/series-state", { query: { seriesId: id } });
    } catch {}
  }

  function start() {
    if (timer) clearInterval(timer);
    timer = null;
    void load();
    if (seriesId.value && isLive.value) timer = setInterval(load, POLL_MS);
  }

  onMounted(start);
  watch([seriesId, isLive], start);
  onScopeDispose(() => timer && clearInterval(timer));

  return state;
}
