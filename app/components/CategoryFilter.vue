<script setup lang="ts">
defineProps<{ tags: { label: string; slug: string }[]; modelValue: string | null }>();
defineEmits<{ "update:modelValue": [slug: string | null] }>();
const bc = (a: boolean) => ["pm-focus shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[12.5px] font-medium leading-5 transition-colors duration-150", a ? "border-white text-white" : "border-border text-text-2 hover:border-border-2 hover:text-white"];
</script>

<template>
  <div class="pm-container pt-4 pb-3">
    <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
      <button :class="bc(modelValue === null)" @click="$emit('update:modelValue', null)">All</button>
      <button v-for="t in tags" :key="t.slug" :class="bc(modelValue === t.slug)" @click="$emit('update:modelValue', t.slug)">{{ t.label }}</button>
    </div>
  </div>
</template>
