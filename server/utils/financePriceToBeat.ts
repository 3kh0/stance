import type { GammaEvent } from "~/types/gamma";

interface EquityPriceResponse {
  openPrice?: number | null;
}

const EQUITY_SOURCE_RE = /pythdata\.app\/explore\/Equity\.US\.([A-Z.]+)(?:%2F|\/)USD/i;

const equitySymbol = (event: GammaEvent) => {
  const source = event.resolutionSource || event.markets?.[0]?.resolutionSource || "";
  return EQUITY_SOURCE_RE.exec(decodeURIComponent(source))?.[1]?.toUpperCase() ?? null;
};

function easternIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "shortOffset" }).formatToParts(date);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const offset = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(p.timeZoneName ?? "");
  if (!p.year || !p.month || !p.day || !p.hour || !p.minute || !p.second || !offset?.[1] || !offset[2]) return null;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offset[1]}${offset[2].padStart(2, "0")}:${offset[3] ?? "00"}`;
}

async function fetchOpenPrice(event: GammaEvent): Promise<number | null> {
  const symbol = equitySymbol(event);
  const market = event.markets?.[0];
  const eventStartTime = easternIso(market?.eventStartTime);
  if (!symbol || !eventStartTime) return null;
  try {
    const res = await proxyImpit<EquityPriceResponse>(POLYMARKET_BASE_URL, "/api/equity/equity-price", { symbol, eventStartTime, variant: "daily", endDate: easternIso(market?.endDate ?? event.endDate) });
    return typeof res.openPrice === "number" && Number.isFinite(res.openPrice) && res.openPrice > 0 ? res.openPrice : null;
  } catch {
    return null;
  }
}

export async function attachFinancePriceToBeat<T extends GammaEvent>(events: T[]): Promise<T[]> {
  await Promise.all(
    events.map(async (e) => {
      if (e.eventMetadata?.priceToBeat) return;
      const open = await fetchOpenPrice(e);
      if (open !== null) e.eventMetadata = { ...e.eventMetadata, priceToBeat: open };
    }),
  );
  return events;
}
