<script setup lang="ts">
defineProps<{
  sports?: boolean;
}>();
</script>

<template>
  <div class="pm-event-container p-4 sm:p-6">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <div v-if="sports" class="mb-6 overflow-hidden">
          <div class="flex items-center justify-between gap-3 px-4 py-3">
            <div class="pm-skeleton h-3 w-40 rounded-sm" />
            <div class="ml-auto flex items-center gap-1.5">
              <div class="pm-skeleton h-7 w-24 rounded-md" />
              <div class="pm-skeleton h-7 w-7 rounded-md" />
            </div>
          </div>
          <div class="px-4 pt-5 pb-4">
            <div class="pm-skeleton mx-auto h-7 w-64 max-w-full rounded-md" />
            <div class="mt-2 flex h-4.5 items-center justify-center">
              <div class="pm-skeleton h-3.5 w-28 rounded-sm" />
            </div>
          </div>
        </div>
        <div v-else class="mb-6 flex items-start gap-3.5">
          <div class="pm-skeleton h-12 w-12 shrink-0 rounded-lg" />
          <div class="min-w-0 flex-1">
            <div class="pm-skeleton mb-1 h-3 w-32 rounded-sm" />
            <div class="pm-skeleton h-7 w-3/4 rounded-md" />
            <div class="mt-2 flex items-center gap-4">
              <div class="pm-skeleton h-7 w-24 rounded-md" />
              <div class="pm-skeleton h-4 w-20 rounded-sm" />
              <div class="pm-skeleton h-7 w-24 rounded-md" />
              <div class="pm-skeleton h-7 w-7 rounded-md" />
            </div>
          </div>
        </div>

        <div v-if="sports" class="mb-6 min-h-72 overflow-hidden rounded-xl border border-border">
          <div class="flex flex-col gap-4 p-4">
            <div class="flex items-center justify-between gap-4 px-2 pt-2">
              <div class="flex flex-1 flex-col items-center gap-2">
                <div class="pm-skeleton h-11 w-11 rounded-full" />
                <div class="pm-skeleton h-3 w-16 rounded-sm" />
              </div>
              <div class="flex flex-col items-center gap-2">
                <div class="pm-skeleton h-8 w-24 rounded-sm" />
                <div class="pm-skeleton h-2.5 w-12 rounded-sm" />
              </div>
              <div class="flex flex-1 flex-col items-center gap-2">
                <div class="pm-skeleton h-11 w-11 rounded-full" />
                <div class="pm-skeleton h-3 w-16 rounded-sm" />
              </div>
            </div>
            <div class="pm-skeleton h-32 rounded-lg" />
          </div>
        </div>

        <div class="mb-6">
          <div class="mb-4.5 flex min-h-8 items-center justify-end gap-3">
            <div class="pm-skeleton h-6 w-24 rounded-md" />
            <div class="pm-skeleton h-6 w-20 rounded-full" />
          </div>
          <div class="pm-skeleton h-[300px] w-full rounded-[7.2px]" />
          <div class="flex items-center justify-between gap-4 pt-4.5">
            <div class="pm-skeleton h-5 w-24 rounded-sm" />
            <div class="flex items-center justify-end gap-3.5">
              <div v-for="i in 7" :key="i" class="pm-skeleton h-6.5 w-9 rounded-full" />
            </div>
          </div>
        </div>

        <div v-if="sports" class="border-t border-border">
          <div class="flex items-center gap-5 border-b border-border py-3">
            <div v-for="i in 4" :key="i" class="pm-skeleton h-4.5 w-16 rounded-sm" />
          </div>
          <div v-for="i in 3" :key="i" class="my-3 overflow-hidden rounded-xl border border-border bg-surface">
            <div class="grid grid-cols-[minmax(0,1fr)_minmax(260px,44%)] items-center gap-4 px-4 py-4 max-[760px]:grid-cols-1 max-[760px]:gap-3">
              <div class="min-w-0">
                <div class="pm-skeleton mb-2 h-5 w-40 max-w-full rounded-sm" />
                <div class="pm-skeleton h-3 w-20 rounded-sm" />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="pm-skeleton h-11 rounded-md" />
                <div class="pm-skeleton h-11 rounded-md" />
              </div>
            </div>
            <div v-if="i === 1" class="border-t border-border">
              <div class="flex items-center gap-5 border-b border-border px-4 py-3">
                <div v-for="j in 3" :key="j" class="pm-skeleton h-3.5 w-20 rounded-sm" />
              </div>
              <div class="pm-skeleton h-104.5 w-full" />
            </div>
          </div>
        </div>
        <div v-else class="border-t border-border">
          <template v-for="i in 5" :key="i">
            <div class="grid min-h-14 grid-cols-[minmax(0,1fr)_80px_232px] items-center gap-4 border-b border-border py-2.5 max-[900px]:grid-cols-1">
              <div class="flex min-w-0 items-center gap-2.5">
                <div class="pm-skeleton h-8 w-8 shrink-0 rounded-md" />
                <div class="min-w-0 flex-1">
                  <div class="pm-skeleton mb-1.5 h-4 w-1/2 rounded-sm" />
                  <div class="pm-skeleton h-3 w-24 rounded-sm" />
                </div>
              </div>
              <div class="flex justify-end max-[900px]:justify-start">
                <div class="pm-skeleton h-8 w-14 rounded-sm" />
              </div>
              <div class="grid grid-cols-2 gap-1.5 max-[900px]:w-full">
                <div class="pm-skeleton h-9 rounded-md" />
                <div class="pm-skeleton h-9 rounded-md" />
              </div>
            </div>
            <div v-if="i === 1" class="border-b border-border">
              <div class="flex items-center gap-5 border-b border-border px-4 py-3">
                <div v-for="j in 3" :key="j" class="pm-skeleton h-3.5 w-20 rounded-sm" />
              </div>
              <div class="pm-skeleton h-104.5 w-full" />
            </div>
          </template>
        </div>
      </div>

      <div class="lg:col-span-1">
        <div class="sticky top-4 overflow-hidden rounded-xl border border-border bg-surface max-lg:hidden">
          <div class="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
            <div class="pm-skeleton h-9 w-9 shrink-0 rounded-md" />
            <div class="min-w-0 flex-1">
              <div class="pm-skeleton mb-1.5 h-3.5 w-3/4 rounded-sm" />
              <div class="pm-skeleton h-3 w-20 rounded-sm" />
            </div>
          </div>
          <div class="grid grid-cols-2 border-b border-border">
            <div class="flex h-10 items-center justify-center">
              <div class="pm-skeleton h-3.5 w-10 rounded-sm" />
            </div>
            <div class="flex h-10 items-center justify-center">
              <div class="pm-skeleton h-3.5 w-10 rounded-sm" />
            </div>
          </div>
          <div class="flex flex-col gap-3.5 p-3.5">
            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <div class="pm-skeleton h-3 w-16 rounded-sm" />
                <div class="pm-skeleton h-6.5 w-28 rounded-md" />
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <div class="pm-skeleton h-10 rounded-md" />
                <div class="pm-skeleton h-10 rounded-md" />
              </div>
            </div>
            <div>
              <div class="mb-1.5 flex items-baseline justify-between">
                <div class="pm-skeleton h-3 w-14 rounded-sm" />
                <div class="pm-skeleton h-3 w-16 rounded-sm" />
              </div>
              <div class="pm-skeleton h-11 rounded-md" />
              <div class="mt-1.5 grid grid-cols-4 gap-1.5">
                <div v-for="i in 4" :key="i" class="pm-skeleton h-7 rounded-md" />
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <div v-for="i in 4" :key="i" class="flex items-center justify-between">
                <div class="pm-skeleton h-3 w-16 rounded-sm" />
                <div class="pm-skeleton h-3 w-12 rounded-sm" />
              </div>
            </div>
            <div class="pm-skeleton h-12 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
