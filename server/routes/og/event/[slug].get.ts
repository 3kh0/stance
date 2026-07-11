export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");
  if (!slug) throw createError({ statusCode: 400, statusMessage: "Slug parameter is required" });

  try {
    const png = await renderEventOgPng(await fetchEventBySlug(slug));
    setHeader(event, "content-type", "image/png");
    setHeader(event, "cache-control", "public, max-age=300, s-maxage=300, stale-while-revalidate=600");
    return png;
  } catch (err: unknown) {
    const status = typeof (err as { statusCode?: number })?.statusCode === "number" ? (err as { statusCode: number }).statusCode : 404;
    throw createError({ statusCode: status, statusMessage: "Event not found" });
  }
});
