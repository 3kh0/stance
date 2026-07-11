import type { GammaMarket } from "~/types/gamma";

interface PortfolioMarket extends Pick<GammaMarket, "id" | "conditionId" | "question" | "icon" | "outcomePrices" | "events"> {
  eventSlug?: string;
}

const isConditionId = (id: string) => /^0x[a-fA-F0-9]{64}$/.test(id);

const toMarket = (m: GammaMarket): PortfolioMarket => ({
  id: m.id,
  conditionId: m.conditionId,
  question: m.question,
  icon: m.icon,
  outcomePrices: m.outcomePrices,
  events: m.events,
  eventSlug: m.events?.find((e) => typeof e.slug === "string" && e.slug.length > 0)?.slug,
});

export default defineEventHandler(async (event) => {
  const ids = String(getQuery(event).ids || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 50);

  if (!ids.length) return { markets: [] as PortfolioMarket[], failedIds: [] as string[] };

  const conditionIds = ids.filter(isConditionId);
  const numericIds = ids.filter((id) => !isConditionId(id));
  const markets: PortfolioMarket[] = [];
  const failedIds: string[] = [];

  const numericResults = await Promise.allSettled(numericIds.map((id) => proxyUpstream<GammaMarket>(GAMMA_BASE_URL, `/markets/${encodeURIComponent(id)}`)));
  numericResults.forEach((r, i) => {
    if (r.status === "rejected") failedIds.push(numericIds[i]!);
    else markets.push(toMarket(r.value));
  });

  if (conditionIds.length) {
    try {
      const batch = await proxyUpstream<GammaMarket[]>(GAMMA_BASE_URL, "/markets", { condition_ids: conditionIds });
      const returned = new Set<string>();
      for (const m of batch) {
        if (m.conditionId) returned.add(m.conditionId.toLowerCase());
        markets.push(toMarket(m));
      }
      for (const id of conditionIds) if (!returned.has(id.toLowerCase())) failedIds.push(id);
    } catch {
      failedIds.push(...conditionIds);
    }
  }

  return { markets, failedIds };
});
