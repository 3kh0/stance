const ALIAS: Record<string, string> = {
  pol: "matic",
  weth: "eth",
  wbtc: "btc",
  wbnb: "bnb",
  wsol: "sol",
  wxrp: "xrp",
  wbeth: "eth",
  "usdc.e": "usdc",
  usdbc: "usdc",
  axlusdc: "usdc",
  susdc: "usdc",
  abasusdc: "usdc",
  aethusdc: "usdc",
  aethusdt: "usdt",
  btcb: "btc",
  cbbtc: "btc",
  kbtc: "btc",
  bbtc: "btc",
  ubtc: "btc",
  lbtc: "btc",
  toncoin: "ton",
};

function cryptoIconId(symbol: string): string {
  const l = symbol.toLowerCase().replace("₮", "t");
  if (ALIAS[l]) return ALIAS[l];
  const s = l.replace(/\.e$/, "").replace(/0$/, "");
  return ALIAS[s] ?? s.replace(/[^a-z0-9]/g, "");
}

export const tokenIconName = (symbol: string): string => `cryptocurrency-color:${cryptoIconId(symbol)}`;

const NETWORK_ICON: Record<string, string> = {
  Ethereum: "eth",
  Polygon: "matic",
  "BNB Smart Chain": "bnb",
  Solana: "sol",
  Bitcoin: "btc",
  Tron: "trx",
  Optimism: "op",
};

export const networkIconName = (chainName: string): string | undefined => (NETWORK_ICON[chainName] ? `cryptocurrency-color:${NETWORK_ICON[chainName]}` : undefined);
