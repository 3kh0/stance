import type { Account, OpenOrder, Outcome, Position, PositionDetails, Transaction } from "~/types/account";
import { SHARE_EPSILON } from "~/utils/constants";
import { generateId } from "~/utils/accountStorage";
import { floorToCents, limitOrderCost, positionKey, roundToCents, weightedAverageEntryPrice } from "~/utils/markets";

export interface PaperLedgerDeps {
  getCurrent: () => Account | undefined;
  persist: () => void;
}

export function createPaperLedger({ getCurrent, persist }: PaperLedgerDeps) {
  const paper = () => {
    const a = getCurrent();
    return a?.kind === "paper" ? a : undefined;
  };

  const buildTx = (t: Omit<Transaction, "id" | "timestamp">): Transaction => ({ ...t, id: generateId(), timestamp: Date.now() });

  const applyDetails = (p: Position, d?: PositionDetails) => {
    if (!d) return;
    if (d.marketSlug) p.marketSlug = d.marketSlug;
    if (d.marketIcon) p.marketIcon = d.marketIcon;
    if (d.question) p.question = d.question;
  };

  const createOrUpdatePosition = (marketId: string, marketName: string, outcome: Outcome, shares: number, price: number, details?: PositionDetails) => {
    const cur = paper();
    if (!cur) return;
    const key = positionKey(marketId, outcome);
    const idx = cur.positions.findIndex((p) => p.positionKey === key);

    if (idx >= 0) {
      const p = cur.positions[idx]!;
      applyDetails(p, details);
      const total = p.shares + shares;
      if (total <= 0) cur.positions.splice(idx, 1);
      else {
        if (shares > 0) p.entryPrice = weightedAverageEntryPrice(p.shares, p.entryPrice, shares, price);
        p.shares = total;
        p.currentPrice = price;
      }
    } else if (shares > 0) {
      cur.positions.push({
        positionKey: key,
        marketId,
        outcome,
        marketName: `${marketName} - ${outcome === "yes" ? "Yes" : "No"}`,
        shares,
        entryPrice: price,
        currentPrice: price,
        marketSlug: details?.marketSlug,
        marketIcon: details?.marketIcon,
        question: details?.question,
      });
    }
    persist();
  };

  const sellPosition = (marketId: string, outcome: Outcome, sharesToSell: number, price: number, details?: PositionDetails & { marketName?: string }) => {
    const cur = paper();
    if (!cur) return null;
    const key = positionKey(marketId, outcome);
    const idx = cur.positions.findIndex((p) => p.positionKey === key);
    if (idx < 0 || !Number.isFinite(sharesToSell) || sharesToSell <= 0 || !Number.isFinite(price) || price <= 0) return null;

    const p = cur.positions[idx]!;
    applyDetails(p, details);
    const all = sharesToSell >= p.shares - SHARE_EPSILON;
    const settled = all ? p.shares : Math.min(floorToCents(sharesToSell), p.shares);
    if (settled <= 0) return null;
    const amount = floorToCents(settled * price);
    if (amount <= 0) return null;

    const remaining = all ? 0 : roundToCents(p.shares - settled);
    if (remaining <= 0) cur.positions.splice(idx, 1);
    else {
      p.shares = remaining;
      p.currentPrice = price;
    }

    const tx = buildTx({
      type: "sell",
      marketId: details?.marketSlug || p.marketSlug || marketId,
      marketName: details?.question || p.question || details?.marketName || p.marketName,
      marketIcon: details?.marketIcon || p.marketIcon,
      question: details?.question || p.question,
      outcome,
      shares: settled,
      price,
      amount,
    });
    cur.balance = roundToCents(cur.balance + amount);
    cur.transactions.push(tx);
    persist();
    return tx;
  };

  const availableShares = (marketId: string, outcome: Outcome) => {
    const cur = getCurrent();
    if (!cur) return 0;
    const p = cur.positions.find((x) => x.positionKey === positionKey(marketId, outcome));
    if (!p) return 0;
    const committed = cur.openOrders.filter((o) => o.side === "sell" && o.marketId === marketId && o.outcome === outcome).reduce((s, o) => s + o.shares, 0);
    return Math.max(p.shares - committed, 0);
  };

  const placeOpenOrder = (order: Omit<OpenOrder, "id" | "createdAt" | "reserved">) => {
    const cur = paper();
    if (!cur || !Number.isFinite(order.price) || order.price <= 0 || order.price >= 1 || !Number.isFinite(order.shares) || order.shares <= 0) return null;

    let reserved = 0;
    if (order.side === "buy") {
      reserved = limitOrderCost(order.price * 100, order.shares);
      if (reserved <= 0 || reserved > cur.balance) return null;
      cur.balance = roundToCents(cur.balance - reserved);
    } else if (order.shares > availableShares(order.marketId, order.outcome) + SHARE_EPSILON) return null;

    const o: OpenOrder = { ...order, id: generateId(), createdAt: Date.now(), reserved };
    cur.openOrders.push(o);
    persist();
    return o;
  };

  const cancelOpenOrder = (orderId: string) => {
    const cur = getCurrent();
    if (!cur) return false;
    const idx = cur.openOrders.findIndex((o) => o.id === orderId);
    if (idx < 0) return false;
    const [order] = cur.openOrders.splice(idx, 1);
    if (order && order.reserved > 0) cur.balance = roundToCents(cur.balance + order.reserved);
    persist();
    return true;
  };

  const fillOpenOrder = (orderId: string, fillPriceDollars: number) => {
    const cur = getCurrent();
    if (!cur) return null;
    const idx = cur.openOrders.findIndex((o) => o.id === orderId);
    if (idx < 0) return null;
    const order = cur.openOrders[idx]!;
    if (!Number.isFinite(fillPriceDollars) || fillPriceDollars <= 0) return null;
    cur.openOrders.splice(idx, 1);

    const details = { marketSlug: order.marketSlug, marketIcon: order.marketIcon, question: order.question };
    if (order.side === "sell") {
      const tx = sellPosition(order.marketId, order.outcome, order.shares, fillPriceDollars, { ...details, marketName: order.marketName });
      if (!tx) persist();
      return tx;
    }

    const cost = limitOrderCost(fillPriceDollars * 100, order.shares);
    const refund = Math.max(order.reserved - cost, 0);
    if (refund > 0) cur.balance = roundToCents(cur.balance + refund);
    createOrUpdatePosition(order.marketId, order.marketName, order.outcome, order.shares, fillPriceDollars, details);
    return addTransaction({
      type: "buy",
      marketId: order.marketSlug || order.marketId,
      marketName: order.question || order.marketName,
      marketIcon: order.marketIcon,
      question: order.question,
      outcome: order.outcome,
      shares: order.shares,
      price: fillPriceDollars,
      amount: cost,
    });
  };

  const checkOpenOrdersAgainstBook = (marketId: string, outcome: Outcome, bestBidCents: number | null | undefined, bestAskCents: number | null | undefined) => {
    const cur = paper();
    if (!cur) return [];
    const filled: OpenOrder[] = [];
    for (const o of cur.openOrders.filter((x) => x.marketId === marketId && x.outcome === outcome)) {
      if (o.side === "buy" && bestAskCents != null && bestAskCents > 0 && bestAskCents <= o.price * 100 + SHARE_EPSILON) {
        if (fillOpenOrder(o.id, bestAskCents / 100)) filled.push(o);
      } else if (o.side === "sell" && bestBidCents != null && bestBidCents > 0 && bestBidCents >= o.price * 100 - SHARE_EPSILON) {
        if (fillOpenOrder(o.id, bestBidCents / 100)) filled.push(o);
      }
    }
    return filled;
  };

  const redeemPosition = (marketId: string, positionOutcome: Outcome, resolvedOutcome: Outcome, details: { marketName: string; marketSlug?: string; marketIcon?: string; question?: string }) => {
    const cur = getCurrent();
    if (!cur) return null;
    const key = positionKey(marketId, positionOutcome);
    const idx = cur.positions.findIndex((p) => p.positionKey === key);
    if (idx < 0) return null;

    const p = cur.positions[idx]!;
    const win = positionOutcome === resolvedOutcome;
    const payout = win ? roundToCents(p.shares) : 0;
    const redemption = buildTx({
      type: "redeem",
      marketId: details.marketSlug || marketId,
      marketName: details.marketName,
      marketIcon: details.marketIcon,
      question: details.question,
      outcome: positionOutcome,
      shares: p.shares,
      price: win ? 1 : 0,
      amount: payout,
    });
    cur.positions.splice(idx, 1);
    cur.transactions.push(redemption);
    cur.balance = cur.balance + payout;
    persist();
    return redemption;
  };

  const addTransaction = (transaction: Omit<Transaction, "id" | "timestamp">) => {
    const tx = buildTx(transaction);
    const cur = getCurrent();
    if (!cur) return tx;
    cur.transactions.push(tx);
    persist();
    return tx;
  };

  return { addTransaction, createOrUpdatePosition, sellPosition, availableShares, placeOpenOrder, cancelOpenOrder, fillOpenOrder, checkOpenOrdersAgainstBook, redeemPosition };
}
