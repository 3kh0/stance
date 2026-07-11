import type { GammaEvent, GammaMarket } from "~/types/gamma";
import { parseMarketOutcomes } from "./grouping";

export interface EsportsSeriesMap {
  map: number;
  winner: "a" | "b" | null;
  live: boolean;
  scoreA?: number;
  scoreB?: number;
}
export interface EsportsSeries {
  bestOf: number;
  maps: EsportsSeriesMap[];
  wonA: number;
  wonB: number;
  hasRounds: boolean;
}
interface SeriesTeams {
  teamA: string;
  teamB: string;
}
export interface GridSeriesGameTeam {
  id?: string;
  name?: string;
  score?: number;
  won?: boolean;
}
export interface GridSeriesGame {
  sequenceNumber?: number;
  started?: boolean;
  finished?: boolean;
  teams?: GridSeriesGameTeam[];
}
export interface GridSeriesState {
  started?: boolean;
  finished?: boolean;
  format?: string;
  teams?: GridSeriesGameTeam[];
  games?: GridSeriesGame[];
}

const RESOLVED_HI = 0.99;
const RESOLVED_LO = 0.01;

function parsePrices(market: Pick<GammaMarket, "outcomePrices">): [number, number] | null {
  if (!market.outcomePrices) return null;
  try {
    const arr = JSON.parse(market.outcomePrices);
    const a = Number(arr?.[0]),
      b = Number(arr?.[1]);
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
  } catch {
    return null;
  }
}

function mapNumber(market: Pick<GammaMarket, "groupItemTitle" | "question" | "slug">): number | null {
  const t = `${market.groupItemTitle ?? ""} ${market.question ?? ""}`.match(/\b(?:map|game)\s*(\d+)\b/i);
  if (t) return Number(t[1]);
  const s = market.slug?.match(/-game(\d+)\b/i);
  return s ? Number(s[1]) : null;
}

function winnerSide(market: GammaMarket, teams: SeriesTeams): "a" | "b" | null {
  const prices = parsePrices(market);
  if (!prices) return null;
  const [pa, pb] = prices;
  if (!(market.closed === true || (Math.max(pa, pb) >= RESOLVED_HI && Math.min(pa, pb) <= RESOLVED_LO))) return null;
  const idx = pa >= pb ? 0 : 1;
  const [o0, o1] = parseMarketOutcomes(market);
  const w = (idx === 0 ? o0 : o1).toLowerCase();
  if (w === teams.teamA.toLowerCase()) return "a";
  if (w === teams.teamB.toLowerCase()) return "b";
  return idx === 0 ? "a" : "b";
}

export function parseBestOf(title: string | null | undefined): number | null {
  const n = Number(title?.match(/\bbo\s*(\d+)\b/i)?.[1] ?? NaN);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

const normTeam = (name: string | undefined) => (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function gridSides(gridTeams: GridSeriesGameTeam[], teams: SeriesTeams): { a: number; b: number } {
  const a = normTeam(teams.teamA),
    b = normTeam(teams.teamB);
  const find = (needle: string) =>
    gridTeams.findIndex((t) => {
      const g = normTeam(t.name);
      return g.length > 0 && needle.length > 0 && (g.includes(needle) || needle.includes(g));
    });
  let ai = find(a),
    bi = find(b);
  if (ai < 0 && bi < 0) return { a: 0, b: 1 };
  if (ai < 0) ai = bi === 0 ? 1 : 0;
  if (bi < 0) bi = ai === 0 ? 1 : 0;
  if (ai === bi) bi = ai === 0 ? 1 : 0;
  return { a: ai, b: bi };
}

export function buildEsportsSeries(event: Pick<GammaEvent, "title" | "markets" | "live" | "period"> | null | undefined, teams: SeriesTeams | null | undefined, grid?: GridSeriesState | null): EsportsSeries | null {
  if (!event || !teams) return null;

  const childMarkets = (event.markets ?? []).filter((m) => m.sportsMarketType === "child_moneyline");
  const gf = Number(grid?.format?.match(/(\d+)/)?.[1] ?? NaN);
  const bestOf = (Number.isFinite(gf) && gf >= 2 ? gf : null) ?? parseBestOf(event.title) ?? (childMarkets.length >= 2 ? childMarkets.length : null);
  if (!bestOf || bestOf < 2) return null;

  if (grid?.games && grid.games.length > 0) {
    const { a: ai, b: bi } = gridSides(grid.teams ?? grid.games[0]!.teams ?? [], teams);
    const byMap = new Map<number, GridSeriesGame>();
    for (const g of grid.games) if (typeof g.sequenceNumber === "number") byMap.set(g.sequenceNumber, g);

    let wonA = 0,
      wonB = 0;
    const maps: EsportsSeriesMap[] = [];
    for (let n = 1; n <= bestOf; n++) {
      const g = byMap.get(n);
      const ta = g?.teams?.[ai],
        tb = g?.teams?.[bi];
      const winner: "a" | "b" | null = g?.finished ? (ta?.won ? "a" : tb?.won ? "b" : null) : null;
      if (winner === "a") wonA++;
      else if (winner === "b") wonB++;
      maps.push({
        map: n,
        winner,
        live: g?.started === true && g?.finished !== true,
        scoreA: g?.started ? (Number.isFinite(ta?.score) ? ta!.score : 0) : undefined,
        scoreB: g?.started ? (Number.isFinite(tb?.score) ? tb!.score : 0) : undefined,
      });
    }
    return { bestOf, maps, wonA, wonB, hasRounds: true };
  }

  const byMap = new Map<number, GammaMarket>();
  for (const m of childMarkets) {
    const n = mapNumber(m);
    if (n) byMap.set(n, m);
  }
  if (byMap.size === 0) return null;

  const liveMapNo = event.live === true ? Number(event.period?.match(/\b(?:map|game)\s*(\d+)\b/i)?.[1] ?? NaN) : NaN;
  let wonA = 0,
    wonB = 0;
  const maps: EsportsSeriesMap[] = [];
  for (let n = 1; n <= bestOf; n++) {
    const winner = byMap.has(n) ? winnerSide(byMap.get(n)!, teams) : null;
    if (winner === "a") wonA++;
    else if (winner === "b") wonB++;
    maps.push({ map: n, winner, live: Number.isFinite(liveMapNo) && liveMapNo === n && !winner });
  }
  return { bestOf, maps, wonA, wonB, hasRounds: false };
}
