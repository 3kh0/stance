import type { DisputeFeedResponse, DisputeMarket, DisputeStage, DisputeStageFilter, DisputeTimelineEntry } from "~/types/markets";
import { DISPUTE_STAGES, disputeStageLabel, disputeStageMatchesFilter, normalizeUmaResolutionStatus } from "~/types/markets";

type Raw = {
  id?: string | number;
  conditionId?: string;
  questionID?: string;
  questionId?: string;
  question?: string;
  slug?: string;
  image?: string;
  icon?: string;
  volume?: string | number;
  volumeNum?: string | number;
  outcomes?: string[] | string;
  outcomePrices?: string[] | string;
  umaResolutionStatus?: string | null;
  umaEndDate?: string;
  umaBond?: string | number;
  umaReward?: string | number;
  resolvedBy?: string;
  endDate?: string;
  closedTime?: string;
  updatedAt?: string;
};

const STAGE_FILTERS = ["all", ...DISPUTE_STAGES] as const;
const PAGE = 100;
const MAX_PAGES = 8;
const MAX = 160;

const DESC: Record<DisputeStage, string> = {
  clarification: "Polymarket posted or updated resolution context for the UMA request.",
  proposed: "A bonded outcome was proposed to UMA's Optimistic Oracle.",
  disputed: "The proposed answer was disputed during the liveness window.",
  reproposed: "The first dispute reset the request and a new bonded answer is live.",
  voting: "A follow-up dispute escalated the question to UMA DVM voting.",
  resolved: "UMA returned a final answer for this market.",
  settled: "The market has been settled after UMA resolution.",
};

const unpack = (p: Raw[] | { data?: Raw[]; markets?: Raw[] }): Raw[] => (Array.isArray(p) ? p : Array.isArray(p.data) ? p.data : Array.isArray(p.markets) ? p.markets : []);

function strs(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v !== "string" || !v) return [];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

const prices = (v: unknown) =>
  strs(v).map((p) => {
    const n = Number.parseFloat(p);
    return Number.isFinite(n) ? n : 0;
  });
const num = (v: unknown) => {
  const n = Number.parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};
const ns = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const money = (v: unknown): string | null => (v === undefined || v === null ? null : String(v));

function timeline(m: Raw, stage: DisputeStage, outcome: string | null): DisputeTimelineEntry[] {
  const requestedAt = ns(m.closedTime) ?? ns(m.endDate);
  const currentAt = ns(m.updatedAt) ?? ns(m.umaEndDate) ?? requestedAt;
  const bond = money(m.umaBond);
  const reward = money(m.umaReward);
  const entries: DisputeTimelineEntry[] = [];
  const push = (s: DisputeStage, at: string | null, suffix = "") => {
    entries.push({
      id: `${s}-${entries.length}${suffix}`,
      stage: s,
      label: disputeStageLabel(s),
      occurredAt: at,
      outcome,
      actor: null,
      txHash: null,
      txUrl: null,
      bond,
      reward,
      description: DESC[s],
    });
  };

  push("proposed", requestedAt, "-initial");
  if (stage === "clarification") push("clarification", currentAt);
  if (stage === "disputed" || stage === "reproposed" || stage === "voting") push("disputed", currentAt);
  if (stage === "reproposed" || stage === "voting") push("reproposed", currentAt);
  if (stage === "voting") push("voting", currentAt);
  if (stage === "resolved" || stage === "settled") push("resolved", currentAt);
  if (stage === "settled") push("settled", currentAt);
  return entries.reverse();
}

function normalize(m: Raw): DisputeMarket | null {
  const stage = normalizeUmaResolutionStatus(m.umaResolutionStatus);
  if (!stage) return null;

  const outcomes = strs(m.outcomes);
  const ps = prices(m.outcomePrices);
  const yes = ps[0] ?? 0;
  const no = ps[1] ?? 0;
  const outcome = outcomes.length === 0 ? null : outcomes.length === 1 || yes >= no ? outcomes[0]! : outcomes[1]!;
  const umaEndDate = ns(m.umaEndDate);
  const id = String(m.id ?? m.conditionId ?? m.questionID ?? m.questionId ?? m.slug ?? "");
  if (!id) return null;

  return {
    id,
    conditionId: ns(m.conditionId),
    questionId: ns(m.questionID) ?? ns(m.questionId),
    question: m.question ?? "Untitled market",
    slug: ns(m.slug),
    image: ns(m.image) ?? ns(m.icon),
    volume: num(m.volumeNum ?? m.volume),
    outcomes,
    yesPrice: yes,
    noPrice: no,
    stage,
    rawStatus: String(m.umaResolutionStatus),
    updatedAt: ns(m.updatedAt),
    endDate: ns(m.endDate),
    closedTime: ns(m.closedTime),
    umaEndDate,
    countdownTarget: stage === "resolved" || stage === "settled" ? null : umaEndDate,
    umaBond: money(m.umaBond),
    umaReward: money(m.umaReward),
    resolvedBy: ns(m.resolvedBy),
    timeline: timeline(m, stage, outcome),
  };
}

export default defineEventHandler(async (event): Promise<DisputeFeedResponse> => {
  const stageFilter = (coerceEnum(getQuery(event).stage, STAGE_FILTERS) ?? "all") as DisputeStageFilter;
  const markets: DisputeMarket[] = [];
  const seen = new Set<string>();
  let scanned = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const raw = unpack(await proxyUpstream(GAMMA_BASE_URL, "/markets", { limit: PAGE, offset: page * PAGE, order: "umaEndDate", ascending: false }));
    scanned += raw.length;
    for (const m of raw) {
      const d = normalize(m);
      if (!d || !disputeStageMatchesFilter(d.stage, stageFilter) || seen.has(d.id)) continue;
      seen.add(d.id);
      markets.push(d);
      if (markets.length >= MAX) break;
    }
    if (raw.length < PAGE || markets.length >= MAX) break;
  }

  const ts = (m: DisputeMarket) => {
    const t = Date.parse(m.umaEndDate ?? m.updatedAt ?? m.closedTime ?? m.endDate ?? "");
    return Number.isFinite(t) ? t : 0;
  };
  markets.sort((a, b) => ts(b) - ts(a));
  return { markets, updatedAt: new Date().toISOString(), scanned };
});
