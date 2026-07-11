export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const query = q.q?.toString().trim();
  if (!query) return { events: [], tags: [], profiles: [], pagination: { hasMore: false, totalResults: 0 } };

  return await proxyUpstream(GAMMA_BASE_URL, "/search-v2", {
    q: query,
    optimized: true,
    limit_per_type: coercePositiveInt(q.limit_per_type, { min: 1, max: 20 }) ?? 6,
    type: "events",
    search_tags: true,
    search_profiles: true,
    cache: true,
  });
});
