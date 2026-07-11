<script setup lang="ts">
import { countryName } from "~/utils/elections";

const { loading, error, refresh, countries, selectedCountry, filteredEvents, visibleEvents, hasMore, reachEnd, totalCount, globalCount } = useElectionsFeed();

const heading = computed(() => (selectedCountry.value ? `${countryName(selectedCountry.value)} elections` : "All elections"));
const isEmpty = computed(() => !loading.value && !filteredEvents.value.length);

useInfiniteScroll(reachEnd, { rootMargin: "600px" });
useHead({ title: "Elections" });
</script>

<template>
  <div class="pm-page overflow-x-clip">
    <div class="pm-container py-6">
      <div class="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <div class="relative z-0 flex shrink-0 flex-col gap-5 lg:sticky lg:top-4 lg:w-110">
          <div class="relative z-10">
            <h1 class="text-2xl font-bold leading-8 text-white">Elections</h1>
            <p class="text-sm leading-5 text-text-2">Prediction markets for elections around the world.</p>
          </div>

          <div class="relative z-0 w-full py-3">
            <ElectionsStarField :count="90" />
            <ClientOnly>
              <ElectionsGlobe v-model:selected="selectedCountry" :countries="countries" />
              <template #fallback>
                <div class="mx-auto aspect-square w-full max-w-100 rounded-full pm-skeleton" />
              </template>
            </ClientOnly>
          </div>

          <ElectionsCountryRail v-model:selected="selectedCountry" :countries="countries" :total-count="totalCount" :global-count="globalCount" class="relative z-10" />
        </div>

        <div class="relative z-10 min-w-0 flex-1">
          <div v-if="error && filteredEvents.length === 0" class="flex min-h-60 items-center justify-center px-4">
            <div class="max-w-md rounded-xl border border-border bg-surface p-6 text-center">
              <p class="mb-2 text-base font-semibold leading-snug text-no">Election markets are unavailable right now.</p>
              <button class="pm-button pm-button--secondary pm-focus min-h-10 px-4 text-sm font-medium" :disabled="loading" @click="refresh()">Retry</button>
            </div>
          </div>

          <div v-else class="flex flex-col gap-4">
            <h2 class="text-lg font-bold leading-6 text-white">{{ heading }}</h2>

            <div v-if="loading && filteredEvents.length === 0" class="pm-grid">
              <div v-for="i in 6" :key="`sk-${i}`" class="h-44 rounded-xl border border-border bg-surface pm-skeleton" />
            </div>

            <div v-else-if="isEmpty" class="flex min-h-40 items-center justify-center px-4 text-sm text-text-3">No election markets to show here right now.</div>

            <div v-else class="pm-grid transition-opacity duration-150" :class="{ 'opacity-60': loading }">
              <MarketCard v-for="(event, index) in visibleEvents" :key="event.id" :event="event" :style="{ '--card-index': Math.min(index, 8) }" />
            </div>

            <div v-if="hasMore" ref="sentinel" class="h-16" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
