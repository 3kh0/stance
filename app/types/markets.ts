import type { MarketFeedEvent } from "~/types/gamma";

export const DISPUTE_STAGES = ["clarification", "proposed", "disputed", "reproposed", "voting", "resolved", "settled"] as const;

export type DisputeStage = (typeof DISPUTE_STAGES)[number];
export type DisputeStageFilter = "all" | DisputeStage;
export const DISPUTE_STAGE_LABEL: Record<DisputeStage, string> = { clarification: "Clarification", proposed: "Proposed", disputed: "Disputed", reproposed: "Re-proposed", voting: "Voting", resolved: "Resolved", settled: "Settled" };
const MUTED = "border-border bg-surface-2 text-text-2";
const DANGER = "border-no/20 bg-no-bg text-no";
const OK = "border-yes/20 bg-yes-bg text-yes";
export const DISPUTE_STAGE_CLASS: Record<DisputeStage, string> = {
  clarification: MUTED,
  proposed: MUTED,
  disputed: DANGER,
  reproposed: MUTED,
  voting: DANGER,
  resolved: OK,
  settled: OK,
};
export const DISPUTE_NEXT_STEPS: Record<DisputeStage, string> = {
  clarification: "Resolution context is being clarified before or during the UMA request.",
  proposed: "If the proposal is not disputed before the deadline, UMA can resolve this market.",
  disputed: "The first dispute usually resets the request; a later dispute can escalate to UMA DVM voting.",
  reproposed: "A new proposal is live. If it is disputed again, the question can move to UMA DVM voting.",
  voting: "UMA token holders vote on the answer, then the market can move to final resolution.",
  resolved: "The final answer is available. Settlement and redemption are the remaining steps.",
  settled: "The market has finished the UMA settlement path.",
};

export interface DisputeTimelineEntry {
  id: string;
  stage: DisputeStage;
  label: string;
  occurredAt: string | null;
  outcome: string | null;
  actor: string | null;
  txHash: string | null;
  txUrl: string | null;
  bond: string | null;
  reward: string | null;
  description: string;
}
export interface DisputeMarket {
  id: string;
  conditionId: string | null;
  questionId: string | null;
  question: string;
  slug: string | null;
  image: string | null;
  volume: number;
  outcomes: string[];
  yesPrice: number;
  noPrice: number;
  stage: DisputeStage;
  rawStatus: string;
  updatedAt: string | null;
  endDate: string | null;
  closedTime: string | null;
  umaEndDate: string | null;
  countdownTarget: string | null;
  umaBond: string | null;
  umaReward: string | null;
  resolvedBy: string | null;
  timeline: DisputeTimelineEntry[];
}
export interface DisputeFeedResponse {
  markets: DisputeMarket[];
  updatedAt: string;
  scanned: number;
}

export function normalizeUmaResolutionStatus(status: unknown): DisputeStage | null {
  if (status === undefined || status === null || status === "") return null;
  const v = String(status)
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (!v) return null;
  if (v.includes("clarif")) return "clarification";
  if (v.includes("settle")) return "settled";
  if (v.includes("resolve")) return "resolved";
  if (v.includes("vot") || v.includes("dvm")) return "voting";
  if (v.includes("re-propos") || v.includes("repropos") || v.includes("reset")) return "reproposed";
  if (v.includes("disput")) return "disputed";
  return "proposed";
}

export const disputeStageLabel = (stage: DisputeStage): string => DISPUTE_STAGE_LABEL[stage];

export function disputeStageMatchesFilter(stage: DisputeStage, filter: DisputeStageFilter): boolean {
  if (filter === "all") return true;
  if (filter === "resolved") return stage === "resolved" || stage === "settled";
  return stage === filter;
}

export interface TagItem {
  label: string;
  slug: string;
}
export interface SubTag extends TagItem {
  activeEventsCount?: number;
  id?: string | number;
}
export interface MarketsResponse {
  data?: MarketFeedEvent[];
  events?: MarketFeedEvent[];
  next_cursor?: string | null;
}
