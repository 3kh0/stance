export default defineEventHandler(async () => {
  return await proxyImpit(BRIDGE_BASE_URL, "/supported-assets");
});
