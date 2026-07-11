export default defineEventHandler(async () => {
  const r = await proxyUpstream<{ data: unknown }>(GAMMA_BASE_URL, "/events/pagination", { active: true, archived: false, ascending: true, closed: false, featured_order: true, order: "featuredOrder" });
  return r.data;
});
