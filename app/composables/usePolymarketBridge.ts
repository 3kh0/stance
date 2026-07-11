import { useAccount } from "./useAccount";
import { useWallet, POLYGON_CHAIN_ID } from "./useWallet";
import { usePolymarket } from "./usePolymarket";
import { POLYGON_TOKENS, transferCalldata, toUnits, USD_DECIMALS } from "~/utils/erc20";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export interface BridgeAddresses {
  evm?: string;
  svm?: string;
  btc?: string;
}
interface BridgeAddressResponse {
  address?: BridgeAddresses;
  note?: string;
}

export interface SupportedAsset {
  chainId: number | string;
  chainName?: string;
  token: { name?: string; symbol?: string; address: string; decimals?: number };
  minCheckoutUsd?: number;
}

export interface WithdrawQuote {
  estimatedOutput?: number;
  appFee?: number;
  appFeeLabel?: string;
  impactPercent?: number;
  minReceived?: number;
  etaMs?: number;
  raw: Record<string, unknown>;
}

interface RelayerTransaction {
  state?: string;
  transactionHash?: string;
}

const SAFE_TX_TYPES = {
  EIP712Domain: [
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  SafeTx: [
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "data", type: "bytes" },
    { name: "operation", type: "uint8" },
    { name: "safeTxGas", type: "uint256" },
    { name: "baseGas", type: "uint256" },
    { name: "gasPrice", type: "uint256" },
    { name: "gasToken", type: "address" },
    { name: "refundReceiver", type: "address" },
    { name: "nonce", type: "uint256" },
  ],
};

