<script setup lang="ts">
import type { SubTag } from "~/types/markets";
import { fmtcn } from "~/utils/prices";
import { useInfiniteScroll } from "~/composables/useInfiniteScroll";

const props = defineProps<{ categorySlug: string; categoryLabel: string }>();

const { data: tagsData, error: tagsError } = await useFetch<SubTag[]>("/api/category-tags", { query: { slug: props.categorySlug } });

const subTags = computed<SubTag[]>(() => tagsData.value ?? []);
const totalCount = computed(() => subTags.value.reduce((s, t) => s + (t.activeEventsCount ?? 0), 0));

const activeSlug = ref<string>(props.categorySlug);
const activeLabel = computed(() => (activeSlug.value === props.categorySlug ? props.categoryLabel : (subTags.value.find((t) => t.slug === activeSlug.value)?.label ?? props.categoryLabel)));

const { events, error, loading, pageError, loadMore, reset, retry, retryPage } = useCursorMarketFeed(activeSlug);

const selectTag = (slug: string) => {
  if (slug !== activeSlug.value) reset(slug);
};

await reset(props.categorySlug);
useInfiniteScroll(loadMore, { threshold: 0.1 });

const sbc = (a: boolean) => ["pm-focus group flex w-full items-center justify-between gap-3 rounded-[7.2px] px-3 py-2 text-left text-sm leading-5 transition-colors duration-150", a ? "bg-surface-2 text-white font-[650]" : "text-text-2 hover:bg-surface hover:text-white"];
</script>

<template>
  <div class="pm-page">
    <div class="pm-container pt-6 pb-8">
      <div class="flex flex-col gap-6 md:flex-row md:items-start">
        <aside v-if="!tagsError" class="shrink-0 md:sticky md:top-4 md:w-56 lg:w-64">
          <nav class="flex flex-col gap-1">
            <button :class="sbc(activeSlug === props.categorySlug)" @click="selectTag(props.categorySlug)">
              <span>All</span>
              <span class="pm-tabular text-text-3 text-xs font-[590] group-hover:text-text-2">{{ fmtcn(totalCount) }}</span>
            </button>
            <button v-for="t in subTags" :key="t.slug" :class="sbc(activeSlug === t.slug)" @click="selectTag(t.slug)">
              <span class="truncate">{{ t.label }}</span>
              <span class="pm-tabular shrink-0 text-text-3 text-xs font-[590] group-hover:text-text-2">{{ fmtcn(t.activeEventsCount ?? 0) }}</span>
            </button>
          </nav>
        </aside>

        <main class="min-w-0 flex-1">
          <div class="mb-5 flex items-center justify-between gap-4">
            <h1 class="text-white text-2xl font-bold leading-8">{{ activeLabel }}</h1>
          </div>

          <div v-if="error && events.length === 0" class="flex min-h-60 items-center justify-center px-4">
            <div class="max-w-md text-center rounded-xl border border-border bg-surface p-6">
              <p class="text-no text-base font-[650] leading-5.5 mb-2">{{ error }}</p>
              <p class="text-text-3 text-sm leading-5 mb-4">The market data is unavailable right now.</p>
              <button class="pm-button pm-button--secondary pm-focus min-h-10 px-4 text-sm font-[590]" :disabled="loading" @click="retry">Retry</button>
            </div>
          </div>

          <div v-else-if="loading && events.length === 0" class="pm-grid">
            <div v-for="i in 6" :key="`skeleton-${i}`" class="market-skeleton">
              <div class="flex items-start gap-2 px-3 pt-3">
                <div class="w-9 h-9 pm-skeleton rounded-[7.2px] shrink-0" />
                <div class="flex-1 space-y-2">
                  <div class="pm-skeleton h-4 w-3/4" />
                  <div class="pm-skeleton h-4 w-1/2" />
                </div>
              </div>
              <div class="px-3 pt-4 space-y-2">
                <div class="pm-skeleton h-7 w-full rounded-md" />
                <div class="pm-skeleton h-7 w-full rounded-md" />
              </div>
              <div class="px-3 pt-4 pb-3 flex justify-between">
                <div class="pm-skeleton h-3 w-16" />
                <div class="pm-skeleton h-3 w-10" />
              </div>
            </div>
          </div>

          <div v-else-if="events.length === 0" class="flex min-h-60 items-center justify-center px-4">
            <div class="max-w-md text-center text-text-3 text-sm leading-5">No markets to show here right now.</div>
          </div>

          <div v-else class="pm-grid transition-opacity duration-150" :class="{ 'opacity-60': loading }">
            <MarketCard v-for="(event, index) in events" :key="event.id" :event="event" :style="{ '--card-index': Math.min(index, 8) }" />
          </div>

          <div v-if="pageError && events.length > 0" class="flex justify-center px-4 py-4">
            <div class="inline-flex items-center gap-3 rounded-[7.2px] border border-[rgba(234,179,8,0.25)] bg-[rgba(234,179,8,0.08)] px-4 py-2 text-[#eab308] text-sm leading-5">
              <span>{{ pageError }}</span>
              <button class="pm-focus font-[650] hover:text-white" :disabled="loading" @click="retryPage">Retry</button>
            </div>
          </div>

          <div ref="sentinel" class="h-16" />
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.market-skeleton {
  min-height: 168px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}
</style>
