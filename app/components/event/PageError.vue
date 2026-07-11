<script setup lang="ts">
const props = defineProps<{
  message?: string;
  isRefreshing: boolean;
  statusCode?: number | null;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const route = useRoute();
const isNotFound = computed(() => props.statusCode === 404);
const navigate = (path: string) => void navigateTo(path);
</script>

<template>
  <TerminalErrorPage v-if="isNotFound" :status-code="404" title="The market says there is a 0% chance anything is here." description="This page has no liquidity. Head back to the board and find a market that is still trading." :requested-path="route.fullPath" @navigate="navigate" />
  <div v-else class="flex min-h-screen items-center justify-center p-6">
    <div class="max-w-md rounded-xl border border-border bg-(--color-card) p-6 text-center">
      <div class="text-(--market-no) text-base font-[650] leading-5.5 mb-2">Couldn't load this market</div>
      <div class="text-(--text-muted) text-sm leading-5 mb-4">{{ message || "The market data is unavailable right now." }}</div>
      <div class="flex items-center justify-center gap-2">
        <button class="pm-button pm-button--secondary pm-focus min-h-10 px-4 text-sm font-[590]" :disabled="isRefreshing" @click="emit('retry')">Retry</button>
        <NuxtLink to="/" class="pm-button pm-button--secondary pm-focus inline-flex items-center min-h-10 px-4 text-sm font-[590]">Back to markets</NuxtLink>
      </div>
    </div>
  </div>
</template>
