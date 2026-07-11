<script setup lang="ts">
const route = useRoute();

defineEmits<{ search: [] }>();

const b = "pm-focus flex h-13 flex-col items-center justify-center gap-1 transition-colors duration-150";
const lbl = "text-[9px] font-bold uppercase tracking-widest";
const cls = (active: boolean) => [b, active ? "text-white" : "text-text-3"];

type Item = { icon: string; label: string; to?: string; search?: boolean };
const items: Item[] = [
  { to: "/", icon: "lucide:layout-grid", label: "Markets" },
  { to: "/breaking", icon: "lucide:zap", label: "Breaking" },
  { search: true, icon: "lucide:search", label: "Search" },
  { to: "/new", icon: "lucide:sparkles", label: "New" },
  { to: "/portfolio", icon: "lucide:bar-chart-3", label: "Portfolio" },
];
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary">
    <div class="grid grid-cols-6">
      <template v-for="it in items" :key="it.label">
        <button v-if="it.search" type="button" :class="b + ' text-text-3'" aria-label="Search markets" @click="$emit('search')">
          <Icon :name="it.icon" class="h-4.5 w-4.5" />
          <span :class="lbl">{{ it.label }}</span>
        </button>
        <NuxtLink v-else :href="it.to!" :class="cls(route.path === it.to)">
          <Icon :name="it.icon" class="h-4.5 w-4.5" />
          <span :class="lbl">{{ it.label }}</span>
        </NuxtLink>
      </template>
    </div>
  </nav>
</template>
