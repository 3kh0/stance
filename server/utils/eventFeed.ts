import type { GammaEvent } from "~/types/gamma";

export const FEED_VIEWS = ["live", "futures"] as const;
export type FeedView = (typeof FEED_VIEWS)[number];
const PENDING_START_LOOKBACK_MS = 90 * 60_000;

export function eventList<T = GammaEvent>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];
  const r = payload as { data?: T[]; events?: T[] };
  return Array.isArray(r.data) ? r.data : Array.isArray(r.events) ? r.events : [];
}

export const eventKey = (e: GammaEvent) => String(e.id || e.slug || e.title);

export function feedStartMs(event: GammaEvent): number {
  const raw = event.markets?.find((m) => m.gameStartTime)?.gameStartTime ?? event.startTime;
  return parseGammaDate(raw) ?? Number.POSITIVE_INFINITY;
}

export function compareFeedEvents(a: GammaEvent, b: GammaEvent): number {
  const liveDiff = Number(b.live === true) - Number(a.live === true);
  if (liveDiff !== 0) return liveDiff;
  if (a.live === true && b.live === true) return Number(b.volume ?? 0) - Number(a.volume ?? 0);
  return feedStartMs(a) - feedStartMs(b) || Number(b.volume ?? 0) - Number(a.volume ?? 0);
}

export function mergeFeedEvents(payloads: unknown[], include: (event: GammaEvent) => boolean): GammaEvent[] {
  const events = new Map<string, GammaEvent>();
  for (const payload of payloads) for (const e of eventList(payload)) if (include(e)) events.set(eventKey(e), e);
  return [...events.values()].sort(compareFeedEvents);
}

export function filterFeedPayload(payload: unknown, include: (event: GammaEvent) => boolean): unknown {
  if (Array.isArray(payload)) return (payload as GammaEvent[]).filter(include);
  if (!payload || typeof payload !== "object") return payload;
  const r = payload as { data?: GammaEvent[]; events?: GammaEvent[] };
  if (Array.isArray(r.data)) return { ...r, data: r.data.filter(include) };
  if (Array.isArray(r.events)) return { ...r, events: r.events.filter(include) };
  return payload;
}

export function coerceFeedQuery(q: Record<string, unknown>) {
  return {
    view: coerceEnum(q.view, FEED_VIEWS) ?? "live",
    limit: coercePositiveInt(q.limit, { min: 1, max: 300 }) ?? 100,
    offset: coercePositiveInt(q.offset, { min: 0, max: 10_000 }) ?? 0,
  };
}

export function buildFeedQuery(o: { view: FeedView; limit: number; offset: number; tagSlug: string; tagId?: number }): Record<string, string | number | boolean | undefined> {
  return {
    limit: o.limit,
    offset: o.offset,
    closed: false,
    ...(o.tagId ? { tag_id: o.tagId } : { tag_slug: o.tagSlug }),
    ...(o.view === "futures" ? { order: "volume24hr", ascending: false } : { order: "startTime", ascending: true, start_time_min: new Date(Date.now() - PENDING_START_LOOKBACK_MS).toISOString() }),
  };
}

export async function fetchLiveMergedFeed(o: { tagSlug: string; tagId?: number; include: (event: GammaEvent) => boolean; limit?: number; offset?: number }) {
  const limit = Math.max(1, o.limit ?? 60);
  const offset = Math.max(0, o.offset ?? 0);
  const pageSize = 100;
  const params = buildFeedQuery({ view: "live", limit: Math.min(limit, pageSize), offset, tagSlug: o.tagSlug, tagId: o.tagId });
  const liveParams = { ...params, live: true, order: undefined, ascending: undefined, start_time_min: undefined, limit: 100, offset: 0 };
  const upcoming = Array.from({ length: Math.ceil(limit / pageSize) }, (_, i) => ({
    ...params,
    limit: Math.min(pageSize, limit - i * pageSize),
    offset: offset + i * pageSize,
  })).filter((p) => Number(p.limit) > 0);
  const payloads = await Promise.all([proxyUpstream(GAMMA_BASE_URL, "/events", liveParams), ...upcoming.map((p) => proxyUpstream(GAMMA_BASE_URL, "/events", p))]);
  return mergeFeedEvents(payloads, o.include);
}
