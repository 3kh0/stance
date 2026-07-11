export interface PriceHistoryPoint {
  t: number;
  p: number;
}

interface PriceHistoryResponse {
  history: PriceHistoryPoint[];
}

export const MAX_RANGE_SECONDS = 15 * 24 * 60 * 60;

interface FetchClobPricesArgs {
  tokenId: string;
  fidelity: number;
  startTs?: number;
  endTs?: number;
  interval?: string;
}

export async function fetchClobPrices({ tokenId, fidelity, startTs, endTs, interval }: FetchClobPricesArgs): Promise<PriceHistoryPoint[]> {
  const hasWindow = Number.isFinite(startTs);

  if (hasWindow && Number.isFinite(endTs) && (endTs as number) - (startTs as number) > MAX_RANGE_SECONDS) {
    const chunks: Array<{ startTs: number; endTs: number }> = [];
    for (let s = startTs as number; s < (endTs as number); s += MAX_RANGE_SECONDS) {
      chunks.push({ startTs: s, endTs: Math.min(s + MAX_RANGE_SECONDS, endTs as number) });
    }
    const res = await Promise.all(chunks.map((c) => proxyUpstream<PriceHistoryResponse>(CLOB_BASE_URL, "/prices-history", { market: tokenId, ...c, fidelity })));
    const by = new Map<number, PriceHistoryPoint>();
    for (const r of res) for (const p of r.history) by.set(p.t, p);
    return [...by.values()].sort((a, b) => a.t - b.t);
  }

  const range = hasWindow ? { startTs, ...(Number.isFinite(endTs) ? { endTs } : {}) } : { interval };
  const res = await proxyUpstream<PriceHistoryResponse>(CLOB_BASE_URL, "/prices-history", { market: tokenId, ...range, fidelity });
  return res.history.slice().sort((a, b) => a.t - b.t);
}
