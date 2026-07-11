import type { EventTeam, GammaEvent, GammaMarket } from "~/types/gamma";
import { capitalize } from "~/utils/strings";

export interface SportsMarketTab {
  key: string;
  label: string;
  order: number;
}
export interface SportsMarketScope {
  key: string;
  label: string;
  order: number;
}
export interface SportsMarketGroup<T extends GammaMarket = GammaMarket> {
  key: string;
  title: string;
  order: number;
  tab: SportsMarketTab;
  scope: SportsMarketScope;
  halfSection?: SportsMarketScope;
  layout: "binary" | "ternary" | "paired" | "slider";
  markets: T[];
}

const TAB_GAME_LINES: SportsMarketTab = { key: "game-lines", label: "Game Lines", order: 0 };
const TAB_EXACT_SCORE: SportsMarketTab = { key: "exact-score", label: "Exact Score", order: 1 };
const TAB_HALVES: SportsMarketTab = { key: "halves", label: "Halves", order: 2 };
const TAB_CORNERS: SportsMarketTab = { key: "corners", label: "Corners", order: 3 };
const TAB_GOALS: SportsMarketTab = { key: "goals", label: "Goals", order: 4 };
const TAB_ASSISTS: SportsMarketTab = { key: "assists", label: "Assists", order: 5 };
const TAB_SHOTS: SportsMarketTab = { key: "shots", label: "Shots", order: 6 };

const SERIES_SCOPE: SportsMarketScope = { key: "series", label: "Series Lines", order: 0 };
const FIRST_HALF_SECTION: SportsMarketScope = { key: "first-half", label: "1st Half", order: 31 };
const SECOND_HALF_SECTION: SportsMarketScope = { key: "second-half", label: "2nd Half", order: 32 };

export const isSportsEvent = (event: Partial<Pick<GammaEvent, "markets" | "tags">> | null | undefined): boolean => (event ? (event.markets ?? []).some((m) => Boolean(m.sportsMarketType)) : false);

export function parseMarketOutcomes(market: Pick<GammaMarket, "outcomes"> | null | undefined): [string, string] {
  if (!market?.outcomes) return ["Yes", "No"];
  try {
    const o = JSON.parse(market.outcomes);
    return Array.isArray(o) ? [cleanOutcome(o[0], "Yes"), cleanOutcome(o[1], "No")] : ["Yes", "No"];
  } catch {
    return ["Yes", "No"];
  }
}

