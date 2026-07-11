<script setup lang="ts">
interface ChipItem {
  slug: string;
  label: string;
  icon: string;
}

const props = withDefaults(
  defineProps<{
    items: ChipItem[];
    activeSlug: string | null;
    max?: number;
  }>(),
  { max: 6 },
);

const emit = defineEmits<{
  select: [slug: string | null];
  more: [];
}>();

const visible = computed<ChipItem[]>(() => {
  const head = props.items.slice(0, props.max);
  if (!props.activeSlug || head.some((item) => item.slug === props.activeSlug)) return head;
  const active = props.items.find((item) => item.slug === props.activeSlug);
  return active ? [active, ...head.slice(0, props.max - 1)] : head;
});

const x = (active: boolean) => ["inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors", active ? "border-white/30 bg-surface-2 text-white" : "border-border bg-surface text-text-2"];
</script>

<template>
  <div class="scrollbar-none -mx-4 flex min-h-9 gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
    <button :class="x(activeSlug === null)" @click="emit('select', null)">All</button>
    <button v-for="item in visible" :key="item.slug" :class="x(activeSlug === item.slug)" @click="emit('select', item.slug)">
      <Icon :name="item.icon" class="h-3.5 w-3.5" />
      {{ item.label }}
    </button>
    <button v-if="items.length > visible.length" :class="x(false)" @click="emit('more')">
      <Icon name="lucide:ellipsis" class="h-3.5 w-3.5" />
      More
    </button>
  </div>
</template>
