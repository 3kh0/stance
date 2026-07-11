<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();
const route = useRoute();
const statusCode = computed(() => Number(props.error?.statusCode || 404));
const isNotFound = computed(() => statusCode.value === 404);
const requestedPath = computed(() => route.fullPath || "/");
const title = computed(() => (isNotFound.value ? "The market says there is a 0% chance anything is here." : "Terminal interrupted"));
const description = computed(() => (isNotFound.value ? "This page has no liquidity. Head back to the homepage and find a market that is still trading." : props.error?.statusMessage || "The terminal hit an unexpected state. Return to the live board and try again."));
useHead(() => ({ title: `${statusCode.value} - ${title.value}` }));
const go = (path: string) => clearError({ redirect: path });
</script>

<template>
  <NuxtLayout>
    <TerminalErrorPage :status-code="statusCode" :title="title" :description="description" :requested-path="requestedPath" @navigate="go" />
  </NuxtLayout>
</template>
