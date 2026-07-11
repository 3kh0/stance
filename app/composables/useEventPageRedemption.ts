import type { Outcome, Position } from "~/types/account";
import type { GammaEvent, GammaMarket } from "~/types/gamma";
import { fmtm } from "~/utils/prices";
import { getResolution, positionKey } from "~/utils/markets";
import type { MarketWithPrice } from "~/composables/useEventPageChart";

interface RedeemableItem {
  market: MarketWithPrice;
  outcome: Outcome;
  position: Position;
}

export function useEventPageRedemption(o: {
  slug: ComputedRef<string>;
  event: Ref<GammaEvent | null | undefined>;
  resolved: ComputedRef<MarketWithPrice[]>;
  isClosed: ComputedRef<boolean>;
  account: ComputedRef<{ createdAt: number; positions: Position[] }>;
  redeemPosition: ReturnType<typeof useAccount>["redeemPosition"];
  outcomeLabel: (m: GammaMarket, side: Outcome) => string;
}) {
  const redemptionMsg = ref("");

  const redeemable = computed<RedeemableItem[]>(() => {
    const items: RedeemableItem[] = [];
    for (const m of o.resolved.value)
      for (const side of ["yes", "no"] as const) {
        const position = o.account.value.positions.find((p) => p.positionKey === positionKey(m.id, side));
        if (position) items.push({ market: m, outcome: side, position });
      }
    return items;
  });

  const redeemableTotal = computed(() => redeemable.value.reduce((s, it) => s + (getResolution(it.market) === it.outcome ? it.position.shares : 0), 0));
  const redeemableChecked = computed(() => o.isClosed.value && o.account.value.createdAt !== 0);

  const redeemOne = (it: RedeemableItem) => {
    const winner = getResolution(it.market);
    const result = o.redeemPosition(it.market.id, it.outcome, winner, {
      marketName: it.market.groupItemTitle || it.market.question || o.event.value?.title || "Resolved market",
      marketSlug: o.slug.value,
      marketIcon: it.market.icon || o.event.value?.icon,
      question: it.market.question,
    });
    if (!result) return;
    const label = o.outcomeLabel(it.market, it.outcome);
    redemptionMsg.value = it.outcome === winner ? `Redeemed $${fmtm(result.amount || 0)} from winning ${label} shares.` : `Cleared losing ${label} shares.`;
  };

  return {
    redemptionMsg,
    redeemable,
    redeemableTotal,
    redeemableChecked,
    redeemOne,
    redeemAll: () => redeemable.value.forEach(redeemOne),
    resetRedemption: () => (redemptionMsg.value = ""),
  };
}
