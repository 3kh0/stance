import type { Account, AccountKind, LinkedWallet, OpenOrder, Outcome, Position, Transaction } from "~/types/account";

export interface AccountsStore {
  activeAccountId: string | null;
  accounts: Account[];
}

export const DEFAULT_ACCOUNT: Account = {
  id: "",
  kind: "paper",
  username: "",
  balance: 0,
  createdAt: 0,
  transactions: [],
  positions: [],
  openOrders: [],
};

export const emptyStore = (): AccountsStore => ({ activeAccountId: null, accounts: [] });

export const generateId = () => Math.random().toString(36).substring(2, 11);
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const str = (s: unknown) => (typeof s === "string" ? s : "");
const optStr = (s: unknown) => (typeof s === "string" ? s : undefined);
const nonEmpty = (s: unknown) => (typeof s === "string" && s ? s : undefined);

export function migratePosition(raw: unknown): Position | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<Position> & { marketId?: string; outcome?: Outcome };
  let { positionKey, marketId, outcome } = p;
  const { marketName, shares, entryPrice, currentPrice, marketSlug, marketIcon, question, tokenId, negRisk } = p;

  if (!positionKey && marketId) positionKey = marketId;
  if (!outcome && positionKey) outcome = positionKey.endsWith("-yes") ? "yes" : positionKey.endsWith("-no") ? "no" : outcome;
  if (!marketId && positionKey && outcome) marketId = positionKey.replace(/-(yes|no)$/, "");
  if (!positionKey || !marketId || !outcome || !finite(shares) || !finite(entryPrice) || !finite(currentPrice)) return null;

  return {
    positionKey,
    marketId,
    outcome,
    marketName: str(marketName),
    shares,
    entryPrice,
    currentPrice,
    marketSlug: optStr(marketSlug),
    marketIcon: optStr(marketIcon),
    question: optStr(question),
    tokenId: optStr(tokenId),
    negRisk: typeof negRisk === "boolean" ? negRisk : undefined,
  };
}

export function validateOpenOrder(raw: unknown): OpenOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<OpenOrder>;
  if (typeof o.id !== "string" || !o.id || typeof o.marketId !== "string" || !o.marketId) return null;
  if (o.outcome !== "yes" && o.outcome !== "no") return null;
  if (o.side !== "buy" && o.side !== "sell") return null;
  if (!finite(o.price) || o.price <= 0 || !finite(o.shares) || o.shares <= 0) return null;
  return {
    id: o.id,
    marketId: o.marketId,
    outcome: o.outcome,
    side: o.side,
    price: o.price,
    shares: o.shares,
    reserved: finite(o.reserved) && o.reserved > 0 ? o.reserved : 0,
    marketName: str(o.marketName),
    marketSlug: optStr(o.marketSlug),
    marketIcon: optStr(o.marketIcon),
    question: optStr(o.question),
    tokenId: optStr(o.tokenId),
    createdAt: finite(o.createdAt) ? o.createdAt : 0,
  };
}

export function validateWallet(raw: unknown): LinkedWallet | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const w = raw as Partial<LinkedWallet>;
  if (typeof w.address !== "string" || !w.address) return undefined;
  const c = w.creds;
  return {
    address: w.address,
    funder: nonEmpty(w.funder) ?? w.address,
    signatureType: w.signatureType === 0 || w.signatureType === 1 || w.signatureType === 2 ? w.signatureType : 0,
    creds: c && typeof c.key === "string" && typeof c.secret === "string" && typeof c.passphrase === "string" ? { key: c.key, secret: c.secret, passphrase: c.passphrase } : undefined,
    image: nonEmpty(w.image),
  };
}

const normalizeTransaction = (t: Transaction): Transaction => ((t.type as string) === "withdrawal" ? { ...t, type: "withdraw" } : t);

export function validateAccount(raw: unknown): Account | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Account>;
  if (typeof r.username !== "string" || !finite(r.balance) || !finite(r.createdAt) || !Array.isArray(r.transactions) || !Array.isArray(r.positions)) return null;

  const kind: AccountKind = r.kind === "polymarket" ? "polymarket" : "paper";
  const positions = r.positions
    .map(migratePosition)
    .filter((p): p is Position => p !== null)
    .filter((p) => (kind === "polymarket" ? !!p.tokenId : !p.tokenId));
  const openOrders = Array.isArray(r.openOrders) ? r.openOrders.map(validateOpenOrder).filter((o): o is OpenOrder => o !== null) : [];
  const wallet = kind === "polymarket" ? validateWallet(r.wallet) : undefined;
  if (kind === "polymarket" && !wallet) return null;

  return {
    id: nonEmpty(r.id) ?? generateId(),
    kind,
    username: r.username,
    balance: r.balance,
    createdAt: r.createdAt,
    transactions: (r.transactions as Transaction[]).map(normalizeTransaction),
    positions,
    openOrders,
    wallet,
  };
}

export function validateStore(raw: unknown): AccountsStore | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<AccountsStore>;
  if (!Array.isArray(r.accounts)) return null;
  const accounts = r.accounts.map(validateAccount).filter((a): a is Account => a !== null);
  return {
    activeAccountId: typeof r.activeAccountId === "string" && accounts.some((a) => a.id === r.activeAccountId) ? r.activeAccountId : (accounts[0]?.id ?? null),
    accounts,
  };
}
