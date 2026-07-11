import { MARKETS_PAGE_SIZE } from "~/utils/constants";
import type { MarketFeedEvent } from "~/types/gamma";
import type { MarketsResponse, TagItem } from "~/types/markets";
import { mergeUniqueMarketEvents, parseMarketsPage } from "~/utils/marketFeed";
import { useFeedPagination } from "~/composables/useFeedPagination";

interface MarketFeedOptions {
  mode: "trending" | "new";
}

export async function useMarketFeed(options: MarketFeedOptions) {
  const { loading, initialLoaded, error, pageError, isCurrent, runReset, runLoadMore } = useFeedPagination();

  const activeTag = ref<string | null>(null);
  const offset = ref(0);
  const cursor = ref<string | null>(null);
  const hasMore = ref(true);
  const initEvents = ref<MarketFeedEvent[]>([]);
  const marketEvents = ref<MarketFeedEvent[]>([]);
  const seenIds = ref<Set<string>>(new Set());

  const { data: tagsData, error: tagsError } = await useFetch<TagItem[]>("/api/tags", { query: { tag: "all", status: "active" } });

  const tags = computed<TagItem[]>(() => tagsData.value ?? []);
  const tagLoadError = computed(() => (tagsError.value ? "Categories unavailable" : null));

  const events = computed(() => {
    if (activeTag.value || options.mode === "new") return marketEvents.value;
    const sorted = [...marketEvents.value].sort((a, b) => Number.parseFloat(String(b.volume24hr ?? 0)) - Number.parseFloat(String(a.volume24hr ?? 0)));
    return [...initEvents.value, ...sorted];
  });

  async function fetchFeatured(requestId: number) {
    const data = await $fetch<MarketFeedEvent[]>("/api/init");
    if (!isCurrent(requestId)) return;
    initEvents.value = mergeUniqueMarketEvents(Array.isArray(data) ? data : [], seenIds.value);
    error.value = null;
    pageError.value = null;
  }

  async function fetchMarketPage(requestId: number) {
    const query: Record<string, string | number> = { limit: MARKETS_PAGE_SIZE, order: "volume24hr", ascending: "false" };

    if (activeTag.value) {
      query.tag_slug = activeTag.value;
      if (cursor.value) query.cursor = cursor.value;
    } else if (options.mode === "new") {
      if (cursor.value) query.cursor = cursor.value;
    } else query.offset = offset.value;

    const endpoint = options.mode === "new" && !activeTag.value ? "/api/new-markets" : "/api/markets";
    const data = await $fetch<MarketsResponse | MarketFeedEvent[]>(endpoint, { query });
    if (!isCurrent(requestId)) return;

    const { events: nextEvents, cursor: nextCursor } = parseMarketsPage(data);

    if (activeTag.value || options.mode === "new") {
      cursor.value = nextCursor;
      hasMore.value = Boolean(nextCursor);
    } else {
      hasMore.value = nextEvents.length >= MARKETS_PAGE_SIZE;
      offset.value += MARKETS_PAGE_SIZE;
    }

    marketEvents.value.push(...mergeUniqueMarketEvents(nextEvents, seenIds.value));
    error.value = null;
    pageError.value = null;
  }

  async function reset(tag: string | null = activeTag.value) {
    await runReset(async (requestId) => {
      activeTag.value = tag;
      offset.value = 0;
      cursor.value = null;
      hasMore.value = true;
      seenIds.value.clear();
      initEvents.value = [];
      marketEvents.value = [];
      if (options.mode === "trending" && !tag) await fetchFeatured(requestId);
      else await fetchMarketPage(requestId);
    });
  }

  const loadMore = () =>
    runLoadMore(
      fetchMarketPage,
      () => events.value.length > 0,
      () => hasMore.value,
    );

  await reset(null);

  return {
    activeTag,
    error,
    events,
    hasMore,
    initialLoaded,
    loading,
    pageError,
    retry: async () => void (loading.value || (await reset(activeTag.value))),
    retryPage: async () => void (loading.value || (await loadMore())),
    selectTag: (slug: string | null) => void (slug === activeTag.value || reset(slug)),
    tagLoadError,
    tags,
    loadMore,
  };
}
