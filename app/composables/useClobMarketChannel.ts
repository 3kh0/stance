import { ref, watch, type Ref } from "vue";
import type { OrderbookData } from "~/types/gamma";
import { useReconnectingSocket } from "~/composables/useReconnectingSocket";

const CLOB_MARKET_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

interface BookSnapshot {
  event_type: "book";
  asset_id: string;
  bids?: Array<{ price: string; size: string }>;
  asks?: Array<{ price: string; size: string }>;
  timestamp?: string;
}

interface PriceChange {
  event_type: "price_change";
  price_changes?: Array<{ asset_id: string; price: string; size: string; side: "BUY" | "SELL"; best_bid?: string; best_ask?: string }>;
  timestamp?: string;
}

interface LastTrade {
  event_type: "last_trade_price";
  asset_id: string;
  price: string;
}

interface BestBidAsk {
  event_type: "best_bid_ask";
  asset_id: string;
  best_bid?: string;
  best_ask?: string;
  timestamp?: string;
}

export interface LiveMarketQuote {
  bestBid: number | null;
  bestAsk: number | null;
  timestamp: number;
}

type MarketMessage = BookSnapshot | PriceChange | LastTrade | BestBidAsk | { event_type?: string };

interface LiveBook {
  bids: Map<string, string>;
  asks: Map<string, string>;
}

function toOrderbookData(book: LiveBook): OrderbookData {
  const m = (e: [string, string]) => ({ price: e[0], size: e[1] });
  return { bids: [...book.bids.entries()].map(m), asks: [...book.asks.entries()].map(m) };
}

function extremePrice(levels: Array<{ price: string }> | undefined, mode: "max" | "min"): string | undefined {
  return (levels ?? []).reduce<string | undefined>((b, l) => (!b || (mode === "max" ? Number(l.price) > Number(b) : Number(l.price) < Number(b)) ? l.price : b), undefined);
}

export function useClobMarketChannel(tokenIds: Ref<string[]>) {
  const revision = ref(0);
  const lastTradePrice = ref<Record<string, number>>({});

  const books = new Map<string, LiveBook>();
  const quotes = new Map<string, LiveMarketQuote>();
  let publishFrame: number | null = null;
  let subscribed: string[] = [];

  function schedulePublish() {
    if (publishFrame !== null) return;
    publishFrame = requestAnimationFrame(() => {
      publishFrame = null;
      revision.value++;
    });
  }

  function parseQuotePrice(value: string): number | null {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) && n > 0 && n < 1 ? n : null;
  }

  function messageTimestamp(value: string | undefined): number {
    const n = Number.parseInt(value ?? "", 10);
    return Number.isFinite(n) ? n : Date.now();
  }

  function setQuote(assetId: string, bestBid: string | undefined, bestAsk: string | undefined, timestamp?: string) {
    const prev = quotes.get(assetId);
    quotes.set(assetId, {
      bestBid: bestBid === undefined ? (prev?.bestBid ?? null) : parseQuotePrice(bestBid),
      bestAsk: bestAsk === undefined ? (prev?.bestAsk ?? null) : parseQuotePrice(bestAsk),
      timestamp: messageTimestamp(timestamp),
    });
  }

  function ensureBook(assetId: string): LiveBook {
    let book = books.get(assetId);
    if (!book) books.set(assetId, (book = { bids: new Map(), asks: new Map() }));
    return book;
  }

  function applySnapshot(msg: BookSnapshot) {
    const book = ensureBook(msg.asset_id);
    book.bids.clear();
    book.asks.clear();
    for (const l of msg.bids ?? []) book.bids.set(l.price, l.size);
    for (const l of msg.asks ?? []) book.asks.set(l.price, l.size);
    setQuote(msg.asset_id, extremePrice(msg.bids, "max"), extremePrice(msg.asks, "min"), msg.timestamp);
    schedulePublish();
  }

  function applyPriceChange(msg: PriceChange) {
    let touched = false;
    for (const c of msg.price_changes ?? []) {
      setQuote(c.asset_id, c.best_bid, c.best_ask, msg.timestamp);
      touched = true;
      const book = books.get(c.asset_id);
      if (!book) continue;
      const side = c.side === "BUY" ? book.bids : book.asks;
      if (Number.parseFloat(c.size) <= 0) side.delete(c.price);
      else side.set(c.price, c.size);
    }
    if (touched) schedulePublish();
  }

  function handleMessage(raw: string) {
    let parsed: MarketMessage | MarketMessage[];
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    for (const msg of Array.isArray(parsed) ? parsed : [parsed]) {
      switch (msg.event_type) {
        case "book":
          applySnapshot(msg as BookSnapshot);
          break;
        case "price_change":
          applyPriceChange(msg as PriceChange);
          break;
        case "last_trade_price": {
          const t = msg as LastTrade;
          const v = Number.parseFloat(t.price);
          if (Number.isFinite(v)) lastTradePrice.value = { ...lastTradePrice.value, [t.asset_id]: v };
          break;
        }
        case "best_bid_ask": {
          const m = msg as BestBidAsk;
          setQuote(m.asset_id, m.best_bid, m.best_ask, m.timestamp);
          schedulePublish();
          break;
        }
      }
    }
  }

  const socket = useReconnectingSocket({
    url: CLOB_MARKET_WS_URL,
    canConnect: () => tokenIds.value.filter(Boolean).length > 0,
    subscribeMessage: () => ({ type: "market", assets_ids: tokenIds.value.filter(Boolean), custom_feature_enabled: true }),
    onMessage: handleMessage,
    onBeforeConnect: () => {
      const ids = tokenIds.value.filter(Boolean);
      subscribed = ids;
      for (const k of books.keys()) if (!ids.includes(k)) books.delete(k);
      for (const k of quotes.keys()) if (!ids.includes(k)) quotes.delete(k);
    },
    onTeardown: () => {
      if (publishFrame !== null) cancelAnimationFrame(publishFrame);
      publishFrame = null;
    },
  });
  const { connected } = socket;

  function getBook(tokenId: string | null | undefined): OrderbookData | null {
    void revision.value;
    if (!tokenId) return null;
    const book = books.get(tokenId);
    return book ? toOrderbookData(book) : null;
  }

  function getBestQuote(tokenId: string | null | undefined): LiveMarketQuote | null {
    void revision.value;
    return tokenId ? (quotes.get(tokenId) ?? null) : null;
  }

  watch(
    tokenIds,
    (ids) => {
      const next = ids.filter(Boolean);
      const changed = next.length !== subscribed.length || next.some((id, i) => id !== subscribed[i]);
      if (!changed) return;
      if (next.length) socket.open();
      else socket.close();
    },
    { immediate: true },
  );

  return { revision, connected, getBook, getBestQuote, lastTradePrice };
}
