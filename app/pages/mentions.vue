<script setup lang="ts">
import type { GammaMarket, MarketFeedEvent } from "~/types/gamma";
import type { SubTag } from "~/types/markets";
import { fmtcp, fmtcn, proba } from "~/utils/prices";
import { parseOutcomePrices } from "~/utils/markets";

const MENTIONS_SLUG = "mention-markets";

useHead({ title: "Mentions | Stance" });

type MentionOutcome = { id: string; label: string; price: number };
type MentionStatus = "live" | "new" | "soon" | "open";
type MentionRow = { event: MarketFeedEvent; id: string; title: string; href: string; icon?: string; day: string; month: string; time: string; status: MentionStatus; volume: number; volumeLabel: string; signal: string; outcomes: MentionOutcome[]; extraOutcomes: number };

const STATUS_LABEL: Record<MentionStatus, string> = { live: "LIVE", new: "NEW", soon: "SOON", open: "OPEN" };
const STATUS_CLASS: Record<MentionStatus, string> = {
  live: "border-no/20 bg-no-bg text-no",
  new: "border-white/20 bg-surface-2 text-white",
  soon: "border-border-2 bg-surface-2 text-text",
  open: "border-border bg-bg text-text-2",
};

const { isWatched, toggle: toggleWatchlist } = useWatchlist();

const nowMs = useState("mentions-now-ms", () => Date.now());
const localTimeReady = ref(false);

const { data: tagsData, error: tagsError } = await useFetch<SubTag[]>("/api/category-tags", { query: { slug: MENTIONS_SLUG } });

const subTags = computed(() => tagsData.value ?? []);
const totalCount = computed(() => subTags.value.reduce((a, t) => a + (t.activeEventsCount ?? 0), 0));

const activeSlug = ref(MENTIONS_SLUG);
const activeLabel = computed(() => (activeSlug.value === MENTIONS_SLUG ? "Mentions" : (subTags.value.find((t) => t.slug === activeSlug.value)?.label ?? "Mentions")));

const { events, error, loading, pageError, loadMore, reset, retry, retryPage } = useCursorMarketFeed(activeSlug);

await reset(MENTIONS_SLUG);

onMounted(() => ((nowMs.value = Date.now()), (localTimeReady.value = true)));

useInfiniteScroll(loadMore, { threshold: 0.1 });

const mentionRows = computed(() => events.value.map(toMentionRow));
const liveCount = computed(() => mentionRows.value.filter((r) => r.status === "live").length);
const soonCount = computed(() => mentionRows.value.filter((r) => r.status === "soon").length);
const phraseCount = computed(() => mentionRows.value.reduce((a, r) => a + r.outcomes.length + r.extraOutcomes, 0));
const topVolume = computed(() => mentionRows.value.reduce((m, r) => Math.max(m, r.volume), 0));

const selectTag = (slug: string) => {
  if (slug !== activeSlug.value) reset(slug);
};

function toMentionRow(event: MarketFeedEvent): MentionRow {
  const markets = ((event.markets ?? []) as GammaMarket[]).filter((m) => m.active !== false && m.closed !== true);
  const ts = eventTimestamp(event, markets);
  const status = eventStatus(event, ts);
  const outcomes = markets
    .map(mentionOutcome)
    .filter((o): o is MentionOutcome => Boolean(o))
    .sort((a, b) => b.price - a.price);
  const vis = outcomes.slice(0, 3);
  const volume = toNumber(event.volume ?? event.volume24hr);

  return {
    event,
    id: String(event.id),
    title: event.title ?? markets[0]?.question ?? "Untitled mention market",
    href: `/event/${event.slug ?? event.id}?x=${event.id}`,
    icon: stringValue(event.icon ?? event.image),
    ...dateParts(ts),
    status,
    volume,
    volumeLabel: `$${fmtcn(volume)}`,
    signal: rowSignal(status, volume, outcomes.length),
    outcomes: vis,
    extraOutcomes: Math.max(0, outcomes.length - vis.length),
  };
}

function mentionOutcome(market: GammaMarket): MentionOutcome | null {
  const label = compactPhrase(market.groupItemTitle ?? market.question);
  return label ? { id: String(market.id), label, price: parseOutcomePrices(market).yes } : null;
}

