export default defineEventHandler((event) => {
  const slug = coerceSlug(getRouterParam(event, "slug"));
  if (!slug) throw createError({ statusCode: 400, statusMessage: "Invalid slug" });
  return proxyImpit(POLYMARKET_BASE_URL, `/api/equity/price-to-beat/${slug}`);
});
