import type { OpenOrder, Outcome } from "~/composables/useAccount";
import type { OrderbookData } from "~/types/gamma";

const PAPER_ORDER_POLL_MS = 15_000;

function bestPriceCents(levels: OrderbookData["asks"] | OrderbookData["bids"], mode: "min" | "max"): number | null {
  const p = (levels ?? []).map((l) => Number.parseFloat(l.price)).filter((n) => Number.isFinite(n) && n > 0);
  if (!p.length) return null;
  return (mode === "min" ? Math.min(...p) : Math.max(...p)) * 100;
}

export const usePaperOrderMonitor = () => {
  const { account, activeAccountId, isLiveAccount, checkOpenOrdersAgainstBook } = useAccount();
  let timer: ReturnType<typeof setInterval> | null = null;
  let checking = false;

  const orderSignature = computed(() => account.value.openOrders.map((o) => o.id).join(":"));

  async function checkNow() {
    if (checking || isLiveAccount.value || !account.value.openOrders.length) return;
    if (typeof document !== "undefined" && document.hidden) return;

    const id = activeAccountId.value;
    const byToken = new Map<string, OpenOrder[]>();
    for (const o of account.value.openOrders) {
      if (!o.tokenId) continue;
      const list = byToken.get(o.tokenId) ?? [];
      list.push(o);
      byToken.set(o.tokenId, list);
    }
    if (!byToken.size) return;

    checking = true;
    try {
      await Promise.allSettled(
        [...byToken.entries()].map(async ([tokenId, orders]) => {
          const book = await $fetch<OrderbookData>(`/api/market/orderbook?tokenId=${encodeURIComponent(tokenId)}`);
          if (activeAccountId.value !== id) return;
          const bestAsk = bestPriceCents(book.asks, "min");
          const bestBid = bestPriceCents(book.bids, "max");
          for (const m of new Set(orders.map((o) => `${o.marketId}:${o.outcome}`))) {
            const sep = m.lastIndexOf(":");
            checkOpenOrdersAgainstBook(m.slice(0, sep), m.slice(sep + 1) as Outcome, bestBid, bestAsk);
          }
        }),
      );
    } finally {
      checking = false;
    }
  }

  const onVisibilityChange = () => {
    if (!document.hidden) void checkNow();
  };

  watch(orderSignature, (o, prev) => void (o && o !== prev && checkNow()), { flush: "post" });

  onMounted(() => {
    void checkNow();
    timer = setInterval(() => void checkNow(), PAPER_ORDER_POLL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
  });

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  });

  return { checkNow };
};
