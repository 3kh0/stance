const ALLOWED_SLUGS = ["politics", "sports", "crypto", "finance", "geopolitics", "tech", "pop-culture", "economy", "weather", "elections", "iran", "mention-markets"] as const;

export default defineEventHandler(async (event) => {
  const slug = coerceEnum(getQuery(event).slug, ALLOWED_SLUGS);
  if (!slug) throw createError({ statusCode: 400, statusMessage: "Unknown category slug" });
  return await proxyImpit(POLYMARKET_BASE_URL, "/api/tags/filteredBySlug", { tag: slug, status: "active" });
});
