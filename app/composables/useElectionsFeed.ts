import type { MarketFeedEvent } from "~/types/gamma";
import { classifyCountry, GLOBAL_BUCKET } from "~/utils/elections";

export interface CountryTally {
  iso: string;
  count: number;
  volume: number;
}

interface ElectionsOverview {
  events: (MarketFeedEvent & { country?: string })[];
  countries: CountryTally[];
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export function useElectionsFeed() {
  const selectedCountry = ref<string | null>(null);

  const { data, pending, error, refresh } = useFetch<ElectionsOverview>("/api/elections-overview", {
    lazy: true,
    server: false,
    default: () => ({ events: [], countries: [] }),
  });

  let timer: ReturnType<typeof setInterval> | null = null;
  onMounted(() => {
    timer = setInterval(() => void ((typeof document !== "undefined" && document.visibilityState === "hidden") || refresh()), 45_000);
  });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
  });

  const countries = computed<CountryTally[]>(() => data.value?.countries ?? []);
  const allEvents = computed(() => data.value?.events ?? []);
  const countryOf = (e: MarketFeedEvent & { country?: string }) => e.country ?? classifyCountry(e);

  const filteredEvents = computed<MarketFeedEvent[]>(() => {
    const list = selectedCountry.value === null ? allEvents.value : allEvents.value.filter((e) => countryOf(e) === selectedCountry.value);
    return [...list].sort((a, b) => toNumber(b.volume24hr ?? b.volume) - toNumber(a.volume24hr ?? a.volume));
  });

  const visibleCount = ref(24);
  watch(selectedCountry, () => (visibleCount.value = 24));
  const visibleEvents = computed<MarketFeedEvent[]>(() => filteredEvents.value.slice(0, visibleCount.value));
  const hasMore = computed(() => visibleCount.value < filteredEvents.value.length);

  return {
    loading: pending,
    error,
    refresh,
    countries,
    selectedCountry,
    filteredEvents,
    visibleEvents,
    hasMore,
    reachEnd: () => void (hasMore.value && (visibleCount.value += 24)),
    totalCount: computed(() => allEvents.value.length),
    globalCount: computed(() => allEvents.value.filter((e) => countryOf(e) === GLOBAL_BUCKET).length),
    selectCountry: (iso: string | null) => (selectedCountry.value = selectedCountry.value === iso ? null : iso),
  };
}
