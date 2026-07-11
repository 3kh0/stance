import { computed, readonly } from "vue";
import type { Account, LinkedWallet, Outcome, Position, Transaction } from "~/types/account";
import { ACCOUNTS_STORAGE_KEY, LEGACY_PAPERMARKET_ACCOUNT_KEY, LEGACY_PAPERMARKET_ACCOUNTS_KEY, LEGACY_PAPERMARKET_STORAGE_KEY, LEGACY_STORAGE_KEY, STORAGE_KEY } from "~/utils/constants";
import { positionKey } from "~/utils/markets";
import { DEFAULT_ACCOUNT, emptyStore, generateId, validateAccount, validateStore, type AccountsStore } from "~/utils/accountStorage";
import { createPaperLedger } from "~/utils/paperLedger";

export type { Account, AccountKind, ClobApiCreds, LinkedWallet, OpenOrder, OrderSide, Outcome, Position, PositionDetails, Transaction, TransactionType } from "~/types/account";

export const useAccount = () => {
  const store = useState<AccountsStore>("accounts-store", emptyStore);
  const storageError = useState<string | null>("account-storage-error", () => null);
  const canPersist = () => typeof localStorage !== "undefined";
  const activeAccount = () => store.value.accounts.find((a) => a.id === store.value.activeAccountId);

  const account = computed<Account>(() => activeAccount() ?? { ...DEFAULT_ACCOUNT });
  const accounts = computed(() => store.value.accounts);
  const activeAccountId = computed(() => store.value.activeAccountId);
  const isLiveAccount = computed(() => account.value.kind === "polymarket");

  const persist = (data: AccountsStore = store.value) => {
    if (!canPersist()) return;
    try {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("[useAccount] failed to write accounts to storage", e);
      storageError.value = "Could not save changes — your browser storage is full.";
    }
  };

  const ledger = createPaperLedger({ getCurrent: activeAccount, persist });

  const resetCorrupted = (keys: string[]) => {
    storageError.value = "Saved account data was corrupted and has been reset.";
    keys.forEach((k) => localStorage.removeItem(k));
  };

  const loadAccount = () => {
    if (!canPersist()) return;

    let storedV2 = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    let srcKey = ACCOUNTS_STORAGE_KEY;
    if (!storedV2) {
      storedV2 = localStorage.getItem(LEGACY_PAPERMARKET_ACCOUNTS_KEY);
      srcKey = LEGACY_PAPERMARKET_ACCOUNTS_KEY;
    }
    if (storedV2) {
      try {
        const valid = validateStore(JSON.parse(storedV2));
        if (!valid) {
          console.error("[useAccount] stored accounts failed validation, resetting");
          return resetCorrupted([srcKey]);
        }
        store.value = valid;
        if (srcKey !== ACCOUNTS_STORAGE_KEY) {
          persist();
          localStorage.removeItem(LEGACY_PAPERMARKET_ACCOUNTS_KEY);
        }
      } catch (e) {
        console.error("[useAccount] failed to parse stored accounts, resetting", e);
        resetCorrupted([srcKey]);
      }
      return;
    }

    const keys = [STORAGE_KEY, LEGACY_STORAGE_KEY, LEGACY_PAPERMARKET_STORAGE_KEY, LEGACY_PAPERMARKET_ACCOUNT_KEY] as const;
    let stored: string | null = null;
    let sourceKey: (typeof keys)[number] = STORAGE_KEY;
    for (const k of keys) {
      stored = localStorage.getItem(k);
      if (stored) {
        sourceKey = k;
        break;
      }
    }
    if (!stored) return;

    try {
      const valid = validateAccount(JSON.parse(stored));
      if (!valid) {
        console.error("[useAccount] stored account failed validation, resetting");
        return resetCorrupted([...keys]);
      }
      store.value = { activeAccountId: valid.id, accounts: [valid] };
      persist();
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.error("[useAccount] failed to parse stored account, resetting", e);
      resetCorrupted([sourceKey]);
    }
  };

  const saveAccount = (patch: Partial<Account>) => {
    const c = activeAccount();
    if (!c) return;
    Object.assign(c, patch);
    persist();
  };

  const addAccount = (data: Omit<Account, "id" | "createdAt">) => {
    const a: Account = { ...data, id: generateId(), createdAt: Date.now() };
    store.value.accounts.push(a);
    store.value.activeAccountId = a.id;
    persist();
    return a;
  };

  const initializeAccount = (username: string) => addAccount({ kind: "paper", username, balance: 0, transactions: [], positions: [], openOrders: [] });

  const linkPolymarketAccount = (username: string, wallet: LinkedWallet) => {
    const existing = store.value.accounts.find((a) => a.kind === "polymarket" && a.wallet?.funder.toLowerCase() === wallet.funder.toLowerCase());
    if (existing) {
      existing.wallet = { ...existing.wallet, ...wallet };
      if (username) existing.username = username;
      store.value.activeAccountId = existing.id;
      persist();
      return existing;
    }
    return addAccount({ kind: "polymarket", username, balance: 0, transactions: [], positions: [], openOrders: [], wallet });
  };

  const updateWallet = (patch: Partial<LinkedWallet>) => {
    const c = activeAccount();
    if (!c?.wallet) return;
    c.wallet = { ...c.wallet, ...patch };
    persist();
  };

  const switchAccount = (id: string) => {
    if (!store.value.accounts.some((a) => a.id === id)) return;
    store.value.activeAccountId = id;
    persist();
  };

  const removeAccount = (id: string) => {
    const i = store.value.accounts.findIndex((a) => a.id === id);
    if (i < 0) return;
    store.value.accounts.splice(i, 1);
    if (store.value.activeAccountId === id) store.value.activeAccountId = store.value.accounts[0]?.id ?? null;
    if (store.value.accounts.length === 0 && canPersist()) return localStorage.removeItem(ACCOUNTS_STORAGE_KEY);
    persist();
  };

  const hasAccount = () => account.value.createdAt !== 0;

  const getPosition = (marketId: string, outcome: Outcome) => account.value.positions.find((p) => p.positionKey === positionKey(marketId, outcome));

  const updatePositionPrice = (marketId: string, outcome: Outcome, price: number) => {
    const p = getPosition(marketId, outcome);
    if (p) {
      p.currentPrice = price;
      persist();
    }
  };

  const replaceLive = <K extends "positions" | "transactions">(key: K, value: Account[K]) => {
    const c = activeAccount();
    if (c?.kind !== "polymarket") return;
    c[key] = value;
    persist();
  };

  const clearAccount = () => {
    const c = activeAccount();
    if (c) removeAccount(c.id);
    else if (canPersist()) localStorage.removeItem(ACCOUNTS_STORAGE_KEY);
    if (canPersist()) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  };

  return {
    account,
    accounts,
    activeAccountId,
    isLiveAccount,
    storageError: readonly(storageError),
    loadAccount,
    saveAccount,
    initializeAccount,
    linkPolymarketAccount,
    updateWallet,
    switchAccount,
    removeAccount,
    hasAccount,
    addTransaction: ledger.addTransaction,
    createOrUpdatePosition: ledger.createOrUpdatePosition,
    sellPosition: ledger.sellPosition,
    availableShares: ledger.availableShares,
    placeOpenOrder: ledger.placeOpenOrder,
    cancelOpenOrder: ledger.cancelOpenOrder,
    fillOpenOrder: ledger.fillOpenOrder,
    checkOpenOrdersAgainstBook: ledger.checkOpenOrdersAgainstBook,
    redeemPosition: ledger.redeemPosition,
    getPosition,
    updatePositionPrice,
    replacePositions: (positions: Position[]) => replaceLive("positions", positions),
    replaceTransactions: (transactions: Transaction[]) => replaceLive("transactions", transactions),
    clearAccount,
    acknowledgeStorageError: () => (storageError.value = null),
  };
};
