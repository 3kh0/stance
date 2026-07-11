const PUSD = "0xc011a7e12a19f7b1f670d46f03b03f3342e82dfb";

export default defineEventHandler(async (event) => {
  const b = await readBody<{ address?: string; toChainId?: string | number; toTokenAddress?: string; recipientAddr?: string; fromAmountBaseUnit?: string | number }>(event);
  const address = requireAddress(b?.address, "Invalid source wallet address");
  return await proxyImpit(BRIDGE_BASE_URL, "/quote", undefined, {
    method: "POST",
    body: JSON.stringify({
      address,
      fromChainId: "137",
      fromTokenAddress: PUSD,
      toChainId: requireChainId(b?.toChainId),
      toTokenAddress: requireAddress(b?.toTokenAddress, "Invalid destination token address"),
      recipientAddress: b?.recipientAddr ? coerceAddress(b.recipientAddr) : address,
      fromAmountBaseUnit: requireDigits(b?.fromAmountBaseUnit),
    }),
  });
});