const compactPhrase = (v: string | undefined) =>
  v
    ?.replace(/\s+/g, " ")
    .replace(/^will\s+/i, "")
    .trim() ?? "";

function eventTimestamp(event: MarketFeedEvent, markets: GammaMarket[]): number | null {
  const raw = stringValue(event.startTime) ?? stringValue(markets[0]?.gameStartTime) ?? stringValue(markets[0]?.startDate) ?? stringValue(event.endDate) ?? stringValue(markets[0]?.endDate);
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}

function eventStatus(event: MarketFeedEvent, ts: number | null): MentionStatus {
  if (event.live === true || (ts !== null && ts <= nowMs.value && event.closed !== true)) return "live";
  const c = stringValue(event.createdAt);
  if (c) {
    const cm = new Date(c).getTime();
    if (Number.isFinite(cm) && nowMs.value - cm <= 3 * 86_400_000) return "new";
  }
  return ts !== null && ts - nowMs.value <= 2 * 86_400_000 ? "soon" : "open";
}

function dateParts(ts: number | null) {
  if (ts === null) return { day: "TBD", month: "", time: "Time TBD" };
  const d = new Date(ts);
  const o = (opts: Intl.DateTimeFormatOptions) => (localTimeReady.value ? opts : { ...opts, timeZone: "UTC" });
  return {
    day: new Intl.DateTimeFormat("en-US", o({ day: "2-digit" })).format(d),
    month: new Intl.DateTimeFormat("en-US", o({ month: "short" })).format(d),
    time: new Intl.DateTimeFormat("en-US", o({ weekday: "short", hour: "numeric", minute: "2-digit" })).format(d),
  };
}

function rowSignal(status: MentionStatus, volume: number, n: number): string {
  if (status === "live") return "Live tape";
  if (volume >= 100000) return "Deep volume";
  if (volume >= 10000) return "Active book";
  return n >= 12 ? "Wide menu" : "Building";
}

const priceClass = (p: number) => proba(Math.round(p * 100));
const isRowWatched = (r: MentionRow) => isWatched(r.id);
const toggleRowWatch = (r: MentionRow) => toggleWatchlist({ id: r.id, slug: r.event.slug, title: r.title });
const stringValue = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
const toNumber = (v: unknown) => {
  const n = Number.parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};
const tagChipClass = (active: boolean) => ["pm-focus inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-[12.5px] font-semibold transition-colors duration-150", active ? "border-white/35 bg-surface-2 text-white" : "border-border bg-bg text-text-2 hover:border-border-2 hover:text-white"];
</script>

