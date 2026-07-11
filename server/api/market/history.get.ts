const ALLOWED = ["1h", "3h", "6h", "1d", "1w", "1m", "max"] as const;
const FIDELITY: Record<(typeof ALLOWED)[number], number> = { "1h": 1, "3h": 3, "6h": 5, "1d": 10, "1w": 30, "1m": 120, max: 240 };

export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const tokenId = q.tokenId?.toString();
  if (!tokenId) throw createError({ statusCode: 400, statusMessage: "tokenId is required" });

  const interval = coerceEnum(q.interval, ALLOWED) ?? "max";
  const startTs = Number.parseInt(q.startTs?.toString() ?? "", 10);
  const endTs = Number.parseInt(q.endTs?.toString() ?? "", 10);
  const rangeMinutes = Number.isFinite(startTs) && Number.isFinite(endTs) ? Math.max(1, (endTs - startTs) / 60) : null;
  const fidelity = rangeMinutes === null ? FIDELITY[interval] : Math.max(1, Math.min(FIDELITY[interval], Math.ceil(rangeMinutes / 250)));

  const history = await fetchClobPrices({
    tokenId,
    fidelity,
    ...(Number.isFinite(startTs) ? { startTs, ...(Number.isFinite(endTs) ? { endTs } : {}) } : { interval }),
  });
  return { history };
});
