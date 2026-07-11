export default defineEventHandler(async (event) => {
  const seriesId = String(getQuery(event).seriesId ?? "").trim();
  if (!/^[0-9]{1,20}$/.test(seriesId)) throw createError({ statusCode: 400, statusMessage: "Valid numeric seriesId is required" });
  return await proxyImpit(POLYMARKET_BASE_URL, "/api/esports/series-state", { seriesId });
});
