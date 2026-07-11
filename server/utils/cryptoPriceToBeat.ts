import type { GammaEvent } from "~/types/gamma";
import { detectCryptoUpDown } from "~/utils/crypto";

interface CryptoPriceResponse {
  openPrice: number | null;
  closePrice: number | null;
}

const VARIANT_BY_INTERVAL_MS: Record<number, string> = {
  300_000: "fiveminute",
  900_000: "fifteen",
  3_600_000: "hourly",
  14_400_000: "fourhour",
  86_400_000: "daily",
};

async function fetchOpenPrice(event: GammaEvent): Promise<number | null> {
  const info = detectCryptoUpDown(event);
  if (!info?.intervalMs) return null;
  const m = event.markets?.[0];
  const eventStartTime = m?.eventStartTime;
  const variant = VARIANT_BY_INTERVAL_MS[info.intervalMs];
  if (!eventStartTime || !variant) return null;
  try {
    const res = await proxyImpit<CryptoPriceResponse>(POLYMARKET_BASE_URL, "/api/crypto/crypto-price", { symbol: info.display, eventStartTime, variant, endDate: m?.endDate ?? event.endDate });
    return typeof res.openPrice === "number" && Number.isFinite(res.openPrice) && res.openPrice > 0 ? res.openPrice : null;
  } catch {
    return null;
  }
}

export async function attachCryptoPriceToBeat<T extends GammaEvent>(events: T[]): Promise<T[]> {
  await Promise.all(
    events.map(async (e) => {
      if (e.eventMetadata?.priceToBeat) return;
      const open = await fetchOpenPrice(e);
      if (open !== null) e.eventMetadata = { ...e.eventMetadata, priceToBeat: open };
    }),
  );
  return events;
}
