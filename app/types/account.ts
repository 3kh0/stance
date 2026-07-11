export type Outcome = "yes" | "no";
export type OrderSide = "buy" | "sell";
export type TransactionType = "deposit" | "buy" | "sell" | "withdraw" | "redeem";
export type AccountKind = "paper" | "polymarket";
export interface PositionDetails {
  marketSlug?: string;
  marketIcon?: string;
  question?: string;
}
export interface Position {
  positionKey: string;
  marketId: string;
  outcome: Outcome;
  marketName: string;
  shares: number;
  entryPrice: number;
  currentPrice: number;
  marketSlug?: string;
  marketIcon?: string;
  question?: string;
  tokenId?: string;
  negRisk?: boolean;
}
export interface Transaction {
  id: string;
  type: TransactionType;
  marketId?: string;
  marketName?: string;
  marketIcon?: string;
  question?: string;
  outcome?: Outcome;
  shares?: number;
  price?: number;
  amount?: number;
  timestamp: number;
}
export interface OpenOrder {
  id: string;
  marketId: string;
  outcome: Outcome;
  side: OrderSide;
  price: number;
  shares: number;
  reserved: number;
  marketName: string;
  marketSlug?: string;
  marketIcon?: string;
  question?: string;
  tokenId?: string;
  createdAt: number;
}
export interface ClobApiCreds {
  key: string;
  secret: string;
  passphrase: string;
}
export interface LinkedWallet {
  address: string;
  funder: string;
  signatureType: 0 | 1 | 2;
  creds?: ClobApiCreds;
  image?: string;
}
export interface Account {
  id: string;
  kind: AccountKind;
  username: string;
  balance: number;
  createdAt: number;
  transactions: Transaction[];
  positions: Position[];
  openOrders: OpenOrder[];
  wallet?: LinkedWallet;
}
