export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  return await proxyUpstream(DATA_API_BASE_URL, "/v2/activity", {
    user: requireAddress(q.user),
    limit: coercePositiveInt(q.limit, { min: 1, max: 1000 }) ?? 500,
    cursor: coerceCursor(q.cursor),
    sort_by: "TIMESTAMP",
    sort_direction: "DESC",
  });
});
