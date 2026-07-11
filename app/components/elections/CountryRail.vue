<script setup lang="ts">
import { countryName, GLOBAL_BUCKET } from "~/utils/elections";
import type { CountryTally } from "~/composables/useElectionsFeed";

const props = defineProps<{
  countries: CountryTally[];
  selected: string | null;
  totalCount: number;
  globalCount: number;
}>();

const emit = defineEmits<{
  "update:selected": [iso: string | null];
}>();

interface Chip {
  iso: string | null;
  label: string;
  count: number;
}

const chips = computed<Chip[]>(() => {
  const list: Chip[] = [{ iso: null, label: "All", count: props.totalCount }, ...props.countries.map((c) => ({ iso: c.iso, label: countryName(c.iso), count: c.count }))];
  if (props.globalCount > 0) list.push({ iso: GLOBAL_BUCKET, label: "Global", count: props.globalCount });
  return list;
});

const chipClass = (active: boolean) => ["pm-focus flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm leading-5 transition-colors duration-150", active ? "border-white/30 bg-surface-2 font-[650] text-white" : "border-border bg-surface text-text-2 hover:border-border-2 hover:text-white"];
const select = (iso: string | null) => emit("update:selected", props.selected === iso ? null : iso);
</script>

<template>
  <div class="flex flex-wrap justify-center gap-2">
    <button v-for="chip in chips" :key="chip.iso ?? 'all'" :class="chipClass(selected === chip.iso || (chip.iso === null && selected === null))" @click="select(chip.iso)">
      <span>{{ chip.label }}</span>
      <span class="pm-tabular text-xs" :class="selected === chip.iso ? 'text-text-2' : 'text-text-3'">{{ chip.count }}</span>
    </button>
  </div>
</template>
