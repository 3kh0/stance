export interface EarningsEntry {
  id: string;
  slug: string;
  ticker: string;
  company: string;
  icon?: string;
  reportDate: string;
  session: "pre" | "post";
  beatPct: number;
  epsEstimate: number | null;
  volume: number;
}
