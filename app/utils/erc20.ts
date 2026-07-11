export const POLYGON_TOKENS = {
  pUSD: "0xc011a7e12a19f7b1f670d46f03b03f3342e82dfb",
  USDC: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
  "USDC.e": "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
} as const;

export const USD_DECIMALS = 6;

const TRANSFER_SELECTOR = "0xa9059cbb";
export const transferCalldata = (to: string, units: bigint): string => `${TRANSFER_SELECTOR}${to.toLowerCase().replace(/^0x/, "").padStart(64, "0")}${units.toString(16).padStart(64, "0")}`;

export function toUnits(amount: string | number, decimals = USD_DECIMALS): bigint {
  const s = String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Invalid amount");
  const [whole = "0", frac = ""] = s.split(".");
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0");
}

export const fromUnits = (units: bigint | string, decimals = USD_DECIMALS): number => Number(BigInt(units)) / 10 ** decimals;
