export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  return await proxyUpstream(DATA_API_BASE_URL, "/v2/positions", {
    user: requireAddress(q.user),
    limit: coercePositiveInt(q.limit, { min: 1, max: 1000 }) ?? 100,
    cursor: coerceCursor(q.cursor),
    filter_type: "TOKENS",
    filter_amount: 0.1,
    include_archived: coerceBool(q.includeArchived) ?? false,
    sort_by: "CURRENT_VALUE",
    sort_direction: "DESC",
  });
});
