export default defineEventHandler(async (event) => {
  const b = await readBody<{ address?: string; toChainId?: string | number; toTokenAddress?: string; recipientAddr?: string }>(event);
  return await proxyImpit(BRIDGE_BASE_URL, "/withdraw", undefined, {
    method: "POST",
    body: JSON.stringify({
      address: requireAddress(b?.address, "Invalid source wallet address"),
      toChainId: requireChainId(b?.toChainId),
      toTokenAddress: requireAddress(b?.toTokenAddress, "Invalid destination token address"),
      recipientAddr: requireAddress(b?.recipientAddr, "Invalid recipient address"),
    }),
  });
});
