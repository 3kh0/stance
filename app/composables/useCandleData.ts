export const CANDLE_INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];

export const CANDLE_INTERVAL_SECONDS: Record<CandleInterval, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };

export const CANDLE_INTERVAL_LABELS: Record<CandleInterval, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1H", "4h": "4H", "1d": "1D" };

export interface RawCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function toPercentCandle(raw: RawCandle): Candle {
  return { time: raw.t, open: raw.o * 100, high: raw.h * 100, low: raw.l * 100, close: raw.c * 100 };
}

export function bucketStart(timeSeconds: number, intervalSeconds: number): number {
  return Math.floor(timeSeconds / intervalSeconds) * intervalSeconds;
}

export function mergeLiveCandle(last: Candle | null, point: { time: number; value: number }, intervalSeconds: number): Candle | null {
  if (!Number.isFinite(point.time) || !Number.isFinite(point.value)) return null;
  const b = bucketStart(point.time, intervalSeconds);
  const v = point.value;
  if (last) {
    if (b < last.time) return null;
    if (b === last.time) return { time: b, open: last.open, high: Math.max(last.high, v), low: Math.min(last.low, v), close: v };
  }
  return { time: b, open: v, high: v, low: v, close: v };
}
