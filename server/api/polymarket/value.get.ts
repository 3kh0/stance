export default defineEventHandler(async (event) => {
  return await proxyUpstream(DATA_API_BASE_URL, "/value", { user: requireAddress(getQuery(event).user) });
});
