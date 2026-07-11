export default defineEventHandler(async (event) => {
  const t = getQuery(event).tokenId?.toString();
  if (!t) throw createError({ statusCode: 400, statusMessage: "tokenId is required" });
  return await proxyUpstream(CLOB_BASE_URL, "/book", { token_id: t });
});
