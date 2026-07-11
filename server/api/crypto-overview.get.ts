import type { GammaEvent } from "~/types/gamma";

const ALLOWED = ["5m", "15m", "hourly", "4h", "daily"] as const;
type Interval = (typeof ALLOWED)[number];

const UP_DOWN: Record<Interval, string[]> = {
  "5m": ["btc-up-or-down-5m", "eth-up-or-down-5m", "sol-up-or-down-5m", "xrp-up-or-down-5m", "bnb-up-or-down-5m", "doge-up-or-down-5m", "hype-up-or-down-5m"],
  "15m": ["btc-up-or-down-15m", "eth-up-or-down-15m", "sol-up-or-down-15m", "xrp-up-or-down-15m", "bnb-up-or-down-15m", "doge-up-or-down-15m", "hype-up-or-down-15m"],
  hourly: ["btc-up-or-down-hourly", "eth-up-or-down-hourly", "solana-up-or-down-hourly", "xrp-up-or-down-hourly", "bnb-up-or-down-hourly", "doge-up-or-down-hourly", "hype-up-or-down-hourly"],
  "4h": ["btc-up-or-down-4h", "eth-up-or-down-4h", "sol-up-or-down-4h", "xrp-up-or-down-4h", "bnb-up-or-down-4h", "doge-up-or-down-4h", "hype-up-or-down-4h"],
  daily: ["btc-up-or-down-daily", "eth-up-or-down-daily", "solana-up-or-down-daily", "xrp-up-or-down-daily", "bnb-up-or-down-daily", "dogecoin-up-or-down-daily", "hype-up-or-down-daily"],
};

const listEvents = (params: Record<string, string | number | boolean>) =>
  proxyUpstream<unknown>(GAMMA_BASE_URL, "/events", params)
    .then(eventList)
    .catch(() => [] as GammaEvent[]);

export default defineEventHandler(async (event) => {
  const interval = coerceEnum<Interval>(getQuery(event).interval, ALLOWED) ?? "5m";
  const nowIso = new Date().toISOString();

  const [eventsRaw, ...upDownPerCoin] = await Promise.all([listEvents({ tag_slug: "crypto", closed: false, order: "volume24hr", ascending: false, limit: 80 }), ...UP_DOWN[interval].map((series_slug) => listEvents({ series_slug, closed: false, end_date_min: nowIso, order: "endDate", ascending: true, limit: 2 }))]);

  return {
    interval,
    upDown: await attachCryptoPriceToBeat(upDownPerCoin.flat()),
    events: eventsRaw.filter((e) => !/up-or-down/i.test(e.seriesSlug ?? "")),
  };
});
