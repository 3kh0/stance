import type { Ref } from "vue";
import type { OrderbookData } from "~/types/gamma";
import { buildAsks, buildBids } from "~/utils/orderbook";
import { fmtc, fmtClob, decimalcent } from "~/utils/prices";

export function useOrderbookView(bookData: Ref<OrderbookData | null>) {
  const displayedAsks = computed(() => buildAsks(bookData.value?.asks));
  const displayedBids = computed(() => buildBids(bookData.value?.bids));
  const hasBookLiquidity = computed(() => displayedAsks.value.length > 0 || displayedBids.value.length > 0);
  const bookDecimal = computed(() => decimalcent([...displayedAsks.value, ...displayedBids.value]));
  const topAsk = computed(() => displayedAsks.value.at(-1)?.price);
  const topBid = computed(() => displayedBids.value[0]?.price);

  const bookSpread = computed(() => {
    const ask = topAsk.value;
    const bid = topBid.value;
    return ask === undefined || bid === undefined ? null : fmtc(Math.round((ask - bid) * 1000) / 10);
  });

  const lastBookPrice = computed(() => {
    const ask = topAsk.value;
    if (ask !== undefined) return fmtClob(ask, bookDecimal.value);
    const bid = topBid.value;
    return bid !== undefined ? fmtClob(bid, bookDecimal.value) : "—";
  });

  const bestAsk = computed(() => topAsk.value ?? null);
  const bestBid = computed(() => topBid.value ?? null);
  const hasAsks = computed(() => !bookData.value || displayedAsks.value.length > 0);

  return { displayedAsks, displayedBids, hasBookLiquidity, bookDecimal, bookSpread, lastBookPrice, bestAsk, bestBid, hasAsks };
}
