import { computed } from "vue";

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export const POLYGON_CHAIN_ID = 137;
const POLYGON_CHAIN_HEX = "0x89";
const POLYGON_CHAIN_PARAMS = {
  chainId: POLYGON_CHAIN_HEX,
  chainName: "Polygon Mainnet",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: ["https://polygon-rpc.com"],
  blockExplorerUrls: ["https://polygonscan.com"],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function getInjectedProvider(): Eip1193Provider | null {
  return typeof window === "undefined" ? null : (window.ethereum ?? null);
}

async function waitForInjectedProvider(tries = 12, delayMs = 150): Promise<Eip1193Provider | null> {
  for (let i = 0; i < tries; i += 1) {
    const p = getInjectedProvider();
    if (p) return p;
    await sleep(delayMs);
  }
  return getInjectedProvider();
}

export const useWallet = () => {
  const address = useState<string | null>("wallet-address", () => null);
  const chainId = useState<number | null>("wallet-chain-id", () => null);
  const connecting = useState<boolean>("wallet-connecting", () => false);
  const listenersBound = useState<boolean>("wallet-listeners-bound", () => false);

  const isConnected = computed(() => !!address.value);
  const isOnPolygon = computed(() => chainId.value === POLYGON_CHAIN_ID);
  const hasProvider = () => getInjectedProvider() !== null;

  const bindListeners = () => {
    const p = getInjectedProvider();
    if (!p?.on || listenersBound.value) return;
    p.on("accountsChanged", ((a: string[]) => (address.value = a[0] ?? null)) as never);
    p.on("chainChanged", ((hex: string) => (chainId.value = Number.parseInt(hex, 16))) as never);
    listenersBound.value = true;
  };

  const refreshChainId = async () => {
    const p = getInjectedProvider();
    if (!p) return;
    chainId.value = Number.parseInt((await p.request({ method: "eth_chainId" })) as string, 16);
  };

  const connect = async (): Promise<string> => {
    const p = getInjectedProvider();
    if (!p) throw new Error("No crypto wallet found. Install MetaMask to link your Polymarket account.");
    connecting.value = true;
    try {
      const selected = ((await p.request({ method: "eth_requestAccounts" })) as string[])[0];
      if (!selected) throw new Error("Wallet returned no accounts.");
      address.value = selected;
      await refreshChainId();
      bindListeners();
      return selected;
    } finally {
      connecting.value = false;
    }
  };

  const reconnect = async (): Promise<string | null> => {
    const p = await waitForInjectedProvider();
    if (!p) return null;
    try {
      address.value = ((await p.request({ method: "eth_accounts" })) as string[])[0] ?? null;
      if (address.value) {
        await refreshChainId();
        bindListeners();
      }
      return address.value;
    } catch {
      return null;
    }
  };

  const ensurePolygon = async () => {
    const p = getInjectedProvider();
    if (!p) throw new Error("No crypto wallet found.");
    if (chainId.value === POLYGON_CHAIN_ID) return;
    try {
      await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: POLYGON_CHAIN_HEX }] });
    } catch (e) {
      if ((e as { code?: number })?.code === 4902) await p.request({ method: "wallet_addEthereumChain", params: [POLYGON_CHAIN_PARAMS] });
      else throw e;
    }
    await refreshChainId();
  };

  const provider = () => {
    const p = getInjectedProvider();
    if (!p) throw new Error("No crypto wallet found.");
    return p;
  };
  const signerAddress = async () => address.value ?? (await reconnect()) ?? (await connect());

  const sendTransaction = async (tx: { to: string; data?: string; value?: bigint }): Promise<string> => {
    const params: Record<string, string> = { from: await signerAddress(), to: tx.to };
    if (tx.data) params.data = tx.data;
    if (tx.value !== undefined) params.value = `0x${tx.value.toString(16)}`;
    const hash = await provider().request({ method: "eth_sendTransaction", params: [params] });
    if (typeof hash !== "string") throw new Error("Wallet returned an invalid transaction hash.");
    return hash;
  };

  const signTypedDataV4 = async (typedData: unknown): Promise<string> => {
    const json = JSON.stringify(typedData, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
    const signature = await provider().request({ method: "eth_signTypedData_v4", params: [await signerAddress(), json] });
    if (typeof signature !== "string") throw new Error("Wallet returned an invalid signature.");
    return signature;
  };

  const waitForReceipt = async (hash: string, { tries = 60, delayMs = 2000 }: { tries?: number; delayMs?: number } = {}): Promise<void> => {
    const p = provider();
    for (let i = 0; i < tries; i += 1) {
      const receipt = (await p.request({ method: "eth_getTransactionReceipt", params: [hash] })) as { status?: string } | null;
      if (receipt) {
        if (receipt.status === "0x0") throw new Error("Transaction reverted on-chain.");
        return;
      }
      await sleep(delayMs);
    }
    throw new Error("Timed out waiting for the transaction to confirm.");
  };

  return {
    address: readonly(address),
    chainId: readonly(chainId),
    connecting: readonly(connecting),
    isConnected,
    isOnPolygon,
    hasProvider,
    connect,
    reconnect,
    ensurePolygon,
    disconnect: () => {
      address.value = null;
      chainId.value = null;
    },
    sendTransaction,
    signTypedDataV4,
    waitForReceipt,
  };
};
