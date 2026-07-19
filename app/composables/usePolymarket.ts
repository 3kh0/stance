import { computed } from "vue";
import type { Account, OrderSide, Outcome, Position, Transaction } from "~/composables/useAccount";
import { positionKey } from "~/utils/markets";

const GAMMA_HOST = "https://gamma-api.polymarket.com";

const clobHost = () => `${typeof window !== "undefined" ? window.location.origin : ""}/api/polymarket/clob`;

export type LinkStatus = "idle" | "connecting" | "resolving" | "signing" | "syncing";

const LINK_STATUS_LABELS: Record<LinkStatus, string> = {
  idle: "",
  connecting: "Connecting wallet...",
  resolving: "Finding your Polymarket account...",
  signing: "Waiting for signature...",
  syncing: "Loading balances...",
};

export interface LiveOrderRequest {
  tokenID: string;
  side: OrderSide;
  amount: number;
  tickSize?: number;
  negRisk?: boolean;
}

export interface LiveLimitOrderRequest {
  tokenID: string;
  side: OrderSide;
  price: number;
  size: number;
  tickSize?: number;
  negRisk?: boolean;
}

export interface LiveOpenOrder {
  id: string;
  side: string;
  price: string;
  original_size: string;
  size_matched: string;
  outcome: string;
  asset_id: string;
  market: string;
  created_at: number;
}

export interface ClobFeeInfo {
  rate: number;
  exponent: number;
}

type TypedDataDomain = Record<string, unknown>;
type TypedDataTypes = Record<string, Array<{ name: string; type: string }>>;
type TypedDataValue = Record<string, unknown>;

const ALLOWED_TICKS = ["0.1", "0.01", "0.005", "0.0025", "0.001", "0.0001"] as const;
type Tick = (typeof ALLOWED_TICKS)[number];

function domainTypes(domain: TypedDataDomain): Array<{ name: string; type: string }> {
  return Object.entries(domain).map(([name, value]) => ({
    name,
    type: name === "chainId" || typeof value === "number" || typeof value === "bigint" ? "uint256" : name === "verifyingContract" ? "address" : name === "salt" ? "bytes32" : "string",
  }));
}

function primaryType(types: TypedDataTypes): string {
  if (types.TypedDataSign) return "TypedDataSign";
  const [first] = Object.keys(types);
  if (!first) throw new Error("Typed data is missing types.");
  return first;
}

const stringifyTypedData = (value: unknown): string => JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

function clobOrderOptions(tickSize?: number, negRisk?: boolean): { tickSize?: Tick; negRisk?: boolean } {
  const tick = tickSize ? (String(tickSize) as Tick) : undefined;
  return { negRisk: !!negRisk, ...(tick && ALLOWED_TICKS.includes(tick) ? { tickSize: tick } : {}) };
}

function throwIfError(response: { error?: unknown } | null | undefined, fallback: string) {
  if (response?.error) throw new Error(typeof response.error === "string" ? response.error : fallback);
}

interface DataApiPosition {
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  title?: string;
  slug?: string;
  icon?: string;
  eventSlug?: string;
  outcome?: string;
  outcomeIndex?: number;
  negativeRisk?: boolean;
}

interface DataApiActivity {
  type: "TRADE" | "REDEEM" | "SPLIT" | "MERGE" | "CONVERSION" | "REWARD";
  side?: "BUY" | "SELL" | "";
  timestamp: number;
  conditionId?: string;
  transactionHash?: string;
  size?: number;
  usdcSize?: number;
  price?: number;
  outcome?: string;
  outcomeIndex?: number;
  title?: string;
  slug?: string;
  eventSlug?: string;
  icon?: string;
  asset?: string;
}

const shortAddress = (a: string): string => `${a.slice(0, 6)}…${a.slice(-4)}`;
const finite = (n: unknown, fallback?: number) => (Number.isFinite(n) ? (n as number) : fallback);

function mapActivity(raw: DataApiActivity, index: number): Transaction | null {
  if (!raw || !Number.isFinite(raw.timestamp)) return null;
  let type: Transaction["type"];
  let outcome: Outcome | undefined;
  if (raw.type === "TRADE") {
    type = raw.side === "SELL" ? "sell" : "buy";
    outcome = raw.outcome?.toLowerCase() === "no" || raw.outcomeIndex === 1 ? "no" : "yes";
  } else if (raw.type === "REDEEM") type = "redeem";
  else return null;

  const slug = raw.eventSlug || raw.slug;
  return {
    id: `pm-${raw.transactionHash ?? "tx"}-${raw.asset || raw.outcomeIndex || index}-${index}`,
    type,
    marketId: slug || raw.conditionId,
    marketName: raw.title,
    marketIcon: raw.icon,
    question: raw.title,
    outcome,
    shares: finite(raw.size),
    price: finite(raw.price),
    amount: finite(raw.usdcSize),
    timestamp: raw.timestamp * 1000,
  };
}

