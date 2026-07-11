const ALLOWED = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type Interval = (typeof ALLOWED)[number];

const SECONDS: Record<Interval, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };
const FIDELITY: Record<Interval, number> = { "1m": 1, "5m": 1, "15m": 3, "1h": 5, "4h": 30, "1d": 120 };
const WINDOW: Record<Interval, number> = { "1m": 21600, "5m": 86400, "15m": 259200, "1h": 1209600, "4h": 5184000, "1d": 31536000 };

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const tokenId = q.tokenId?.toString();
  if (!tokenId) throw createError({ statusCode: 400, statusMessage: "tokenId is required" });

  const interval = coerceEnum(q.interval, ALLOWED) ?? "1h";
  const startTsRaw = Number.parseInt(q.startTs?.toString() ?? "", 10);
  const endTsRaw = Number.parseInt(q.endTs?.toString() ?? "", 10);
  const endTs = Number.isFinite(endTsRaw) ? endTsRaw : Math.floor(Date.now() / 1000);
  const startTs = Number.isFinite(startTsRaw) ? startTsRaw : endTs - WINDOW[interval];

  const points = await fetchClobPrices({ tokenId, fidelity: FIDELITY[interval], startTs, endTs });
  const step = SECONDS[interval];
  const by = new Map<number, Candle>();
  for (const p of points) {
    if (!Number.isFinite(p.t) || !Number.isFinite(p.p)) continue;
    const t = Math.floor(p.t / step) * step;
    const c = by.get(t);
    if (!c) by.set(t, { t, o: p.p, h: p.p, l: p.p, c: p.p });
    else {
      c.h = Math.max(c.h, p.p);
      c.l = Math.min(c.l, p.p);
      c.c = p.p;
    }
  }
  return { candles: [...by.values()].sort((a, b) => a.t - b.t) };
});
