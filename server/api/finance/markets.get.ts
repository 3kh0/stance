import type { GammaEvent } from "~/types/gamma";

const ALLOWED_FINANCE_FILTERS = ["all", "finance", "daily", "weekly", "monthly", "stocks", "earnings", "indicies", "commodities", "forex", "acquisitions", "ipo", "fed-rates", "prediction-markets", "treasuries", "kpis", "privates"] as const;
const ALLOWED_FINANCE_ORDERS = ["volume24hr", "volume", "liquidity", "startDate", "endDate", "closedTime", "competitive"] as const;
const ALLOWED_FINANCE_STATUS = ["active", "resolved"] as const;
const ALLOWED_RECURRENCES = ["hourly", "daily", "weekly", "monthly", "yearly"] as const;

type FinanceFilter = (typeof ALLOWED_FINANCE_FILTERS)[number];
type FinanceOrder = (typeof ALLOWED_FINANCE_ORDERS)[number];
type FinanceStatus = (typeof ALLOWED_FINANCE_STATUS)[number];
type FinanceRecurrence = (typeof ALLOWED_RECURRENCES)[number];

const FINANCE_TAG_IDS: Record<FinanceFilter, string[]> = {
  all: ["120"],
  finance: ["120"],
  weekly: ["120"],
  monthly: ["120"],
  daily: ["120", "102281"],
  stocks: ["120", "102676"],
  earnings: ["120", "1013"],
  indicies: ["120", "102682"],
  commodities: ["120", "101031"],
  forex: ["120", "105093"],
  acquisitions: ["120", "102691"],
  ipo: ["120", "102599", "600"],
  "fed-rates": ["120", "100196"],
  "prediction-markets": ["120", "93"],
  treasuries: ["120", "102028"],
  kpis: ["120", "104548"],
  privates: ["120", "104970"],
};

const RECURRENCE_TAG_IDS: Record<FinanceRecurrence, string> = {
  hourly: "102175",
  daily: "102281",
  weekly: "102264",
  monthly: "102144",
  yearly: "102536",
};

interface GammaKeysetResponse {
  events?: GammaEvent[];
  next_cursor?: string | null;
}

type PageOpts = { tagId: string; category: FinanceFilter; recurrence?: FinanceRecurrence; status: FinanceStatus; order: FinanceOrder; limit: number; cursor?: string };

export default defineEventHandler(async (event): Promise<GammaKeysetResponse> => {
  const q = getQuery(event);
  const requested = coerceEnum(q.category, ALLOWED_FINANCE_FILTERS) ?? "finance";
  const status = coerceEnum(q.status, ALLOWED_FINANCE_STATUS) ?? "active";
  const explicitRecurrence = coerceEnum(q.recurrence, ALLOWED_RECURRENCES);
  const order = coerceEnum(q.order, ALLOWED_FINANCE_ORDERS) ?? "volume24hr";
  const limit = coercePositiveInt(q.limit, { min: 1, max: 100 }) ?? 20;
  const cursor = q.cursor?.toString();

  const { category, recurrence } = resolveFilter(requested, explicitRecurrence);
  const tags = FINANCE_TAG_IDS[category] ?? FINANCE_TAG_IDS.finance;
  const tagId = tags[tags.length - 1]!;

  if (recurrence) {
    const events = await fetchRecurring(category, tagId, recurrence, status, order);
    return { events: sortEvents(events, order), next_cursor: null };
  }

  const response = await fetchPage({ tagId, category, status, order, limit, cursor });
  return { ...response, events: normalizeEvents(response.events ?? []) };
});

function resolveFilter(filter: FinanceFilter, recurrence: FinanceRecurrence | undefined): { category: FinanceFilter; recurrence?: FinanceRecurrence } {
  if (recurrence) return { category: filter === "all" ? "finance" : filter, recurrence };
  if (filter === "all") return { category: "finance" };
  if (filter === "weekly" || filter === "monthly") return { category: "finance", recurrence: filter };
  return { category: filter };
}

function baseParams({ tagId, category, recurrence, status, order, limit, cursor }: PageOpts): Record<string, string | number | boolean | undefined> {
  return {
    tag_id: tagId,
    limit,
    order,
    ascending: false,
    closed: status === "resolved",
    ...(status !== "resolved" ? { end_date_min: new Date().toISOString() } : {}),
    ...(recurrence ? { recurrence } : {}),
    ...(cursor ? { after_cursor: cursor } : {}),
    ...(category === "daily" || recurrence === "weekly" || recurrence === "monthly" ? { exclude_tag_id: "21" } : {}),
  };
}

const fetchPage = (o: PageOpts) => proxyUpstream<GammaKeysetResponse>(GAMMA_BASE_URL, "/events/keyset", baseParams(o));

async function fetchRecurring(category: FinanceFilter, tagId: string, recurrence: FinanceRecurrence, status: FinanceStatus, order: FinanceOrder): Promise<GammaEvent[]> {
  const [financeTagged, recurrenceTagged] = await Promise.all([fetchPage({ tagId, category, recurrence, status, order, limit: 100 }), fetchPage({ tagId: RECURRENCE_TAG_IDS[recurrence], category, status, order, limit: 100 })]);
  const merged = new Map<string, GammaEvent>();
  for (const e of normalizeEvents(financeTagged.events ?? [])) if (e.id) merged.set(String(e.id), e);
  for (const e of normalizeEvents(recurrenceTagged.events ?? []).filter((e) => e.tags?.some((t) => String(t.id) === tagId))) if (e.id) merged.set(String(e.id), e);
  return [...merged.values()];
}

const normalizeEvents = (events: GammaEvent[]): GammaEvent[] =>
  events.map((e) => ({
    ...e,
    markets:
      e.markets?.map((m) => ({
        ...m,
        outcomes: jsonField(m.outcomes),
        outcomePrices: jsonField(m.outcomePrices),
        clobTokenIds: jsonField(m.clobTokenIds),
      })) ?? [],
  }));

function jsonField(value: unknown): string | undefined {
  if (Array.isArray(value)) return JSON.stringify(value);
  return typeof value === "string" ? value : undefined;
}

function sortEvents(events: GammaEvent[], order: FinanceOrder): GammaEvent[] {
  return [...events].sort((a, b) => compare(a, b, order) * -1);
}

function compare(a: GammaEvent, b: GammaEvent, order: FinanceOrder): number {
  if (order === "startDate") return dateVal(a.startTime ?? a.markets?.[0]?.startDate) - dateVal(b.startTime ?? b.markets?.[0]?.startDate);
  if (order === "endDate") return dateVal(a.endDate ?? a.markets?.[0]?.endDate) - dateVal(b.endDate ?? b.markets?.[0]?.endDate);
  if (order === "closedTime") return dateVal(a.markets?.[0]?.closedTime) - dateVal(b.markets?.[0]?.closedTime);
  if (order === "liquidity") return numVal(a.liquidity) - numVal(b.liquidity);
  if (order === "volume") return numVal(a.volume) - numVal(b.volume);
  return numVal(a.volume24hr) - numVal(b.volume24hr);
}

function numVal(v: unknown): number {
  const n = Number.parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function dateVal(v: unknown): number {
  if (typeof v !== "string") return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}
