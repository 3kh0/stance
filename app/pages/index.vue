<script setup lang="ts">
const feed = await useMarketFeed({ mode: "trending" });
const timer = ref<ReturnType<typeof setInterval> | null>(null);

onMounted(() => (timer.value = setInterval(() => feed.retry(), 30000)));
onUnmounted(() => timer.value && clearInterval(timer.value));
</script>

<template>
  <div class="pm-page">
    <CategoryFilter :tags="feed.tags.value" :model-value="feed.activeTag.value" @update:model-value="feed.selectTag" />
    <div v-if="feed.tagLoadError.value" class="pm-container pt-3 text-(--text-muted) text-xs leading-4">{{ feed.tagLoadError.value }}</div>
    <MarketGrid :events="feed.events.value" :loading="feed.loading.value" :error="feed.error.value" :page-error="feed.pageError.value" @reach-end="feed.loadMore" @retry="feed.retry" @retry-page="feed.retryPage" />
  </div>
</template>