<template>
  <div class="pm-page">
    <div class="pm-container flex flex-col gap-5 py-6">
      <section class="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div class="max-w-3xl">
          <div class="mb-2 flex items-center gap-2">
            <Icon name="lucide:at-sign" class="h-4 w-4 text-text-3" />
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-3">Mention markets</span>
          </div>
          <h1 class="text-[28px] font-extrabold leading-9 text-white sm:text-[34px] sm:leading-10">{{ activeLabel }}</h1>
          <p class="mt-2 max-w-2xl text-sm font-medium leading-6 text-text-2">Live events where you can predict the words, phrases, and names that will be said.</p>
        </div>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-lg">
          <div class="rounded-lg border border-border bg-surface px-3 py-2">
            <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Live</div>
            <div class="font-mono mt-1 text-lg font-semibold text-no">{{ liveCount }}</div>
          </div>
          <div class="rounded-lg border border-border bg-surface px-3 py-2">
            <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Soon</div>
            <div class="font-mono mt-1 text-lg font-semibold text-white">{{ soonCount }}</div>
          </div>
          <div class="rounded-lg border border-border bg-surface px-3 py-2">
            <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Phrases</div>
            <div class="font-mono mt-1 text-lg font-semibold text-white">{{ fmtcn(phraseCount) }}</div>
          </div>
          <div class="rounded-lg border border-border bg-surface px-3 py-2">
            <div class="text-[10px] font-bold uppercase tracking-widest text-text-3">Top vol</div>
            <div class="font-mono mt-1 text-lg font-semibold text-white">${{ fmtcn(topVolume) }}</div>
          </div>
        </div>
      </section>

      <div v-if="!tagsError && subTags.length" class="-mx-5 overflow-x-auto px-5 sm:-mx-4 sm:px-4">
        <nav class="flex min-w-max items-center gap-2" aria-label="Mention filters">
          <button :class="tagChipClass(activeSlug === MENTIONS_SLUG)" @click="selectTag(MENTIONS_SLUG)">
            <span>All</span>
            <span class="font-mono text-[11px] text-text-3">{{ fmtcn(totalCount) }}</span>
          </button>
          <button v-for="tag in subTags" :key="tag.slug" :class="tagChipClass(activeSlug === tag.slug)" @click="selectTag(tag.slug)">
            <span>{{ tag.label }}</span>
            <span class="font-mono text-[11px] text-text-3">{{ fmtcn(tag.activeEventsCount ?? 0) }}</span>
          </button>
        </nav>
      </div>

      <div v-else-if="tagsError" class="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium leading-4 text-text-3">Mention filters unavailable.</div>

      <section class="flex flex-col gap-2.5 transition-opacity duration-150" :class="{ 'opacity-60': loading && mentionRows.length > 0 }">
        <div v-if="error && mentionRows.length === 0" class="flex min-h-60 items-center justify-center px-4">
          <div class="max-w-md rounded-xl border border-border bg-surface p-6 text-center">
            <p class="mb-2 text-base font-semibold leading-5.5 text-no">{{ error }}</p>
            <p class="mb-4 text-sm leading-5 text-text-3">The mention market feed is unavailable right now.</p>
            <button class="pm-button pm-button--secondary pm-focus min-h-10 px-4 text-sm font-semibold" :disabled="loading" @click="retry">Retry</button>
          </div>
        </div>

        <template v-else-if="loading && mentionRows.length === 0">
          <div v-for="i in 6" :key="`mention-skeleton-${i}`" class="grid min-h-31 grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[4rem_4.75rem_minmax(0,1fr)] lg:grid-cols-[4.25rem_5rem_minmax(0,1fr)_minmax(16rem,0.85fr)_auto]">
            <div class="pm-skeleton h-16 rounded-lg" />
            <div class="flex gap-3 sm:contents">
              <div class="pm-skeleton h-16 w-16 shrink-0 rounded-lg sm:h-19 sm:w-19" />
              <div class="min-w-0 flex-1 space-y-2 self-center">
                <div class="pm-skeleton h-5 w-4/5" />
                <div class="pm-skeleton h-4 w-2/5" />
              </div>
            </div>
            <div class="col-start-2 flex flex-wrap gap-1.5 sm:col-start-3 lg:col-start-auto lg:self-center lg:justify-end">
              <div class="pm-skeleton h-8 w-36 rounded-md" />
              <div class="pm-skeleton h-8 w-28 rounded-md" />
            </div>
            <div class="col-start-2 flex items-center gap-2 sm:col-start-3 lg:col-start-auto lg:self-center">
              <div class="pm-skeleton h-10 w-22 rounded-md" />
              <div class="pm-skeleton h-10 w-10 rounded-md" />
            </div>
          </div>
        </template>

        <div v-else-if="mentionRows.length === 0" class="flex min-h-60 items-center justify-center px-4">
          <div class="max-w-md text-center text-sm leading-5 text-text-3">No mention markets to show here right now.</div>
        </div>

        <template v-else>
          <article
            v-for="(row, index) in mentionRows"
            :key="row.id"
            class="group pm-focus grid min-h-31 grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-xl border border-border bg-surface p-3 transition-[border-color,background-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:border-border-2 hover:bg-surface-2 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:grid-cols-[4rem_4.75rem_minmax(0,1fr)] lg:grid-cols-[4.25rem_5rem_minmax(0,1fr)_minmax(16rem,0.85fr)_auto]"
            :style="{ '--card-index': Math.min(index, 8) }"
          >
            <NuxtLink :to="row.href" class="pm-focus flex h-16 flex-col items-center justify-center rounded-lg border border-border bg-bg text-center sm:h-19" :aria-label="`Open ${row.title}`">
              <span class="font-mono text-[24px] font-semibold leading-none text-white">{{ row.day }}</span>
              <span class="mt-1 text-xs font-bold uppercase leading-none text-text-2">{{ row.month }}</span>
            </NuxtLink>

            <div class="flex min-w-0 gap-3 sm:contents">
              <NuxtLink :to="row.href" class="pm-focus grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-2 sm:h-19 sm:w-19" :aria-label="`Open ${row.title}`">
                <MarketIcon v-if="row.icon" :src="row.icon" :alt="row.title" class="h-full w-full object-cover" />
                <Icon v-else name="lucide:message-square-quote" class="h-6 w-6 text-text-3" />
              </NuxtLink>

              <div class="min-w-0 self-center">
                <NuxtLink :to="row.href" class="pm-focus block rounded-sm">
                  <h2 class="line-clamp-2 text-[15px] font-bold leading-5.5 text-white transition-colors duration-150 group-hover:text-white sm:text-[17px] sm:leading-6">
                    {{ row.title }}
                  </h2>
                </NuxtLink>
                <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold leading-4 text-text-2">
                  <span class="font-mono rounded-md bg-bg px-1.5 py-0.5 text-text">{{ row.time }}</span>
                  <span class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide" :class="STATUS_CLASS[row.status]">
                    <span v-if="row.status === 'live'" class="h-1.5 w-1.5 rounded-full bg-no" />
                    {{ STATUS_LABEL[row.status] }}
                  </span>
                  <span class="font-mono text-text-3">{{ row.volumeLabel }} Vol</span>
                  <span class="hidden text-text-3 sm:inline">{{ row.signal }}</span>
                </div>
              </div>
            </div>

            <div class="col-start-2 flex min-w-0 flex-wrap items-center gap-1.5 sm:col-start-3 lg:col-start-auto lg:justify-end lg:self-center">
              <NuxtLink
                v-for="outcome in row.outcomes"
                :key="outcome.id"
                :to="row.href"
                class="pm-focus inline-flex h-8 min-w-0 max-w-full items-center gap-2 rounded-md border border-border bg-bg px-2.5 text-[12.5px] font-semibold text-text transition-colors duration-150 hover:border-border-2 hover:text-white group-hover:border-border-2"
              >
                <span class="min-w-0 truncate">{{ outcome.label }}</span>
                <span class="font-mono shrink-0 text-[11px] font-semibold" :class="priceClass(outcome.price)">{{ fmtcp(outcome.price) }}</span>
              </NuxtLink>
              <span v-if="row.extraOutcomes > 0" class="font-mono inline-flex h-8 items-center rounded-md border border-border bg-bg px-2.5 text-[12px] font-semibold text-text-2">+{{ row.extraOutcomes }}</span>
            </div>

            <div class="col-start-2 flex items-center gap-2 sm:col-start-3 lg:col-start-auto lg:self-center">
              <NuxtLink :to="row.href" class="pm-focus inline-flex h-10 min-w-22 items-center justify-center rounded-md bg-accent px-4 text-sm font-bold text-accent-fg transition-colors duration-150 hover:bg-accent-hover group-hover:bg-accent-hover">Trade</NuxtLink>
              <button
                type="button"
                class="pm-focus grid h-10 w-10 place-items-center rounded-md border border-border bg-bg text-text-3 transition-colors duration-150 hover:border-border-2 hover:text-white"
                :aria-label="isRowWatched(row) ? 'Remove from watchlist' : 'Add to watchlist'"
                :title="isRowWatched(row) ? 'Remove from watchlist' : 'Add to watchlist'"
                @click.prevent.stop="toggleRowWatch(row)"
              >
                <Icon name="lucide:star" class="h-4 w-4" :class="isRowWatched(row) ? 'fill-current text-white' : ''" />
              </button>
            </div>
          </article>
        </template>

        <div v-if="pageError && mentionRows.length > 0" class="flex justify-center px-4 py-4">
          <div class="inline-flex items-center gap-3 rounded-lg border border-[rgba(254,154,0,0.25)] bg-[rgba(254,154,0,0.08)] px-4 py-2 text-sm leading-5 text-[#fe9a00]">
            <span>{{ pageError }}</span>
            <button class="pm-focus font-semibold hover:text-white" :disabled="loading" @click="retryPage">Retry</button>
          </div>
        </div>

        <div ref="sentinel" class="h-16" />
      </section>
    </div>
  </div>
</template>