export const cleanTeamLogo = (logo: string | null | undefined): string | undefined => (!logo || /\/a\.png(?:[?#]|$)/i.test(logo) ? undefined : logo);

const teamKey = (s: string | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ABBREV_SPECIAL: [RegExp, string][] = [
  [/^draw$/i, "DRAW"],
  [/^over$/i, "O"],
  [/^under$/i, "U"],
  [/^yes$/i, "YES"],
  [/^no$/i, "NO"],
  [/^neither$/i, "NEITHER"],
];

export function teamAbbreviation(name: string, teams: EventTeam[] = []): string {
  const k = teamKey(name);
  const m = teams.find((t) => k && (teamKey(t.name) === k || teamKey(t.alias) === k || teamKey(t.abbreviation) === k));
  if (m?.abbreviation) return m.abbreviation.toUpperCase();
  for (const [re, label] of ABBREV_SPECIAL) if (re.test(name)) return label;
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return (parts[0] ?? name).toUpperCase().slice(0, 4);
  const first = parts[0]!;
  if (first.length <= 4 && first === first.toUpperCase()) return first.slice(0, 4);
  return parts
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 4);
}

export function sportsOutcomeLabels(market: GammaMarket, teams: EventTeam[] = []): [string, string] {
  const outcomes = parseMarketOutcomes(market);
  const ab = (i: number) => teamAbbreviation(outcomes[i]!, teams);
  if (!Number.isFinite(market.line)) return [ab(0), ab(1)];
  const line = Number(market.line);
  const type = market.sportsMarketType ?? "";
  if (isHandicapType(type)) return [`${ab(0)} ${formatSignedLine(line)}`, `${ab(1)} ${formatSignedLine(-line)}`];
  if (isTotalType(type) || outcomes.every((o) => /^(over|under)$/i.test(o))) return [`O ${formatLine(line)}`, `U ${formatLine(line)}`];
  return [ab(0), ab(1)];
}

export function sportsLineLabel(market: GammaMarket): string {
  const [first] = parseMarketOutcomes(market);
  if (!Number.isFinite(market.line)) return market.groupItemTitle || market.question;
  if (isHandicapType(market.sportsMarketType ?? "")) return `${first} ${formatSignedLine(Number(market.line))}`;
  return formatLine(Number(market.line));
}

const lineSideKey = (market: GammaMarket, teams: EventTeam[]) => teamAbbreviation(parseMarketOutcomes(market)[0] ?? "", teams);

function lineReferenceSide(markets: GammaMarket[], teams: EventTeam[]): string | undefined {
  const sides = new Set<string>();
  for (const m of markets) if (Number.isFinite(m.line)) sides.add(lineSideKey(m, teams));
  return [...sides].sort()[0];
}

export function sportsSliderValue(market: GammaMarket, group: GammaMarket[], teams: EventTeam[] = []): number | null {
  if (!Number.isFinite(market.line)) return null;
  const mag = Math.abs(Number(market.line));
  const ref = lineReferenceSide(group, teams);
  if (!group.some((m) => Number.isFinite(m.line) && lineSideKey(m, teams) !== ref)) return mag;
  return lineSideKey(market, teams) === ref ? mag : -mag;
}

export function sportsSliderLines(markets: GammaMarket[], teams: EventTeam[] = []): number[] {
  const lines = new Set<number>();
  for (const m of markets) {
    const v = sportsSliderValue(m, markets, teams);
    if (v !== null) lines.add(v);
  }
  return [...lines].sort((a, b) => a - b);
}

export function marketAtLine(markets: GammaMarket[], line: number, teams: EventTeam[] = []): GammaMarket | undefined {
  const matches = markets.filter((m) => sportsSliderValue(m, markets, teams) === line);
  return matches.length ? [...matches].sort((a, b) => marketVolume(b) - marketVolume(a))[0] : undefined;
}

export function getSportsTabs(markets: GammaMarket[]): SportsMarketTab[] {
  const tabs = new Map<string, SportsMarketTab>();
  for (const m of markets) {
    if (!m.sportsMarketType) continue;
    const t = sportsMarketTab(m);
    tabs.set(t.key, t);
  }
  return [...tabs.values()].sort((a, b) => a.order - b.order);
}

export function groupSportsMarkets<T extends GammaMarket>(markets: T[], tabKey?: string): SportsMarketGroup<T>[] {
  const groups = new Map<string, SportsMarketGroup<T>>();
  for (const m of markets) {
    if (!m.sportsMarketType) continue;
    const tab = sportsMarketTab(m);
    if (tabKey && tab.key !== tabKey) continue;
    const scope = sportsMarketScope(m);
    const cat = sportsMarketCategory(m);
    const key = `${tab.key}:${scope.key}:${cat.key}`;
    const existing = groups.get(key);
    if (existing) {
      existing.markets.push(m);
      continue;
    }
    groups.set(key, { key, title: cat.title, order: cat.order, tab, scope, halfSection: sportsHalfSection(m), layout: cat.layout, markets: [m] });
  }
  return [...groups.values()].map((g) => ({ ...g, markets: [...g.markets].sort(compareSportsLines) })).sort((a, b) => a.tab.order - b.tab.order || (a.halfSection?.order ?? a.scope.order) - (b.halfSection?.order ?? b.scope.order) || a.order - b.order || a.title.localeCompare(b.title));
}

export const preferredSportsMarket = <T extends GammaMarket>(group: SportsMarketGroup<T>): T => [...group.markets].sort((a, b) => marketVolume(b) - marketVolume(a))[0] ?? group.markets[0]!;

function sportsMarketTab(market: GammaMarket): SportsMarketTab {
  const t = market.sportsMarketType ?? "";
  if (t === "soccer_exact_score") return TAB_EXACT_SCORE;
  if (["soccer_player_goals", "soccer_player_goals_plus_assists", "soccer_player_goalkeeper_saves"].includes(t)) return TAB_GOALS;
  if (t === "soccer_player_assists") return TAB_ASSISTS;
  if (t.includes("shot")) return TAB_SHOTS;
  if (t.includes("corner")) return TAB_CORNERS;
  if (isHalfMarket(t)) return TAB_HALVES;
  return TAB_GAME_LINES;
}

const isHalfMarket = (type: string) => type.startsWith("first_half_") || type.startsWith("second_half_") || type.includes("_first_half_") || type.includes("_second_half_") || type.includes("halftime") || type.includes("half_result");

function sportsHalfSection(market: GammaMarket): SportsMarketScope | undefined {
  const t = market.sportsMarketType ?? "";
  if (t.startsWith("first_half_") || t.includes("_first_half_") || t.includes("halftime")) return FIRST_HALF_SECTION;
  if (t.startsWith("second_half_") || t.includes("_second_half_")) return SECOND_HALF_SECTION;
  return undefined;
}

function sportsMarketScope(market: GammaMarket): SportsMarketScope {
  const t = market.sportsMarketType ?? "";
  const title = market.groupItemTitle || market.question || "";
  if (t === "child_moneyline") return SERIES_SCOPE;
  const np = title.match(/\b(map|game|set)\s*(\d+)\b/i);
  if (np) {
    const noun = capitalize(np[1]!),
      n = Number(np[2]);
    return { key: `${noun.toLowerCase()}-${n}`, label: `${noun} ${n}`, order: 10 + n };
  }
  const n = Number(t.match(/_game_(\d+)$/)?.[1] ?? NaN);
  if (Number.isFinite(n)) return { key: `map-${n}`, label: `Map ${n}`, order: 10 + n };
  if (t.includes("first_set")) return { key: "set-1", label: "Set 1", order: 21 };
  return SERIES_SCOPE;
}

function sportsMarketCategory(market: GammaMarket): { key: string; title: string; order: number; layout: SportsMarketGroup["layout"] } {
  const t = market.sportsMarketType ?? "market";
  const title = market.groupItemTitle || market.question || "Market";
  if (t.includes("to_advance")) return { key: "to-advance", title: "Team to Advance", order: -1, layout: "paired" };
  if (t === "moneyline") {
    const o = parseMarketOutcomes(market);
    return o[0].toLowerCase() === "yes" && o[1].toLowerCase() === "no" ? { key: "moneyline-1x2", title: "Moneylines", order: 0, layout: "ternary" } : { key: "moneyline", title: "Moneyline", order: 0, layout: "paired" };
  }
  if (t === "child_moneyline") return { key: `winner:${title.toLowerCase()}`, title, order: 10 + periodNumber(title), layout: "paired" };
  if (t === "spreads") return { key: "spreads", title: "Spreads", order: 20, layout: "paired" };
  if (["totals", "first_half_totals", "second_half_totals"].includes(t)) return { key: normalizedCategoryKey(t), title: totalsTitle(t), order: 30, layout: "slider" };
  if (["both_teams_to_score", "both_teams_to_score_first_half", "both_teams_to_score_second_half"].includes(t)) return { key: normalizedCategoryKey(t), title: title.replace(/\?$/, "") + "?", order: 40, layout: "binary" };
  if (t === "soccer_team_totals" || t === "soccer_first_half_team_totals" || t === "soccer_second_half_team_totals") {
    const team = title
      .replace(/\s*(?:O\/U|o\/u)\s*.*$/i, "")
      .replace(/\s*\d+(?:st|nd)\s+Half\s*/i, " ")
      .trim();
    return { key: `team-totals:${team.toLowerCase()}`, title: `${team} Totals`, order: 35, layout: "slider" };
  }
  if (t === "soccer_exact_score") return { key: `score:${title.toLowerCase()}`, title, order: 10, layout: "binary" };
  if (t.startsWith("soccer_player_")) {
    const player = title.split(":")[0]?.trim() || title;
    return { key: `player:${player.toLowerCase()}`, title: player, order: 50, layout: "slider" };
  }
  if (t === "map_handicap") return { key: "map-handicap", title: "Map Handicap", order: 30, layout: "slider" };
  if (t.startsWith("round_handicap_")) return { key: "round-handicap", title: "Rounds Handicap", order: 20, layout: "slider" };
  if (t.startsWith("round_over_under_")) return { key: "round-total", title: "Total Rounds", order: 30, layout: "slider" };
  if (isHandicapType(t)) return { key: normalizedCategoryKey(t), title: titleBeforeLine(title, "Handicap"), order: 20, layout: "paired" };
  if (isTotalType(t)) return { key: normalizedCategoryKey(t), title: titleBeforeLine(title, "Total"), order: 30, layout: "slider" };
  return { key: normalizedCategoryKey(t), title: humanizeSportsType(t), order: 50, layout: "binary" };
}

const totalsTitle = (type: string) => (type === "first_half_totals" ? "1H Totals" : type === "second_half_totals" ? "2nd Half Totals" : "Totals");

const normalizedCategoryKey = (type: string) =>
  type
    .replace(/_game_\d+$/, "")
    .replace(/^(first|second)_half_/, "")
    .replace(/^tennis_first_set_/, "tennis_");

const titleBeforeLine = (title: string, fallback: string) =>
  title
    .replace(/^Map \d+\s+/i, "")
    .replace(/:\s*(?:over\/under|o\/u).*$/i, "")
    .replace(/:\s*[^:]+\([+-]?\d+(?:\.\d+)?\).*$/i, "")
    .trim() || fallback;

const humanizeSportsType = (type: string) =>
  type
    .replace(/_game_\d+$/, "")
    .replace(/^(first|second)_half_/, "")
    .split("_")
    .map(capitalize)
    .join(" ");

function compareSportsLines(a: GammaMarket, b: GammaMarket): number {
  const al = Number.isFinite(a.line) ? Number(a.line) : Number.POSITIVE_INFINITY;
  const bl = Number.isFinite(b.line) ? Number(b.line) : Number.POSITIVE_INFINITY;
  return al - bl || sportsLineLabel(a).localeCompare(sportsLineLabel(b));
}

const marketVolume = (market: GammaMarket) => Number(market.volumeNum ?? market.volume ?? 0) || 0;

export const isHandicapType = (type: string): boolean => type.includes("handicap") || type.includes("spread");

const isTotalType = (type: string) => type === "totals" || type.includes("total") || type.includes("over_under");

export const isMainTotalType = (type: string): boolean => type === "totals" || type === "total" || type === "over_under" || type === "match_totals" || type.endsWith("_match_totals");

export const formatSignedLine = (line: number): string => `${line > 0 ? "+" : ""}${formatLine(line)}`;

export const formatLine = (line: number): string => (Number.isInteger(line) ? line.toFixed(0) : String(line));

const periodNumber = (title: string) => Number(title.match(/\b(?:map|game|set)\s*(\d+)\b/i)?.[1] ?? 99);

const cleanOutcome = (value: unknown, fallback: string) => (typeof value === "string" && value.trim() ? value.trim() : fallback);