const RELAYER_SUCCESS = new Set(["STATE_MINED", "STATE_CONFIRMED", "STATE_EXECUTED"]);
const RELAYER_FAILURE = new Set(["STATE_FAILED", "STATE_INVALID"]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shorten = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const toNum = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const reqUnits = (amount: string): bigint => {
  const u = toUnits(amount, USD_DECIMALS);
  if (u <= 0n) throw new Error("Enter an amount greater than zero.");
  return u;
};

export function usePolymarketBridge() {
  const { account, addTransaction } = useAccount();
  const wallet = useWallet();
  const { syncLiveAccount } = usePolymarket();

  const requireFunder = (): string => {
    const funder = account.value.wallet?.funder;
    if (!funder) throw new Error("No linked Polymarket wallet on this account.");
    return funder;
  };

  const ensureConnected = async (): Promise<string> => {
    const eoa = wallet.address.value ?? (await wallet.reconnect()) ?? (await wallet.connect());
    await wallet.ensurePolygon();
    return eoa;
  };

  const ensureSigner = async (): Promise<{ eoa: string; funder: string; signatureType: number }> => {
    const linked = account.value.wallet!;
    const funder = requireFunder();
    const eoa = await ensureConnected();
    if (eoa.toLowerCase() !== linked.address.toLowerCase()) throw new Error(`Connected wallet doesn't match this account. Switch to ${shorten(linked.address)}.`);
    return { eoa, funder, signatureType: linked.signatureType };
  };

  const getDepositAddresses = async (): Promise<BridgeAddresses> => {
    const res = await $fetch<BridgeAddressResponse>("/api/polymarket/bridge/deposit", { method: "POST", body: { address: requireFunder() } });
    return res.address ?? {};
  };

  const sendDeposit = async (amount: string, opts: { evm: string; token?: keyof typeof POLYGON_TOKENS }): Promise<string> => {
    await ensureConnected();
    const units = reqUnits(amount);
    const hash = await wallet.sendTransaction({ to: POLYGON_TOKENS[opts.token ?? "USDC"], data: transferCalldata(opts.evm, units) });
    addTransaction({ type: "deposit", amount: Number(amount) });
    return hash;
  };

  const getSupportedAssets = async (): Promise<SupportedAsset[]> => {
    const res = await $fetch<{ supportedAssets?: SupportedAsset[] }>("/api/polymarket/bridge/supported-assets");
    return res.supportedAssets ?? [];
  };

  const getWithdrawQuote = async (params: { toChainId: string | number; toTokenAddress: string; recipientAddr: string; amount: string }): Promise<WithdrawQuote> => {
    const raw = await $fetch<Record<string, unknown>>("/api/polymarket/bridge/quote", {
      method: "POST",
      body: { address: requireFunder(), toChainId: params.toChainId, toTokenAddress: params.toTokenAddress, recipientAddr: params.recipientAddr, fromAmountBaseUnit: toUnits(params.amount, USD_DECIMALS).toString() },
    });
    const b = (raw.estFeeBreakdown ?? {}) as Record<string, unknown>;
    return {
      estimatedOutput: toNum(raw.estOutputUsd),
      appFee: toNum(b.appFeeUsd),
      appFeeLabel: typeof b.appFeeLabel === "string" ? b.appFeeLabel : undefined,
      impactPercent: toNum(b.totalImpact),
      minReceived: toNum(b.minReceived),
      etaMs: toNum(raw.estCheckoutTimeMs),
      raw,
    };
  };

  const pollRelayer = async (txId: string, { tries = 60, delayMs = 2000 } = {}): Promise<void> => {
    for (let i = 0; i < tries; i += 1) {
      const txns = await $fetch<RelayerTransaction[] | RelayerTransaction>("/api/polymarket/relayer/transaction", { query: { id: txId } }).catch(() => undefined);
      const state = (Array.isArray(txns) ? txns[0] : txns)?.state;
      if (state && RELAYER_SUCCESS.has(state)) return;
      if (state && RELAYER_FAILURE.has(state)) throw new Error("Withdrawal transaction failed on-chain.");
      await sleep(delayMs);
    }
    throw new Error("Timed out waiting for the relayer to mine the withdrawal.");
  };

  const executeSafeTransfer = async ({ eoa, funder, to, data }: { eoa: string; funder: string; to: string; data: string }): Promise<void> => {
    const { nonce } = await $fetch<{ nonce?: string | number }>("/api/polymarket/relayer/nonce", { query: { address: eoa, type: "SAFE" } });
    const nonceStr = String(nonce ?? "0");
    const params = { gasPrice: "0", operation: "0", safeTxnGas: "0", baseGas: "0", gasToken: ZERO_ADDRESS, refundReceiver: ZERO_ADDRESS };

    const signature = await wallet.signTypedDataV4({
      domain: { chainId: POLYGON_CHAIN_ID, verifyingContract: funder },
      types: SAFE_TX_TYPES,
      primaryType: "SafeTx",
      message: { to, value: "0", data, operation: 0, safeTxGas: "0", baseGas: "0", gasPrice: "0", gasToken: ZERO_ADDRESS, refundReceiver: ZERO_ADDRESS, nonce: nonceStr },
    });

    const submitRes = await $fetch<{ transactionID?: string }>("/api/polymarket/relayer/submit", {
      method: "POST",
      body: { from: eoa, to, proxyWallet: funder, data, nonce: nonceStr, signature, signatureParams: params, type: "SAFE", metadata: "" },
    });

    if (!submitRes.transactionID) throw new Error("Relayer did not accept the transaction.");
    await pollRelayer(submitRes.transactionID);
  };

  const executeWithdraw = async (params: { amount: string; toChainId: string | number; toTokenAddress: string; recipientAddr: string }): Promise<string> => {
    const { eoa, funder, signatureType } = await ensureSigner();
    const units = reqUnits(params.amount);

    const res = await $fetch<BridgeAddressResponse>("/api/polymarket/bridge/withdraw", {
      method: "POST",
      body: { address: funder, toChainId: params.toChainId, toTokenAddress: params.toTokenAddress, recipientAddr: params.recipientAddr },
    });
    const bridgeEvm = res.address?.evm;
    if (!bridgeEvm) throw new Error("Bridge did not return a withdrawal address.");

    const data = transferCalldata(bridgeEvm, units);
    if (signatureType === 0) {
      const hash = await wallet.sendTransaction({ to: POLYGON_TOKENS.pUSD, data });
      await wallet.waitForReceipt(hash);
    } else await executeSafeTransfer({ eoa, funder, to: POLYGON_TOKENS.pUSD, data });

    addTransaction({ type: "withdraw", amount: Number(params.amount) });
    return bridgeEvm;
  };

  const pollStatus = async (address: string, { sinceMs = 0, tries = 40, delayMs = 5000 }: { sinceMs?: number; tries?: number; delayMs?: number } = {}): Promise<void> => {
    for (let i = 0; i < tries; i += 1) {
      await sleep(delayMs);
      const res = await $fetch<{ transactions?: { status?: string; createdTimeMs?: number }[] }>("/api/polymarket/bridge/status", { query: { address } }).catch(() => undefined);
      const newest = (res?.transactions ?? []).filter((t) => (t.createdTimeMs ?? 0) >= sinceMs).sort((a, b) => (b.createdTimeMs ?? 0) - (a.createdTimeMs ?? 0))[0];
      const status = String(newest?.status ?? "").toLowerCase();
      if (/(complete|success|done|settled)/.test(status)) {
        await syncLiveAccount().catch(() => {});
        return;
      }
      if (/(fail|error|refund)/.test(status)) throw new Error("Bridge transfer failed.");
    }
    await syncLiveAccount().catch(() => {});
  };

  return {
    getDepositAddresses,
    sendDeposit,
    getSupportedAssets,
    getWithdrawQuote,
    executeWithdraw,
    pollStatus,
    syncLiveAccount,
  };
}
