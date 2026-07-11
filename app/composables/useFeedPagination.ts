import { ref } from "vue";
import { getFeedErrorMessage } from "~/utils/marketFeed";

export function useFeedPagination() {
  const { start, done } = useLoader();

  const loading = ref(false);
  const initialLoaded = ref(false);
  const error = ref<string | null>(null);
  const pageError = ref<string | null>(null);
  let requestId = 0;

  const isCurrent = (id: number) => id === requestId;

  async function runReset(body: (requestId: number) => Promise<void>) {
    const id = ++requestId;
    loading.value = true;
    initialLoaded.value = false;
    pageError.value = null;
    try {
      start();
      await body(id);
    } catch (err) {
      if (isCurrent(id)) error.value = getFeedErrorMessage(err);
    } finally {
      if (isCurrent(id)) {
        initialLoaded.value = true;
        loading.value = false;
        done();
      }
    }
  }

  async function runLoadMore(fetchPage: (requestId: number) => Promise<void>, hasEvents: () => boolean, hasMore: () => boolean) {
    if (loading.value || !initialLoaded.value || !hasMore()) return;
    const id = ++requestId;
    loading.value = true;
    pageError.value = null;
    try {
      start();
      await fetchPage(id);
    } catch (err) {
      if (isCurrent(id)) {
        const m = getFeedErrorMessage(err);
        if (hasEvents()) pageError.value = m;
        else error.value = m;
      }
    } finally {
      if (isCurrent(id)) {
        loading.value = false;
        done();
      }
    }
  }

  return { loading, initialLoaded, error, pageError, isCurrent, runReset, runLoadMore };
}
