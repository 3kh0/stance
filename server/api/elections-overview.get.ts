import type { GammaMarket, GammaTag, MarketFeedEvent } from "~/types/gamma";
import { classifyCountry, GLOBAL_BUCKET } from "~/utils/elections";

interface SlimEvent {
  id: string;
  slug?: string;
  title?: string;
  icon?: string;
  image?: string;
  closed?: boolean;
  volume?: number | string;
  volume24hr?: number | string;
  tags?: GammaTag[];
  markets?: GammaMarket[];
}

type ElectionEvent = SlimEvent & { country: string };

const toNum = (v: unknown) => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

function slim(e: MarketFeedEvent): SlimEvent {
  return {
    id: String(e.id),
    slug: e.slug,
    title: e.title,
    icon: e.icon,
    image: e.image,
    closed: e.closed,
    volume: e.volume,
    volume24hr: e.volume24hr,
    tags: (e.tags as GammaTag[] | undefined)?.map((t) => ({ id: t.id, label: t.label, slug: t.slug })),
    markets: (e.markets ?? []).map((m) => ({
      id: m.id,
      question: m.question,
      groupItemTitle: m.groupItemTitle,
      active: m.active,
      closed: m.closed,
      outcomes: m.outcomes,
      outcomePrices: m.outcomePrices,
      oneDayPriceChange: m.oneDayPriceChange,
    })),
  };
}

const fetchPage = (offset: number) =>
  proxyUpstream<unknown>(GAMMA_BASE_URL, "/events", {
    tag_slug: "elections",
    closed: false,
    order: "volume24hr",
    ascending: false,
    limit: 100,
    offset,
  })
    .then((p) => eventList<MarketFeedEvent>(p))
    .catch(() => [] as MarketFeedEvent[]);

export default defineEventHandler(async () => {
  const pages = await Promise.all(Array.from({ length: 10 }, (_, i) => fetchPage(i * 100)));
  const byId = new Map<string, ElectionEvent>();
  for (const page of pages) {
    for (const e of page) {
      const s = slim(e);
      if (!byId.has(s.id)) byId.set(s.id, { ...s, country: classifyCountry(e) });
    }
  }
  const events = [...byId.values()];

  const tallies = new Map<string, { iso: string; count: number; volume: number }>();
  for (const e of events) {
    if (e.country === GLOBAL_BUCKET) continue;
    const vol = toNum(e.volume24hr ?? e.volume);
    const t = tallies.get(e.country);
    if (t) {
      t.count += 1;
      t.volume += vol;
    } else tallies.set(e.country, { iso: e.country, count: 1, volume: vol });
  }

  return {
    events,
    countries: [...tallies.values()].sort((a, b) => b.count - a.count || b.volume - a.volume),
  };
});
