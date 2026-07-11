const ALLOWED_ORDERS = ["volume24hr", "volume", "startDate", "endDate", "createdAt", "liquidity"] as const;

export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const limit = coercePositiveInt(q.limit, { min: 1, max: 100 }) ?? 20;
  const offset = coercePositiveInt(q.offset, { min: 0, max: 10_000 }) ?? 0;
  const order = coerceEnum(q.order, ALLOWED_ORDERS) ?? "volume24hr";
  const tagSlug = coerceSlug(q.tag_slug);
  const params: Record<string, string | number | boolean | undefined> = { limit, order, closed: false, ascending: false };

  if (tagSlug) {
    params.tag_slug = tagSlug;
    const cursor = q.cursor?.toString();
    if (cursor) params.next_cursor = cursor;
    return await proxyUpstream(GAMMA_BASE_URL, "/events/keyset", params);
  }

  params.offset = offset;
  return await proxyUpstream(GAMMA_BASE_URL, "/events", params);
});
