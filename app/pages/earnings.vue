<script setup lang="ts">
import type { EarningsEntry } from "~/types/earnings";
import { proba } from "~/utils/prices";

const { data, pending, error, refresh } = await useFetch<EarningsEntry[]>("/api/earnings");

const entries = computed(() => data.value ?? []);

const dayKey = (iso: string) => iso.slice(0, 10);
const shiftKey = (key: string, days: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const mondayOf = (key: string) => {
  const wd = new Date(`${key}T00:00:00Z`).getUTCDay();
  return shiftKey(key, wd === 0 ? -6 : 1 - wd);
};

const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const dayNumFmt = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" });
const rangeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const asDate = (key: string) => new Date(`${key}T00:00:00Z`);

interface CalendarDay {
  key: string;
  offset: number;
  weekday: string;
  dayNum: string;
  pre: EarningsEntry[];
  post: EarningsEntry[];
  count: number;
}
interface CalendarWeek {
  key: string;
  label: string;
  days: CalendarDay[];
}

const weeks = computed<CalendarWeek[]>(() => {
  const byDay = new Map<string, EarningsEntry[]>();
  for (const e of entries.value) {
    const k = dayKey(e.reportDate);
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(e);
  }

  const bySession = (list: EarningsEntry[], s: "pre" | "post") => list.filter((e) => e.session === s).sort((a, b) => b.beatPct - a.beatPct || a.ticker.localeCompare(b.ticker));

  return [...new Set(entries.value.map((e) => mondayOf(dayKey(e.reportDate))))].sort().map((wk) => {
    const days: CalendarDay[] = [];
    for (let offset = 0; offset < 7; offset++) {
      const key = shiftKey(wk, offset);
      const list = byDay.get(key) ?? [];
      if (offset > 4 && list.length === 0) continue;
      const pre = bySession(list, "pre");
      const post = bySession(list, "post");
      days.push({ key, offset, weekday: weekdayFmt.format(asDate(key)), dayNum: dayNumFmt.format(asDate(key)), pre, post, count: pre.length + post.length });
    }
    return { key: wk, label: `${rangeFmt.format(asDate(wk))} – ${rangeFmt.format(asDate(shiftKey(wk, 4)))}`, days };
  });
});

const todayKey = ref<string | null>(null);
onMounted(() => (todayKey.value = new Date().toISOString().slice(0, 10)));

const beatClass = (pct: number) => proba(pct);
const eventUrl = (e: EarningsEntry) => `/event/${e.slug}?x=${e.id}`;
</script>

<template>
  <div class="pm-page">
    <section class="pm-container pt-6 pb-3">
      <div class="border-b border-border pb-5">
        <p class="text-xs leading-4 text-text-3">{{ new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }}</p>
        <h1 class="mt-1 text-2xl font-bold leading-8 text-white">Earnings Calendar</h1>
        <p class="text-sm leading-5 text-text-2">
          Will they beat the Street?
          <span v-if="entries.length" class="font-mono">· {{ entries.length }} companies reporting</span>
        </p>
      </div>
    </section>

    <main class="pm-container pb-12">
      <div v-if="pending" class="flex flex-col gap-8 pt-6">
        <div v-for="w in 2" :key="w" class="flex flex-col gap-3">
          <div class="pm-skeleton h-4 w-40" />
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
            <div v-for="d in 5" :key="d" class="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
              <div class="pm-skeleton h-3 w-16" />
              <div class="pm-skeleton h-12 w-full rounded-lg" />
              <div class="pm-skeleton h-12 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="error" class="flex min-h-60 items-center justify-center px-4">
        <div class="max-w-md rounded-xl border border-border bg-surface p-6 text-center">
          <p class="mb-2 text-base font-semibold leading-snug text-no">Couldn't load the earnings calendar</p>
          <p class="mb-4 text-sm leading-5 text-text-2">The earnings feed is unavailable right now.</p>
          <button class="pm-button pm-button--secondary pm-focus min-h-10 px-4 text-sm" @click="() => refresh()">Retry</button>
        </div>
      </div>

      <div v-else-if="weeks.length === 0" class="flex min-h-60 items-center justify-center px-4 text-center text-sm leading-5 text-text-2">No upcoming earnings markets right now.</div>

      <div v-else class="flex flex-col gap-8 pt-6">
        <section v-for="week in weeks" :key="week.key" class="flex flex-col gap-3">
          <div class="flex items-baseline gap-2">
            <h2 class="text-xs font-bold uppercase tracking-widest text-text-3">{{ week.label }}</h2>
            <div class="h-px flex-1 bg-border" />
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-(--cols)" :style="{ '--cols': `repeat(${week.days.length}, minmax(0, 1fr))` }">
            <div v-for="day in week.days" :key="day.key" class="flex flex-col rounded-xl border bg-surface transition-colors duration-150" :class="day.key === todayKey ? 'border-border-2' : 'border-border'">
              <div class="flex items-center justify-between border-b border-border px-3 py-2">
                <div class="flex items-baseline gap-1.5">
                  <span class="text-[11px] font-semibold uppercase tracking-wide" :class="day.key === todayKey ? 'text-white' : 'text-text-2'">{{ day.weekday }}</span>
                  <span class="font-mono text-[13px] font-semibold" :class="day.key === todayKey ? 'text-white' : 'text-text-3'">{{ day.dayNum }}</span>
                </div>
                <span v-if="day.key === todayKey" class="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-text-2">Today</span>
              </div>

              <div class="flex flex-1 flex-col gap-3 p-2.5">
                <template
                  v-for="group in [
                    { key: 'pre', label: 'Pre-market', icon: 'lucide:sunrise', list: day.pre },
                    { key: 'post', label: 'Post-market', icon: 'lucide:sunset', list: day.post },
                  ]"
                  :key="group.key"
                >
                  <section v-if="group.list.length" class="flex flex-col gap-1.5">
                    <div class="flex items-center gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-3">
                      <Icon :name="group.icon" class="h-3 w-3" />
                      <span>{{ group.label }}</span>
                    </div>
                    <NuxtLink v-for="e in group.list" :key="e.id" :to="eventUrl(e)" class="group/row flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-2.5 py-2 transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-border-2 motion-reduce:hover:translate-y-0">
                      <div class="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface">
                        <MarketIcon v-if="e.icon" :src="e.icon" :alt="e.ticker" class="h-full w-full object-cover" />
                        <span v-else class="font-mono text-[10px] font-semibold text-text-2">{{ e.ticker.slice(0, 3) }}</span>
                      </div>
                      <div class="min-w-0 flex-1" :title="e.company">
                        <div class="truncate font-mono text-[13px] font-semibold text-white">{{ e.ticker }}</div>
                        <div v-if="e.epsEstimate !== null" class="truncate font-mono text-[11px] leading-tight text-text-3">Est. ${{ e.epsEstimate.toFixed(2) }}</div>
                        <div v-else class="truncate text-[11px] leading-tight text-text-2">{{ e.company }}</div>
                      </div>
                      <div class="shrink-0 text-right">
                        <div class="font-mono text-[15px] font-semibold leading-none" :class="beatClass(e.beatPct)"><PercentOdometer :value="e.beatPct" /></div>
                        <div class="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-text-3">beat</div>
                      </div>
                    </NuxtLink>
                  </section>
                </template>

                <div v-if="day.count === 0" class="flex flex-1 items-center justify-center py-4 text-center text-[11px] text-text-3">No earnings</div>
              </div>
            </div>
          </div>
        </section>

        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-[11px] text-text-3">
          <span class="flex items-center gap-1.5"><Icon name="lucide:sunrise" class="h-3.5 w-3.5" /> Reports before the open</span>
          <span class="flex items-center gap-1.5"><Icon name="lucide:sunset" class="h-3.5 w-3.5" /> Reports after the close</span>
          <span class="font-mono"><span class="font-semibold text-text-2">beat</span> = market-implied chance of beating the EPS estimate</span>
        </div>
      </div>
    </main>
  </div>
</template>