function dataApiOutcomeToSide(p: DataApiPosition): Outcome {
  const label = p.outcome?.toLowerCase();
  if (label === "yes" || label === "no") return label;
  return p.outcomeIndex === 1 ? "no" : "yes";
}

function mapDataApiPosition(raw: DataApiPosition): Position | null {
  if (!raw?.conditionId || !Number.isFinite(raw.size) || raw.size <= 0) return null;
  const outcome = dataApiOutcomeToSide(raw);
  return {
    positionKey: positionKey(raw.conditionId, outcome),
    marketId: raw.conditionId,
    outcome,
    marketName: `${raw.title || "Market"} - ${outcome === "yes" ? "Yes" : "No"}`,
    shares: raw.size,
    entryPrice: finite(raw.avgPrice, 0)!,
    currentPrice: finite(raw.curPrice, 0)!,
    marketSlug: raw.eventSlug || raw.slug,
    marketIcon: raw.icon,
    question: raw.title,
    tokenId: raw.asset,
    negRisk: raw.negativeRisk,
  };
}

export const usePolymarket = () => {
  const { account, linkPolymarketAccount, updateWallet, saveAccount, replacePositions, replaceTransactions } = useAccount();
  const wallet = useWallet();

  const linkStatus = useState<LinkStatus>("polymarket-link-status", () => "idle");
  const syncing = useState<boolean>("polymarket-syncing", () => false);
  const feeInfoCache = useState<Record<string, ClobFeeInfo>>("polymarket-fee-info", () => ({}));

  const linkStatusLabel = computed(() => LINK_STATUS_LABELS[linkStatus.value]);
  const usdcBalance = (side: OrderSide) => (side === "buy" && Number.isFinite(account.value.balance) ? account.value.balance : undefined);

  const buildSigner = async (eoa: string) => {
    const provider = getInjectedProvider();
    if (!provider) throw new Error("No crypto wallet found. Install MetaMask to trade on Polymarket.");
    return {
      getAddress: async () => eoa,
      _signTypedData: async (domain: TypedDataDomain, types: TypedDataTypes, value: TypedDataValue) => {
        const signature = await provider.request({
          method: "eth_signTypedData_v4",
          params: [eoa, stringifyTypedData({ domain, types: { EIP712Domain: domainTypes(domain), ...types }, primaryType: primaryType(types), message: value })],
        });
        if (typeof signature !== "string") throw new Error("Wallet returned an invalid signature.");
        return signature;
      },
    };
  };

  const ensureWalletReady = async (options?: { prompt?: boolean }): Promise<string> => {
    const linked = account.value.wallet;
    if (!linked) throw new Error("This account has no linked wallet.");
    const connected = wallet.address.value ?? (await wallet.reconnect()) ?? (options?.prompt === false ? null : await wallet.connect());
    if (!connected || connected.toLowerCase() !== linked.address.toLowerCase()) {
      throw new Error(`Your wallet is on a different address. Switch to ${shortAddress(linked.address)} in your wallet and try again.`);
    }
    await wallet.ensurePolygon();
    return connected;
  };

  const buildClient = async (options?: { prompt?: boolean }) => {
    const linked = account.value.wallet;
    if (!linked?.creds) throw new Error("This account isn't authorized for trading yet. Re-link your wallet.");
    const eoa = await ensureWalletReady(options);
    const [{ ClobClient }, signer] = await Promise.all([import("@polymarket/clob-client-v2"), buildSigner(eoa)]);
    return new ClobClient({
      host: clobHost(),
      chain: 137,
      signer,
      creds: linked.creds,
      signatureType: linked.signatureType,
      funderAddress: linked.funder,
      builderConfig: { builderCode: "0x2cf40c89ed5a622ae2f1f250974d09f7434974b562fa831d04c1c2c804844be9" },
      useServerTime: true,
      throwOnError: true,
    });
  };

  const syncLiveAccount = async () => {
    const linked = account.value.wallet;
    if (account.value.kind !== "polymarket" || !linked) return;
    syncing.value = true;
    try {
      const [balanceRes, positionsRes, activityRes, profileRes] = await Promise.allSettled([
        $fetch<{ balance: number }>("/api/polymarket/balance", { query: { user: linked.funder } }),
        $fetch<DataApiPosition[]>("/api/polymarket/positions", { query: { user: linked.funder } }),
        $fetch<DataApiActivity[]>("/api/polymarket/activity", { query: { user: linked.funder, limit: 500 } }),
        $fetch<{ profileImage?: string }>(`${GAMMA_HOST}/public-profile`, { query: { address: linked.address }, timeout: 8000 }),
      ]);
      if (balanceRes.status === "fulfilled" && Number.isFinite(balanceRes.value?.balance)) saveAccount({ balance: Math.round(balanceRes.value.balance * 100) / 100 });
      if (profileRes.status === "fulfilled" && profileRes.value?.profileImage && profileRes.value.profileImage !== linked.image) updateWallet({ image: profileRes.value.profileImage });
      if (positionsRes.status === "fulfilled" && Array.isArray(positionsRes.value)) replacePositions(positionsRes.value.map(mapDataApiPosition).filter((p): p is Position => p !== null));
      if (activityRes.status === "fulfilled" && Array.isArray(activityRes.value)) {
        replaceTransactions(
          activityRes.value
            .map(mapActivity)
            .filter((t): t is Transaction => t !== null)
            .reverse(),
        );
      }
    } finally {
      syncing.value = false;
    }
  };

  const linkWallet = async (): Promise<Account> => {
    try {
      linkStatus.value = "connecting";
      const eoa = await wallet.connect();
      await wallet.ensurePolygon();

      linkStatus.value = "resolving";
      let funder = eoa;
      let signatureType: 0 | 2 = 0;
      let username = shortAddress(eoa);
      let image: string | undefined;
      try {
        const profile = await $fetch<{ proxyWallet?: string; name?: string; pseudonym?: string; profileImage?: string }>(`${GAMMA_HOST}/public-profile`, { query: { address: eoa }, timeout: 8000 });
        if (profile?.proxyWallet) {
          funder = profile.proxyWallet;
          signatureType = 2;
          username = profile.name || profile.pseudonym || username;
        }
        if (profile?.profileImage) image = profile.profileImage;
      } catch {}

      linkStatus.value = "signing";
      const [{ ClobClient }, signer] = await Promise.all([import("@polymarket/clob-client-v2"), buildSigner(eoa)]);
      const authClient = new ClobClient({ host: clobHost(), chain: 137, signer, useServerTime: true });
      let creds = await authClient.createOrDeriveApiKey().catch(() => undefined);
      if (!creds?.key) creds = await authClient.deriveApiKey().catch(() => undefined);
      if (!creds?.key) throw new Error("Couldn't authorize trading with Polymarket. Make sure this wallet has a Polymarket account, then try again.");

      linkPolymarketAccount(username, { address: eoa, funder, signatureType, creds, image });
      linkStatus.value = "syncing";
      await syncLiveAccount();
      return account.value;
    } finally {
      linkStatus.value = "idle";
    }
  };

  const placeLiveOrder = async (request: LiveOrderRequest) => {
    if (!Number.isFinite(request.amount) || request.amount <= 0) throw new Error("Invalid order amount.");
    const [client, { Side, OrderType }] = await Promise.all([buildClient(), import("@polymarket/clob-client-v2")]);
    const response = await client.createAndPostMarketOrder({ tokenID: request.tokenID, amount: request.amount, side: request.side === "buy" ? Side.BUY : Side.SELL, orderType: OrderType.FOK, userUSDCBalance: usdcBalance(request.side) }, clobOrderOptions(request.tickSize, request.negRisk), OrderType.FOK);
    throwIfError(response, "Order was rejected by the exchange.");
    return response as { orderID?: string; status?: string };
  };

  const placeLiveLimitOrder = async (request: LiveLimitOrderRequest) => {
    if (!Number.isFinite(request.price) || request.price <= 0 || request.price >= 1) throw new Error("Invalid limit price.");
    if (!Number.isFinite(request.size) || request.size <= 0) throw new Error("Invalid order size.");
    const [client, { Side, OrderType }] = await Promise.all([buildClient(), import("@polymarket/clob-client-v2")]);
    const response = await client.createAndPostOrder({ tokenID: request.tokenID, price: request.price, size: request.size, side: request.side === "buy" ? Side.BUY : Side.SELL, userUSDCBalance: usdcBalance(request.side) }, clobOrderOptions(request.tickSize, request.negRisk), OrderType.GTC);
    throwIfError(response, "Order was rejected by the exchange.");
    return response as { orderID?: string; status?: string };
  };

  const fetchLiveOpenOrders = async (conditionId?: string): Promise<LiveOpenOrder[]> => {
    const client = await buildClient({ prompt: false });
    const orders = await client.getOpenOrders(conditionId ? { market: conditionId } : undefined);
    return Array.isArray(orders) ? (orders as LiveOpenOrder[]) : [];
  };

  const cancelLiveOrder = async (orderID: string) => {
    throwIfError(await (await buildClient()).cancelOrder({ orderID }), "Couldn't cancel the order.");
  };

  const getFeeInfo = async (conditionId: string): Promise<ClobFeeInfo> => {
    const cached = feeInfoCache.value[conditionId];
    if (cached) return cached;
    const result = await $fetch<{ fd?: { r?: number; e?: number } }>(`/api/polymarket/clob/clob-markets/${encodeURIComponent(conditionId)}`, { timeout: 8000 });
    return (feeInfoCache.value[conditionId] = { rate: result?.fd?.r ?? 0, exponent: result?.fd?.e ?? 0 });
  };

  return {
    linkStatus: readonly(linkStatus),
    linkStatusLabel,
    syncing: readonly(syncing),
    linkWallet,
    syncLiveAccount,
    placeLiveOrder,
    placeLiveLimitOrder,
    fetchLiveOpenOrders,
    cancelLiveOrder,
    getFeeInfo,
  };
};
