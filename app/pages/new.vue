<script setup lang="ts">
const feed = await useMarketFeed({ mode: "new" });
</script>

<template>
  <div class="pm-page">
    <CategoryFilter :tags="feed.tags.value" :model-value="feed.activeTag.value" @update:model-value="feed.selectTag" />
    <div v-if="feed.tagLoadError.value" class="pm-container pt-3 text-(--text-muted) text-xs leading-4">{{ feed.tagLoadError.value }}</div>

    <div class="pm-container mb-4 py-4">
      <h1 class="text-(--text-primary) text-2xl font-bold leading-8">New markets</h1>
    </div>

    <MarketGrid :events="feed.events.value" :loading="feed.loading.value" :error="feed.error.value" :page-error="feed.pageError.value" @reach-end="feed.loadMore" @retry="feed.retry" @retry-page="feed.retryPage" />
  </div>
</template>
