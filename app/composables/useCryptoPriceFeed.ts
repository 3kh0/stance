import { onMounted, ref, watch, type Ref } from "vue";
import type { CryptoUpDownInfo } from "~/utils/crypto";
import type { FinanceUpDownInfo } from "~/utils/finance";
import { useReconnectingSocket } from "~/composables/useReconnectingSocket";

const RTDS_URL = "wss://ws-live-data.polymarket.com";
type PriceFeedInfo = CryptoUpDownInfo | FinanceUpDownInfo;

interface RtdsPricePayload {
  symbol?: string;
  timestamp?: number;
  value?: number;
  data?: Array<{ timestamp: number; value: number }>;
}

interface RtdsMessage {
  topic?: string;
  type?: string;
  payload?: RtdsPricePayload;
}

export interface CryptoPricePoint {
  timestamp: number;
  value: number;
}

interface EquitySnapshot {
  currentPrice?: number;
  lastTradePrice?: number;
  timestamp?: number;
}

function subscriptionFor(info: PriceFeedInfo) {
  const sub =
    info.source === "equity"
      ? { topic: "equity_prices", type: "update", filters: JSON.stringify({ symbol: info.feedSymbol }) }
      : info.source === "chainlink"
        ? { topic: "crypto_prices_chainlink", type: "*", filters: JSON.stringify({ symbol: info.feedSymbol }) }
        : { topic: "crypto_prices", type: "update", filters: info.feedSymbol };
  return { action: "subscribe", subscriptions: [sub] };
}

const normalizeTimestamp = (timestamp: number): number => (timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp);

export function useCryptoPriceFeed(info: Ref<PriceFeedInfo | null>) {
  const price = ref<number | null>(null);
  const previousPrice = ref<number | null>(null);
  const priceToBeat = ref<number | null>(null);
  const points = ref<CryptoPricePoint[]>([]);
  const lastTickMs = ref<number | null>(null);

  function mergePoints(next: CryptoPricePoint[]) {
    const m = new Map(points.value.map((p) => [p.timestamp, p.value]));
    for (const p of next) if (Number.isFinite(p.value)) m.set(normalizeTimestamp(p.timestamp), p.value);
    points.value = [...m.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(-5_000)
      .map(([timestamp, value]) => ({ timestamp, value }));
  }

  function applyTick(value: number, timestamp: number) {
    if (!Number.isFinite(value)) return;
    const ts = normalizeTimestamp(timestamp || Date.now());
    previousPrice.value = price.value;
    price.value = value;
    lastTickMs.value = ts;
    mergePoints([{ timestamp: ts, value }]);

    const start = info.value?.windowStartMs ?? null;
    if (priceToBeat.value === null && start !== null && ts >= start && ts <= start + 5_000) priceToBeat.value = value;
  }

  function seedFromSnapshot(batch: Array<{ timestamp: number; value: number }>) {
    const sorted = batch.slice().sort((a, b) => a.timestamp - b.timestamp);
    mergePoints(sorted);
    const last = sorted.at(-1);
    if (!last) return;
    applyTick(last.value, last.timestamp);

    const start = info.value?.windowStartMs ?? null;
    if (priceToBeat.value === null && start !== null) {
      let best: { timestamp: number; value: number } | null = null;
      for (const p of sorted) {
        const ts = normalizeTimestamp(p.timestamp);
        if (ts < start - 5_000) continue;
        if (!best || Math.abs(ts - start) < Math.abs(best.timestamp - start)) best = { ...p, timestamp: ts };
      }
      if (best && Math.abs(best.timestamp - start) <= 5_000) priceToBeat.value = best.value;
    }
  }

  async function seedEquitySnapshot() {
    if (!info.value || info.value.source !== "equity") return;
    try {
      const snapshot = await $fetch<EquitySnapshot>("/api/equity/ticker-snapshot", { query: { symbol: info.value.feedSymbol } });
      const value = typeof snapshot.currentPrice === "number" ? snapshot.currentPrice : snapshot.lastTradePrice;
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      const ts = normalizeTimestamp(snapshot.timestamp ?? Date.now());
      const start = ts - 179_000;
      seedFromSnapshot(Array.from({ length: 180 }, (_, i) => ({ timestamp: start + i * 1000, value })));
    } catch {}
  }

  function handleMessage(raw: string) {
    let parsed: RtdsMessage | RtdsMessage[];
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    for (const msg of Array.isArray(parsed) ? parsed : [parsed]) {
      const payload = msg?.payload;
      if (!payload) continue;
      if (Array.isArray(payload.data)) seedFromSnapshot(payload.data);
      else if (typeof payload.value === "number") applyTick(payload.value, payload.timestamp ?? Date.now());
    }
  }

  const socket = useReconnectingSocket({
    url: RTDS_URL,
    canConnect: () => info.value !== null,
    subscribeMessage: () => subscriptionFor(info.value!),
    onMessage: handleMessage,
  });
  const { connected } = socket;

  function reset() {
    price.value = previousPrice.value = priceToBeat.value = lastTickMs.value = null;
    points.value = [];
  }

  const openFeed = () => {
    void seedEquitySnapshot();
    socket.open();
  };

  onMounted(() => {
    if (info.value) openFeed();
  });

  watch(
    () => (info.value ? `${info.value.source}:${info.value.feedSymbol}:${info.value.windowStartMs}:${info.value.windowEndMs}` : null),
    () => {
      reset();
      if (info.value) openFeed();
      else socket.close();
    },
  );

  return { price, previousPrice, priceToBeat, points, lastTickMs, connected };
}
