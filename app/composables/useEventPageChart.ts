import type { GammaMarket } from "~/types/gamma";
import type { useSportsMatchup } from "~/composables/useSportsMatchup";
import { parseClobTokenIds } from "~/utils/markets";
import { parseMarketOutcomes } from "~/utils/sports";

export interface MarketWithPrice extends GammaMarket {
  yesPrice: number;
}

const CHART_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#db2777", "#ca8a04"];

export function useEventPageChart(o: { chartMarkets: ComputedRef<MarketWithPrice[]>; isSports: ComputedRef<boolean>; sportsMatchup: ReturnType<typeof useSportsMatchup> }) {
  const chartHovered = ref<number | null>(null);
  const userChartTokenIds = ref<string[] | null>(null);
  const userChartColors = ref<Record<string, string>>({});

  const tokenTimes = (m: MarketWithPrice) => {
    const s = m.closed && m.startDate ? Math.floor(Date.parse(m.startDate) / 1000) : NaN;
    const e = m.closed && (m.closedTime || m.endDate) ? Math.ceil(Date.parse((m.closedTime || m.endDate)!) / 1000) : NaN;
    return { startTs: Number.isFinite(s) ? s : undefined, endTs: Number.isFinite(e) ? e : undefined };
  };

  const toAdvanceMarket = computed(() => (o.isSports.value ? o.chartMarkets.value.find((m) => (m.sportsMarketType ?? "").includes("to_advance")) : undefined));

  const toAdvanceTokens = computed(() => {
    const m = toAdvanceMarket.value;
    if (!m) return [];
    const ids = parseClobTokenIds(m);
    const [oa, ob] = parseMarketOutcomes(m);
    const matchup = o.sportsMatchup.value;
    const colorFor = (name: string) => {
      if (!matchup) return undefined;
      const n = name.toLowerCase();
      if (n === matchup.teamA.toLowerCase()) return matchup.colorA;
      if (n === matchup.teamB.toLowerCase()) return matchup.colorB;
      return undefined;
    };
    const times = tokenTimes(m);
    return [...(ids[0] ? [{ tokenId: ids[0], label: oa, color: colorFor(oa), ...times }] : []), ...(ids[1] ? [{ tokenId: ids[1], label: ob, color: colorFor(ob), ...times }] : [])];
  });

  const allChartTokens = computed(() => {
    const matchup = o.isSports.value ? o.sportsMatchup.value : null;
    const sportsTokens = (matchup?.moneylineOutcomes ?? []).flatMap((x) => (x.tokenId ? [{ tokenId: x.tokenId, label: x.label, ...tokenTimes(x.market as MarketWithPrice) }] : []));
    const seen = new Set(matchup?.moneylineOutcomes.map((x) => x.market.id) ?? []);
    const advTokens = toAdvanceTokens.value.map((t) => ({ tokenId: t.tokenId, label: t.label, startTs: t.startTs, endTs: t.endTs }));
    if (toAdvanceMarket.value) seen.add(toAdvanceMarket.value.id);
    const marketTokens = o.chartMarkets.value.flatMap((m) => {
      if (seen.has(m.id)) return [];
      const tokenId = parseClobTokenIds(m)[0];
      if (!tokenId) return [];
      const raw = m.groupItemTitle || m.question || "";
      const label = (o.isSports.value ? raw.replace(/\s*\([^)]*\)\s*$/, "").trim() : raw) || raw;
      return [{ tokenId, label, ...tokenTimes(m) }];
    });
    return [...advTokens, ...sportsTokens, ...marketTokens];
  });

  const defaultChartSelection = computed<{ ids: string[]; colors: Record<string, string> }>(() => {
    const tokens = allChartTokens.value;
    const colors: Record<string, string> = {};
    let ids: string[];
    if (toAdvanceTokens.value.length) {
      for (const t of toAdvanceTokens.value) if (t.color) colors[t.tokenId] = t.color;
      ids = toAdvanceTokens.value.map((t) => t.tokenId);
    } else if (o.isSports.value && o.sportsMatchup.value) {
      const sportsIds: string[] = [];
      for (const x of o.sportsMatchup.value.moneylineOutcomes) {
        if (!x.tokenId) continue;
        sportsIds.push(x.tokenId);
        const color = x.key === "draw" ? "#888888" : x.color;
        if (color) colors[x.tokenId] = color;
      }
      ids = sportsIds.length ? [...new Set(sportsIds)] : tokens.slice(0, 4).map((t) => t.tokenId);
    } else ids = tokens.slice(0, 4).map((t) => t.tokenId);
    ids.forEach((id, i) => {
      if (!colors[id]) colors[id] = CHART_COLORS[i % CHART_COLORS.length]!;
    });
    return { ids, colors };
  });

  const chartTokenIds = computed(() => {
    const available = new Set(allChartTokens.value.map((t) => t.tokenId));
    const kept = (userChartTokenIds.value ?? []).filter((id) => available.has(id));
    return kept.length ? kept : defaultChartSelection.value.ids;
  });

  const chartColors = computed<Record<string, string>>(() => ({ ...defaultChartSelection.value.colors, ...userChartColors.value }));

  const randomChartColor = () => {
    const used = new Set(Object.values(chartColors.value));
    const pool = CHART_COLORS.filter((c) => !used.has(c));
    return pool.length ? pool[Math.floor(Math.random() * pool.length)]! : `hsl(${Math.floor(Math.random() * 360)} 72% 64%)`;
  };

  const chartTokens = computed(() => allChartTokens.value.filter((t) => chartTokenIds.value.includes(t.tokenId)).map((t) => ({ ...t, color: chartColors.value[t.tokenId] })));
  const chartPickerOptions = computed(() => allChartTokens.value.map((t) => ({ ...t, color: chartColors.value[t.tokenId] })));

  const toggleChartToken = (id: string) => {
    const current = chartTokenIds.value;
    const on = current.includes(id);
    if (on && current.length === 1) return;
    if (on) userChartTokenIds.value = current.filter((x) => x !== id);
    else {
      if (!chartColors.value[id]) userChartColors.value = { ...userChartColors.value, [id]: randomChartColor() };
      userChartTokenIds.value = [...current, id];
    }
  };

  return { chartHovered, chartTokenIds, chartColors, allChartTokens, chartTokens, chartPickerOptions, toggleChartToken };
}
