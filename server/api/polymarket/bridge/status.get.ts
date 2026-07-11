export default defineEventHandler(async (event) => {
  return await proxyImpit(BRIDGE_BASE_URL, `/status/${requireAddress(getQuery(event).address, "Invalid address")}`);
});
