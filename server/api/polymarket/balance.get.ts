const RPCS = ["https://polygon-bor-rpc.publicnode.com", "https://polygon.drpc.org", "https://1rpc.io/matic"];

export default defineEventHandler(async (event) => {
  const user = requireAddress(getQuery(event).user);
  const data = "0x70a08231" + user.slice(2).padStart(64, "0");

  for (const rpc of RPCS) {
    try {
      const result = await $fetch<{ result?: string; error?: { message?: string } }>(rpc, {
        method: "POST",
        body: { jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: "0xc011a7e12a19f7b1f670d46f03b03f3342e82dfb", data }, "latest"] },
        timeout: 8_000,
      });
      if (!result.result || result.result === "0x") throw new Error(result.error?.message || "empty RPC response");
      return { user, balance: Number(BigInt(result.result)) / 1_000_000 };
    } catch (err) {
      console.error(`[polymarket/balance] RPC failure via ${rpc}`, err);
    }
  }
  throw createError({ statusCode: 502, statusMessage: "Could not read on-chain balance" });
});
