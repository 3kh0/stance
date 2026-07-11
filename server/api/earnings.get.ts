import type { EarningsEntry } from "~/types/earnings";
import type { GammaEvent, GammaMarket } from "~/types/gamma";

export default defineEventHandler(async (event): Promise<EarningsEntry[]> => {
  const limit = coercePositiveInt(getQuery(event).limit, { min: 1, max: 100 }) ?? 100;
  const events = await proxyUpstream<GammaEvent[]>(GAMMA_BASE_URL, "/events", {
    tag_slug: "earnings",
    closed: false,
    limit,
    order: "startDate",
    ascending: true,
  });
  if (!Array.isArray(events)) return [];
  return events
    .map(normalize)
    .filter((e): e is EarningsEntry => e !== null)
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate) || a.ticker.localeCompare(b.ticker));
});

function normalize(event: GammaEvent): EarningsEntry | null {
  const reportDate = event.endDate ?? event.startTime;
  if (!reportDate) return null;
  const reported = new Date(reportDate);
  if (Number.isNaN(reported.getTime())) return null;
  const title = event.title ?? "";
  const ticker = parseTicker(title, event.slug);
  if (!ticker) return null;
  return {
    id: String(event.id),
    slug: event.slug ?? String(event.id),
    ticker,
    company: parseCompany(title) ?? ticker,
    icon: event.icon ?? event.image,
    reportDate: reported.toISOString(),
    session: reported.getUTCHours() < 17 ? "pre" : "post",
    beatPct: Math.round(yesPrice(event.markets?.[0]) * 100),
    epsEstimate: parseEps(event.slug, event.description),
    volume: Number.parseFloat(String(event.volume ?? 0)) || 0,
  };
}

function yesPrice(market: GammaMarket | undefined): number {
  if (!market?.outcomePrices) return 0;
  try {
    const yes = Number.parseFloat(JSON.parse(market.outcomePrices)?.[0]);
    return Number.isFinite(yes) ? yes : 0;
  } catch {
    return 0;
  }
}

function parseTicker(title: string, slug?: string): string | null {
  const fromTitle = title.match(/\(([A-Za-z][A-Za-z.]{0,5})\)/)?.[1];
  if (fromTitle) return fromTitle.toUpperCase();
  const fromSlug = slug?.match(/^([a-z]{1,6})-/)?.[1];
  return fromSlug ? fromSlug.toUpperCase() : null;
}

const parseCompany = (title: string) => title.match(/^Will\s+(.+?)\s+\(/)?.[1]?.trim() ?? null;

function parseEps(slug?: string, description?: string): number | null {
  const fromSlug = slug?.match(/-(\d+)pt(\d+)$/);
  if (fromSlug) {
    const n = Number.parseFloat(`${fromSlug[1]}.${fromSlug[2]}`);
    if (Number.isFinite(n)) return n;
  }
  const fromDesc = description?.match(/EPS[^$]*\$(\d+(?:\.\d+)?)/i)?.[1];
  if (fromDesc) {
    const n = Number.parseFloat(fromDesc);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
