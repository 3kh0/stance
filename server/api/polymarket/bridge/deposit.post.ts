export default defineEventHandler(async (event) => {
  const address = requireAddress((await readBody<{ address?: string }>(event))?.address, "Invalid wallet address");
  return await proxyImpit(BRIDGE_BASE_URL, "/deposit", undefined, { method: "POST", body: JSON.stringify({ address }) });
});
