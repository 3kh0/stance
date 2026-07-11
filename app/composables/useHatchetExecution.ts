import type { Outcome, OrderSide } from "~/types/account";
import confetti from "canvas-confetti";
import type { Ref } from "vue";
import { limitOrderCost, type TradePreviewSnapshot } from "~/utils/markets";

interface HatchetMarketProps {
  marketId: string;
  marketSlug?: string;
  marketIcon?: string;
  marketTitle: string;
  marketQuestion?: string;
  conditionId?: string;
  yesTokenId?: string;
  noTokenId?: string;
  negRisk?: boolean;
  tickSize?: number;
}

interface TradeEmitPayload {
  type: OrderSide;
  outcome: Outcome;
  amount: number;
  shares: number;
  price: number;
  marketId: string;
  marketName: string;
}

export function useHatchetExecution(o: {
  props: HatchetMarketProps;
  orderType: Ref<OrderSide>;
  selectedOutcome: Ref<Outcome>;
  isLiveAccount: Ref<boolean>;
  account: Ref<{ balance: number }>;
  tickCents: Ref<number>;
  confirmedMode: Ref<"market" | "limit">;
  confirmedMarketable: Ref<boolean>;
  confirmedFillPriceCents: Ref<number>;
  previewSnapshot: Ref<TradePreviewSnapshot>;
  isExecuting: Ref<boolean>;
  liveError: Ref<string | null>;
  placedNotice: Ref<string | null>;
  showConfirmation: Ref<boolean>;
  createOrUpdatePosition: ReturnType<typeof useAccount>["createOrUpdatePosition"];
  sellPosition: ReturnType<typeof useAccount>["sellPosition"];
  addTransaction: ReturnType<typeof useAccount>["addTransaction"];
  saveAccount: ReturnType<typeof useAccount>["saveAccount"];
  placeOpenOrder: ReturnType<typeof useAccount>["placeOpenOrder"];
  placeLiveOrder: ReturnType<typeof usePolymarket>["placeLiveOrder"];
  placeLiveLimitOrder: ReturnType<typeof usePolymarket>["placeLiveLimitOrder"];
  syncLiveAccount: ReturnType<typeof usePolymarket>["syncLiveAccount"];
  emit: (event: "trade", payload: TradeEmitPayload) => void;
  emitOrderPlaced: () => void;
  closeConfirmation: () => void;
}) {
  let noticeTimer: ReturnType<typeof setTimeout>;
  const p = o.props;
  const liveTokenID = () => (o.selectedOutcome.value === "yes" ? p.yesTokenId : p.noTokenId);
  const details = () => ({ marketSlug: p.marketSlug, marketIcon: p.marketIcon, question: p.marketQuestion });

  function celebrate() {
    o.closeConfirmation();
    confetti({ particleCount: 100, angle: 90, spread: 90, origin: { x: 0.85, y: 0.7 }, startVelocity: 45 });
  }

  function showPlacedNotice() {
    o.placedNotice.value = "Limit order placed — it will fill when the market reaches your price.";
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (o.placedNotice.value = null), 6000);
  }

  function emitTrade(type: OrderSide, shares: number, price: number, amount: number) {
    o.emit("trade", { type, outcome: o.selectedOutcome.value, amount, shares, price, marketId: p.marketId, marketName: p.marketTitle });
  }

  function recordAndEmit(type: OrderSide, shares: number, price: number, amount: number, ledgerMarketId?: string) {
    o.addTransaction({ type, marketId: ledgerMarketId, marketName: p.marketQuestion || p.marketTitle, marketIcon: p.marketIcon, outcome: o.selectedOutcome.value, shares, price, amount });
    emitTrade(type, shares, price, amount);
  }

  function handleTrade(s: TradePreviewSnapshot) {
    if (!p.marketId || s.priceCents <= 0 || s.amount <= 0 || s.shares <= 0) return false;
    const price = s.priceCents / 100;

    if (o.orderType.value === "buy") {
      if (o.account.value.balance < s.amount) return false;
      o.createOrUpdatePosition(p.marketId, p.marketTitle, o.selectedOutcome.value, s.shares, price, details());
      o.saveAccount({ balance: o.account.value.balance - s.amount });
      recordAndEmit("buy", s.shares, price, s.amount, p.marketSlug || p.marketId);
      return true;
    }

    const tx = o.sellPosition(p.marketId, o.selectedOutcome.value, s.shares, price, { marketName: p.marketTitle, ...details() });
    if (!tx) return false;
    emitTrade("sell", tx.shares || s.shares, price, tx.amount || s.amount);
    return true;
  }

  async function executeLiveTrade(s: TradePreviewSnapshot) {
    const tokenID = liveTokenID();
    if (!tokenID || !p.conditionId) throw new Error("Live trading unavailable for this market");
    if (s.priceCents <= 0 || s.amount <= 0 || s.shares <= 0) throw new Error("Invalid order");
    const isBuy = o.orderType.value === "buy";
    await o.placeLiveOrder({ tokenID, side: o.orderType.value, amount: isBuy ? s.amount : s.shares, tickSize: p.tickSize, negRisk: p.negRisk });
    recordAndEmit(o.orderType.value, s.shares, s.priceCents / 100, s.amount, p.marketSlug || p.conditionId);
    await o.syncLiveAccount().catch(() => {});
  }

  async function executeLiveLimitOrder(s: TradePreviewSnapshot): Promise<boolean> {
    const tokenID = liveTokenID();
    if (!tokenID || !p.conditionId) throw new Error("Live trading unavailable for this market");
    if (s.priceCents <= 0 || s.shares <= 0) throw new Error("Invalid order");
    const response = await o.placeLiveLimitOrder({ tokenID, side: o.orderType.value, price: s.priceCents / 100, size: s.shares, tickSize: p.tickSize, negRisk: p.negRisk });
    const matched = response?.status === "matched";
    if (matched) recordAndEmit(o.orderType.value, s.shares, s.priceCents / 100, s.amount, p.marketSlug || p.conditionId);
    await o.syncLiveAccount().catch(() => {});
    return !matched;
  }

  function executePaperLimitOrder(s: TradePreviewSnapshot): boolean {
    if (!p.marketId) throw new Error("Market unavailable");
    const limit = s.priceCents / 100;
    if (limit <= 0 || limit >= 1 || s.shares <= 0) throw new Error("Invalid order");
    const d = details();

    if (o.confirmedMarketable.value) {
      if (o.orderType.value === "buy") {
        const fill = Math.min(Math.max(o.confirmedFillPriceCents.value, o.tickCents.value), s.priceCents) / 100;
        const cost = limitOrderCost(fill * 100, s.shares);
        if (cost > o.account.value.balance) throw new Error("Not enough balance");
        o.createOrUpdatePosition(p.marketId, p.marketTitle, o.selectedOutcome.value, s.shares, fill, d);
        o.saveAccount({ balance: Math.round((o.account.value.balance - cost) * 100) / 100 });
        recordAndEmit("buy", s.shares, fill, cost, p.marketSlug || p.marketId);
        return false;
      }

      const fill = Math.max(o.confirmedFillPriceCents.value, s.priceCents) / 100;
      const tx = o.sellPosition(p.marketId, o.selectedOutcome.value, s.shares, fill, { marketName: p.marketTitle, ...d });
      if (!tx) throw new Error("No position to sell");
      emitTrade("sell", tx.shares || s.shares, fill, tx.amount || s.amount);
      return false;
    }

    const order = o.placeOpenOrder({ marketId: p.marketId, outcome: o.selectedOutcome.value, side: o.orderType.value, price: limit, shares: s.shares, marketName: p.marketTitle, tokenId: liveTokenID(), ...d });
    if (!order) throw new Error(o.orderType.value === "buy" ? "Not enough balance" : "Not enough uncommitted shares");
    return true;
  }

  async function executeOrder() {
    if (o.isExecuting.value) return;
    o.isExecuting.value = true;
    o.liveError.value = null;
    const fail = (e: unknown) => {
      o.liveError.value = e instanceof Error ? e.message : "Order failed. Please try again.";
      o.isExecuting.value = false;
    };

    if (o.confirmedMode.value === "limit") {
      try {
        const resting = o.isLiveAccount.value ? await executeLiveLimitOrder(o.previewSnapshot.value) : executePaperLimitOrder(o.previewSnapshot.value);
        if (resting) {
          o.closeConfirmation();
          showPlacedNotice();
          o.emitOrderPlaced();
        } else celebrate();
      } catch (e) {
        fail(e);
      }
      return;
    }

    if (o.isLiveAccount.value) {
      try {
        await executeLiveTrade(o.previewSnapshot.value);
        celebrate();
      } catch (e) {
        fail(e);
      }
      return;
    }

    if (handleTrade(o.previewSnapshot.value)) celebrate();
    else o.isExecuting.value = false;
  }

  return { executeOrder };
}
