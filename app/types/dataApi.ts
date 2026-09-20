export interface DataApiPagination {
  limit: number;
  offset: number;
  has_more: boolean;
  next_cursor: string | null;
}

export interface DataApiPage<T> {
  data: T[];
  pagination: DataApiPagination;
}

export interface DataApiEnvelope<T> {
  data: T;
}

export interface DataApiPosition {
  token_id: string;
  condition_id: string;
  current_size: number;
  avg_price: number;
  entry_cost_usdc: number;
  entry_fees_usdc: number;
  total_cost_usdc: number;
  current_price: number;
  current_value: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  percent_pnl: number;
  title?: string;
  slug?: string;
  icon?: string;
  event_slug?: string;
  outcome?: string;
  outcome_index?: number;
  negative_risk?: boolean;
  end_date?: string;
}

export interface DataApiActivity {
  type: string;
  side?: string;
  timestamp: number;
  condition_id?: string;
  transaction_hash?: string;
  size?: number;
  usdc_size?: number;
  price?: number;
  outcome?: string;
  outcome_index?: number;
  title?: string;
  slug?: string;
  event_slug?: string;
  icon?: string;
  token_id?: string;
  is_combo?: boolean;
}

export interface DataApiPortfolioValue {
  proxy_wallet: string;
  value: number;
}

export interface DataApiComboPosition {
  combo_condition_id?: string;
  legs_total?: number;
  legs?: Array<{
    leg_outcome_label?: string;
    market?: {
      icon_url?: string;
      image_url?: string;
      event?: { event_image?: string };
    };
  }>;
}
