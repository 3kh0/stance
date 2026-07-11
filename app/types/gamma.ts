export interface GammaTag {
  id?: string;
  label: string;
  slug?: string;
}
export interface GammaMarket {
  id: string;
  question: string;
  slug?: string;
  groupItemTitle?: string;
  description?: string;
  icon?: string;
  startDate?: string;
  endDate?: string;
  closedTime?: string;
  resolutionSource?: string;
  resolvedBy?: string;
  active?: boolean;
  closed?: boolean;
  acceptingOrders?: boolean;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  conditionId?: string;
  negRisk?: boolean;
  orderPriceMinTickSize?: number;
  volume?: number;
  volume24hr?: number | string;
  volumeNum?: number;
  sportsMarketType?: string;
  line?: number;
  gameStartTime?: string;
  eventStartTime?: string;
  bestBid?: number;
  bestAsk?: number;
  oneDayPriceChange?: number | string;
  feeType?: string;
  events?: Array<{ slug?: string }>;
}
export interface EventTeam {
  id?: number;
  name: string;
  alias?: string;
  abbreviation?: string;
  logo?: string;
  record?: string;
  color?: string;
  league?: string;
  ordering?: string;
}
export interface GammaEvent {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  resolutionSource?: string;
  icon?: string;
  image?: string;
  volume: number;
  volume24hr?: number;
  liquidity?: number;
  active?: boolean;
  closed?: boolean;
  startTime?: string;
  endDate?: string;
  seriesSlug?: string;
  live?: boolean;
  ended?: boolean;
  score?: string;
  period?: string;
  eventMetadata?: {
    priceToBeat?: number;
    finalPrice?: number;
    league?: string;
    serie?: string;
    tournament?: string;
    gridSeriesId?: string;
    sportradarGameId?: string;
  };
  markets: GammaMarket[];
  tags?: GammaTag[];
  teams?: EventTeam[];
}
export interface MarketFeedEvent extends Partial<Omit<GammaEvent, "id" | "markets" | "volume" | "volume24hr">> {
  id: string;
  title?: string;
  volume?: number | string;
  volume24hr?: number | string;
  markets?: GammaMarket[];
  [key: string]: unknown;
}
export interface OrderbookEntry {
  price: string;
  size: string;
}
export interface OrderbookData {
  asks?: OrderbookEntry[];
  bids?: OrderbookEntry[];
}
export interface OrderbookLevel {
  price: number;
  size: number;
  cumulativeShares: number;
  cumulativeTotal: number;
  isEdge: boolean;
}
