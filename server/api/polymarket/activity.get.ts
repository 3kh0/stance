export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  return await proxyUpstream(DATA_API_BASE_URL, "/activity", {
    user: requireAddress(q.user),
    limit: coercePositiveInt(q.limit, { min: 1, max: 500 }) ?? 500,
    offset: coercePositiveInt(q.offset, { min: 0, max: 100_000 }) ?? 0,
    sortBy: "TIMESTAMP",
    sortDirection: "DESC",
  });
});
