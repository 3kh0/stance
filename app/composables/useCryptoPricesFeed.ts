import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import { cryptoFeedSource, normalizeCoin } from "~/utils/crypto";

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

function subscriptionsFor(coins: string[]) {
  return coins.map((coin) => {
    const { source, feedSymbol } = cryptoFeedSource(coin);
    return source === "chainlink" ? { topic: "crypto_prices_chainlink", type: "*", filters: JSON.stringify({ symbol: feedSymbol }) } : { topic: "crypto_prices", type: "update", filters: feedSymbol };
  });
}

function coinFromSymbol(symbol: string | undefined): string | null {
  if (!symbol) return null;
  const s = symbol.toLowerCase();
  if (s.includes("/")) return normalizeCoin(s.split("/")[0] ?? "");
  if (s.endsWith("usdt")) return normalizeCoin(s.slice(0, -4));
  if (s.endsWith("usd")) return normalizeCoin(s.slice(0, -3));
  return normalizeCoin(s);
}

export function useCryptoPricesFeed(coins: Ref<string[]>) {
  const prices = ref<Map<string, number>>(new Map());
  const connected = ref(false);

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  function setPrice(coin: string, value: number) {
    if (!Number.isFinite(value) || !coins.value.includes(coin)) return;
    const next = new Map(prices.value);
    next.set(coin, value);
    prices.value = next;
  }

  function handleMessage(raw: string) {
    if (raw === "PONG" || !raw) return;
    let parsed: RtdsMessage | RtdsMessage[];
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    for (const msg of Array.isArray(parsed) ? parsed : [parsed]) {
      const payload = msg?.payload;
      const coin = payload && coinFromSymbol(payload.symbol);
      if (!payload || !coin) continue;
      if (Array.isArray(payload.data) && payload.data.length) setPrice(coin, payload.data.reduce((a, b) => (a.timestamp >= b.timestamp ? a : b)).value);
      else if (typeof payload.value === "number") setPrice(coin, payload.value);
    }
  }

  function teardown() {
    if (pingTimer) clearInterval(pingTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    pingTimer = reconnectTimer = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try {
        ws.close();
      } catch {}
      ws = null;
    }
    connected.value = false;
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 2_000);
  }

  function connect() {
    if (!import.meta.client || stopped || coins.value.length === 0) return;
    teardown();
    const current = coins.value.slice();
    try {
      ws = new WebSocket("wss://ws-live-data.polymarket.com");
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      connected.value = true;
      ws?.send(JSON.stringify({ action: "subscribe", subscriptions: subscriptionsFor(current) }));
      pingTimer = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send("PING"), 10_000);
    };
    ws.onmessage = (e) => handleMessage(typeof e.data === "string" ? e.data : "");
    ws.onerror = () => ws?.close();
    ws.onclose = () => {
      connected.value = false;
      scheduleReconnect();
    };
  }

  onMounted(() => {
    stopped = false;
    if (coins.value.length) connect();
  });

  watch(
    () => coins.value.slice().sort().join(","),
    () => {
      stopped = false;
      if (coins.value.length) connect();
      else teardown();
    },
  );

  onBeforeUnmount(() => {
    stopped = true;
    teardown();
  });

  return { prices, connected };
}
