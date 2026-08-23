export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  return await proxyUpstream(DATA_API_BASE_URL, "/positions", {
    user: requireAddress(q.user),
    sizeThreshold: 0.1,
    limit: coercePositiveInt(q.limit, { min: 1, max: 500 }) ?? 100,
    offset: coercePositiveInt(q.offset, { min: 0, max: 10_000 }) ?? 0,
    includeArchived: coerceBool(q.includeArchived) ?? false,
    sortBy: "CURRENT",
    sortDirection: "DESC",
  });
});
