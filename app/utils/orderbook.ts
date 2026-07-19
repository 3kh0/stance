import type { OrderbookEntry, OrderbookLevel } from "~/types/gamma";

function withDepth(rows: { price: number; size: number }[], ascending: boolean): OrderbookLevel[] {
  let shares = 0,
    total = 0;
  const levels = [...rows].sort((a, b) => (ascending ? a.price - b.price : b.price - a.price)).map((r, i) => ((shares += r.size), (total += r.size * r.price), { ...r, cumulativeShares: shares, cumulativeTotal: total, isEdge: i === 0 }));
  return ascending ? levels.reverse() : levels;
}

const parseRows = (rows?: OrderbookEntry[]) => (rows ?? []).map((r) => ({ price: Number.parseFloat(r.price), size: Number.parseFloat(r.size) })).filter((r) => r.price > 0 && r.price < 1);

export const buildAsks = (rows: OrderbookEntry[] | undefined): OrderbookLevel[] => withDepth(parseRows(rows), true);

export const buildBids = (rows: OrderbookEntry[] | undefined): OrderbookLevel[] => withDepth(parseRows(rows), false);

export const TICK_TENTHS = [1, 2, 5, 10, 20, 50] as const;

export const tickLabel = (tenths: number): string => `${tenths / 10}¢`;

export function groupByTick(levels: OrderbookLevel[], tickTenths: number, ascending: boolean): OrderbookLevel[] {
  if (tickTenths <= 1) return levels;
  const tickHundredths = Math.round(tickTenths * 10);
  const m = new Map<number, number>();
  for (const l of levels) {
    const b = Math.floor(Math.round(l.price * 10000) / tickHundredths) * tickHundredths;
    m.set(b, (m.get(b) ?? 0) + l.size);
  }
  return withDepth(
    [...m].map(([b, size]) => ({ price: b / 10000, size })),
    ascending,
  );
}
