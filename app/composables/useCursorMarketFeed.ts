import { ref, type Ref } from "vue";
import { MARKETS_PAGE_SIZE } from "~/utils/constants";
import type { MarketFeedEvent } from "~/types/gamma";
import type { MarketsResponse } from "~/types/markets";
import { mergeUniqueMarketEvents, parseMarketsPage } from "~/utils/marketFeed";
import { useFeedPagination } from "~/composables/useFeedPagination";

export function useCursorMarketFeed(activeSlug: Ref<string>) {
  const { loading, initialLoaded, error, pageError, isCurrent, runReset, runLoadMore } = useFeedPagination();

  const events = ref<MarketFeedEvent[]>([]);
  const cursor = ref<string | null>(null);
  const hasMore = ref(true);
  const seenIds = ref<Set<string>>(new Set());

  async function fetchPage(requestId: number) {
    const query: Record<string, string | number> = { limit: MARKETS_PAGE_SIZE, order: "volume24hr", tag_slug: activeSlug.value };
    if (cursor.value) query.cursor = cursor.value;

    const data = await $fetch<MarketsResponse | MarketFeedEvent[]>("/api/markets", { query });
    if (!isCurrent(requestId)) return;

    const { events: nextEvents, cursor: nextCursor } = parseMarketsPage(data);
    cursor.value = nextCursor;
    hasMore.value = Boolean(nextCursor);
    events.value.push(...mergeUniqueMarketEvents(nextEvents, seenIds.value));
    error.value = null;
    pageError.value = null;
  }

  async function reset(slug?: string) {
    await runReset(async (requestId) => {
      if (slug !== undefined) activeSlug.value = slug;
      cursor.value = null;
      hasMore.value = true;
      seenIds.value.clear();
      events.value = [];
      await fetchPage(requestId);
    });
  }

  const loadMore = () =>
    runLoadMore(
      fetchPage,
      () => events.value.length > 0,
      () => hasMore.value,
    );

  return {
    events,
    error,
    hasMore,
    initialLoaded,
    loading,
    pageError,
    loadMore,
    reset,
    retry: async () => void (loading.value || (await reset())),
    retryPage: async () => void (loading.value || (await loadMore())),
  };
}
