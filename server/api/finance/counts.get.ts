interface FinanceCounts {
  all: number;
  daily: number;
  weekly: number;
  monthly: number;
  stocks: number;
  earnings: number;
  indicies: number;
  commodities: number;
  forex: number;
  acquisitions: number;
  ipo: number;
  "fed-rates": number;
  "prediction-markets": number;
  treasuries: number;
  kpis: number;
  privates: number;
}

export default defineEventHandler(async (): Promise<FinanceCounts> => {
  return await proxyImpit<FinanceCounts>(POLYMARKET_BASE_URL, "/api/finance/counts");
});
