<script setup lang="ts">
import type { Outcome } from "~/types/account";
import type { SportsOdds } from "~/utils/sports";
import { fmtcp } from "~/utils/prices";

const props = defineProps<{
  odds: SportsOdds | null;
  color?: string | null;
  selected?: boolean;
}>();
const emit = defineEmits<{ select: [] }>();

const cents = computed(() => (props.odds?.price == null ? null : fmtcp(props.odds.price)));
const isTotal = computed(() => props.odds?.kind === "total");
const useTeamColor = computed(() => !!props.color && (props.odds?.kind === "moneyline" || props.selected));
const tone = computed<Outcome>(() => (props.odds?.outcome === "no" ? "no" : "yes"));

const hexToRgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
};

const teamStyle = computed(() => {
  if (!useTeamColor.value || !props.color) return undefined;
  return { backgroundColor: hexToRgba(props.color, props.selected ? 0.3 : 0.14), borderColor: hexToRgba(props.color, props.selected ? 1 : 0.42) };
});

const buttonClass = computed(() => {
  if (isTotal.value && props.selected) return [tone.value === "yes" ? "border-yes/20 bg-yes-bg text-yes hover:bg-yes-hover" : "border-no/15 bg-no-bg text-no hover:bg-no-hover", "ring-1 ring-inset ring-white/70"];
  if (useTeamColor.value) return ["text-white hover:brightness-125"];
  return [props.selected ? "border-white bg-surface-2 text-white" : "border-border bg-surface-2 text-text-2 hover:border-border-2 hover:text-white"];
});
</script>

<template>
  <div v-if="odds == null || odds.price == null" class="font-mono flex h-9 items-center justify-between gap-1 rounded-md border border-dashed border-border bg-transparent px-2 text-[11px] font-medium text-text-3">
    <span class="truncate font-sans">{{ odds?.label ?? "" }}</span>
    <span class="shrink-0">--</span>
  </div>
  <button v-else type="button" class="font-mono flex h-9 w-full items-center justify-between gap-1 rounded-md border px-2 text-[11px] font-semibold transition-[background-color,border-color,filter] duration-150" :class="buttonClass" :style="teamStyle" @click.prevent.stop="emit('select')">
    <span class="truncate font-sans">{{ odds.label }}</span>
    <span class="shrink-0">{{ cents }}</span>
  </button>
</template>
