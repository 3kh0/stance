import type { Outcome } from "~/types/account";
import type { EventTeam, GammaEvent, GammaMarket, GammaTag } from "~/types/gamma";
import { parseOutcomePrices } from "~/utils/markets";
import { snapDisplayPrice } from "~/utils/quotes";
import { cleanTeamLogo, formatLine, formatSignedLine, isHandicapType, isMainTotalType, parseMarketOutcomes, teamAbbreviation } from "./grouping";
import { esportsEventUrl, eventLeague, eventTournament, isEsportsEvent, sportsEventUrl } from "./leagues";

export interface SportsOdds {
  label: string;
  price: number | null;
  market: GammaMarket | null;
  outcome: Outcome;
  kind: "moneyline" | "spread" | "total";
  color?: string;
}

export interface SportsLineOption {
  kind: "spread" | "total";
  line: number;
  teams: [SportsOdds, SportsOdds];
}

export interface SportsGameTeam {
  name: string;
  abbrev: string;
  logo?: string;
  record?: string;
  color?: string;
  score?: string;
  moneyline: SportsOdds | null;
  spread: SportsOdds | null;
  total: SportsOdds | null;
}

export interface SportsGame {
  id: string;
  slug?: string;
  url: string;
  title: string;
  leagueSlug: string;
  leagueLabel: string;
  tournament: string | null;
  startTime: string | null;
  startMs: number | null;
  volume: number;
  live: boolean;
  period: string | null;
  teams: [SportsGameTeam, SportsGameTeam];
  hasOdds: boolean;
  spreadOptions: SportsLineOption[];
  totalOptions: SportsLineOption[];
}

type SportsFixtureMetadata = GammaEvent["eventMetadata"] & {
  opticOddsFixtureId?: unknown;
  opticOddsGameId?: unknown;
  opticOddsNumericalId?: unknown;
  sportradarGameId?: unknown;
};

const FINAL_PERIODS = /^(ft|vft|aot|aet|ft_?pen|final|ended|cancel|postp|abandon|walkover|w\.?o)/i;
const GAME_SLUG_SUFFIX = /-(?:more-markets|exact-score|halftime-result|second-half-result|first-to-score|player-props|total-corners)$/;
const COMPACT_GAME_LINE_TYPES = new Set(["moneyline", "spreads", "totals", "both_teams_to_score"]);

export const isFinalPeriod = (period: string | null | undefined): boolean => typeof period === "string" && FINAL_PERIODS.test(period.trim());

export interface TennisSetCell {
  games: string;
  tiebreak?: string;
}

export interface TennisSet {
  home: TennisSetCell;
  away: TennisSetCell;
}

const stripTiebreak = (s: string) => s.replace(/\([^)]*\)/g, "").trim();

export function parseScore(raw: string | null | undefined): { home: string; away: string } | null {
  if (!raw || typeof raw !== "string") return null;
  let body = raw.trim();
  if (!body) return null;
  if (body.includes("|")) body = (body.split("|")[1] ?? body.split("|")[0] ?? "").trim();
  if (body.includes(",")) {
    const sets = body.split(",").map((s) => stripTiebreak(s).split("-"));
    const home = sets.map((s) => s[0]?.trim() ?? "").join(" ");
    const away = sets.map((s) => s[1]?.trim() ?? "").join(" ");
    return home || away ? { home, away } : null;
  }
  const [home = "", away = ""] = stripTiebreak(body)
    .split("-")
    .map((s) => s.trim());
  return home || away ? { home, away } : null;
}

export function parseTennisSets(raw: string | null | undefined): TennisSet[] | null {
  if (!raw || typeof raw !== "string") return null;
  const body = raw.trim();
  if (!body || body.includes("|") || (!body.includes(",") && !body.includes("("))) return null;
  const sets: TennisSet[] = [];
  for (const part of body.split(",")) {
    const set = part.trim();
    if (!set) continue;
    const tb = set.match(/\(([^)]*)\)/)?.[1];
    const [hg = "", ag = ""] = stripTiebreak(set)
      .split("-")
      .map((s) => s.trim());
    if (!hg && !ag) continue;
    const [ht, at] = (tb ?? "").split("-").map((s) => s.trim());
    sets.push({ home: { games: hg, tiebreak: ht || undefined }, away: { games: ag, tiebreak: at || undefined } });
  }
  return sets.length ? sets : null;
}

function scoresForTeams(raw: string | null | undefined, teamAName: string, teams: EventTeam[]): { a?: string; b?: string } {
  const p = parseScore(raw);
  if (!p) return {};
  return teamFor(teamAName, 0, teams)?.ordering === "away" ? { a: p.away, b: p.home } : { a: p.home, b: p.away };
}

function teamFor(name: string, index: number, teams: EventTeam[]): EventTeam | undefined {
  if (teams.length === 0) return undefined;
  const k = name.toLowerCase();
  return teams.find((t) => t.name?.toLowerCase() === k || t.abbreviation?.toLowerCase() === k) ?? teams.find((t) => t.ordering === (index === 0 ? "home" : "away")) ?? teams[index];
}

export const teamLogoFor = (outcome: string, index: number, teams: EventTeam[]): string | undefined => cleanTeamLogo(teamFor(outcome, index, teams)?.logo);

const teamRecordFor = (name: string, index: number, teams: EventTeam[]): string | undefined => teamFor(name, index, teams)?.record || undefined;

const isUsableColor = (c: string | undefined): c is string => typeof c === "string" && /^#?[0-9a-fA-F]{6}$/.test(c.trim());

export const normalizeTeamColor = (color: string | undefined): string | undefined => (isUsableColor(color) ? (color.startsWith("#") ? color : `#${color}`) : undefined);

export const teamColorFor = (name: string, index: number, teams: EventTeam[]): string | undefined => normalizeTeamColor(teamFor(name, index, teams)?.color);

export function sportsOutcomeColor(label: string, teams: EventTeam[] = []): string | undefined {
  const k = label.toLowerCase();
  return normalizeTeamColor(teams.find((t) => t.name?.toLowerCase() === k || t.abbreviation?.toLowerCase() === k)?.color);
}

export function sportsMarketSideColors(market: GammaMarket, teams: EventTeam[] = []): { yes?: string; no?: string } {
  const [yes, no] = parseMarketOutcomes(market);
  if (/^yes$/i.test(yes) && /^no$/i.test(no)) return { yes: sportsOutcomeColor(market.groupItemTitle ?? "", teams) };
  return { yes: sportsOutcomeColor(yes, teams), no: sportsOutcomeColor(no, teams) };
}

const activeMarket = (m: GammaMarket) => m.active !== false && m.closed !== true;
const marketVolume = (m: GammaMarket) => Number(m.volumeNum ?? m.volume ?? 0) || 0;
const activeType = (type: string) => (m: GammaMarket) => m.sportsMarketType === type && activeMarket(m);
const pickPreferred = (markets: GammaMarket[]) => [...markets].sort((a, b) => marketVolume(b) - marketVolume(a))[0];

function metadataString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

export function sportsFixtureKey(event: Pick<GammaEvent, "eventMetadata" | "slug">): string | null {
  const md = event.eventMetadata as SportsFixtureMetadata | undefined;
  const k = metadataString(md?.opticOddsGameId) ?? metadataString(md?.opticOddsFixtureId) ?? metadataString(md?.opticOddsNumericalId) ?? metadataString(md?.sportradarGameId);
  if (k) return `fixture:${k}`;
  const slug = event.slug?.replace(GAME_SLUG_SUFFIX, "");
  return slug && slug !== event.slug ? `slug:${slug}` : null;
}

const hasMoneyline = (e: GammaEvent) => (e.markets ?? []).some(activeType("moneyline"));
const hasCompactGameLine = (e: GammaEvent) => (e.markets ?? []).some((m) => COMPACT_GAME_LINE_TYPES.has(m.sportsMarketType ?? "") && activeMarket(m));
const eventVolume = (e: GammaEvent) => Number(e.volume) || 0;

function mergedTags(events: GammaEvent[]): GammaTag[] {
  const m = new Map<string, GammaTag>();
  for (const e of events)
    for (const t of e.tags ?? []) {
      const k = String(t.id ?? t.slug ?? t.label);
      if (!m.has(k)) m.set(k, t);
    }
  return [...m.values()];
}

function mergedMarkets(events: GammaEvent[]): GammaMarket[] {
  const m = new Map<string, GammaMarket>();
  for (const e of events) for (const mk of e.markets ?? []) if (!m.has(mk.id)) m.set(mk.id, mk);
  return [...m.values()];
}

export function mergeSportsGameEvents(events: GammaEvent[]): GammaEvent[] {
  const keyed = new Map<string, GammaEvent[]>();
  for (const e of events) {
    const k = sportsFixtureKey(e);
    if (!k) continue;
    (keyed.get(k) ?? keyed.set(k, []).get(k)!).push(e);
  }

  const mergeGroup = (group: GammaEvent[]): GammaEvent => {
    if (group.length === 1) return group[0]!;
    const primary = group.find(hasMoneyline) ?? group[0]!;
    const live = group.find((e) => e.live === true) ?? primary;
    const compactVol = group.filter(hasCompactGameLine).reduce((s, e) => s + eventVolume(e), 0);
    return {
      ...primary,
      live: live.live ?? primary.live,
      period: live.period ?? primary.period,
      score: live.score ?? primary.score,
      markets: mergedMarkets([primary, ...group.filter((e) => e !== primary)]),
      tags: mergedTags(group) as GammaEvent["tags"],
      volume: compactVol || group.reduce((s, e) => s + eventVolume(e), 0) || primary.volume,
    };
  };

  const emitted = new Set<string>();
  const out: GammaEvent[] = [];
  for (const e of events) {
    const k = sportsFixtureKey(e);
    if (!k) {
      out.push(e);
      continue;
    }
    if (emitted.has(k)) continue;
    emitted.add(k);
    out.push(mergeGroup(keyed.get(k) ?? [e]));
  }
  return out;
}

function validTradePrice(v: unknown): number | null {
  const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
  return Number.isFinite(n) && n > 0 && n < 1 ? n : null;
}

export function sportsDisplayPrice(market: GammaMarket, side: Outcome): number | null {
  const bid = validTradePrice(market.bestBid);
  const quote = side === "yes" ? validTradePrice(market.bestAsk) : bid == null ? null : 1 - bid;
  const raw = quote ?? validTradePrice(parseOutcomePrices(market)[side]);
  return raw === null ? null : snapDisplayPrice(raw, market);
}

function alignToTeams(market: GammaMarket, teamA: string, teamB: string): { lineA: number; aIsYes: boolean } {
  const [o0, o1] = parseMarketOutcomes(market);
  const line = Number(market.line);
  if (/^yes$/i.test(o0) && /^no$/i.test(o1)) {
    const title = (market.groupItemTitle ?? market.question ?? "").toLowerCase();
    if (title.includes(teamA.toLowerCase())) return { lineA: line, aIsYes: true };
    if (title.includes(teamB.toLowerCase())) return { lineA: -line, aIsYes: false };
  }
  if (o1.toLowerCase() === teamA.toLowerCase() && o0.toLowerCase() !== teamA.toLowerCase()) return { lineA: -line, aIsYes: false };
  return { lineA: line, aIsYes: true };
}

function spreadOption(market: GammaMarket, teamAName: string, teamBName: string, abbrevA: string, abbrevB: string, colorA?: string, colorB?: string): SportsLineOption | null {
  const { lineA, aIsYes } = alignToTeams(market, teamAName, teamBName);
  const outcomeA: Outcome = aIsYes ? "yes" : "no";
  const outcomeB: Outcome = aIsYes ? "no" : "yes";
  const line = Math.abs(Number(lineA));
  if (!Number.isFinite(line)) return null;
  return {
    kind: "spread",
    line,
    teams: [
      { label: `${abbrevA} ${formatSignedLine(lineA)}`, price: sportsDisplayPrice(market, outcomeA), market, outcome: outcomeA, kind: "spread", color: colorA },
      { label: `${abbrevB} ${formatSignedLine(-lineA)}`, price: sportsDisplayPrice(market, outcomeB), market, outcome: outcomeB, kind: "spread", color: colorB },
    ],
  };
}

function totalOption(market: GammaMarket): SportsLineOption | null {
  const line = Math.abs(Number(market.line));
  if (!Number.isFinite(line)) return null;
  const label = formatLine(line);
  return {
    kind: "total",
    line,
    teams: [
      { label: `O ${label}`, price: sportsDisplayPrice(market, "yes"), market, outcome: "yes", kind: "total" },
      { label: `U ${label}`, price: sportsDisplayPrice(market, "no"), market, outcome: "no", kind: "total" },
    ],
  };
}

const lineOptionVolume = (o: SportsLineOption) => o.teams.reduce((s, odds) => s + (odds.market ? marketVolume(odds.market) : 0), 0);

function mainLineDistance(o: SportsLineOption): number {
  const prices = o.teams.map((x) => x.price).filter((p): p is number => p !== null);
  return prices.length ? Math.min(...prices.map((p) => Math.abs(p - 0.5))) : Number.POSITIVE_INFINITY;
}

const pickMainLine = (options: SportsLineOption[]) => [...options].sort((a, b) => mainLineDistance(a) - mainLineDistance(b) || lineOptionVolume(b) - lineOptionVolume(a) || a.line - b.line)[0];

function makeOdds(market: GammaMarket, outcome: Outcome, kind: SportsOdds["kind"] = "moneyline"): SportsOdds {
  return { label: "", price: sportsDisplayPrice(market, outcome), market, outcome, kind };
}

export function toSportsGame(event: GammaEvent): SportsGame | null {
  const markets = event.markets ?? [];
  const roster = (event.teams as EventTeam[] | undefined) ?? [];
  const moneylines = markets.filter(activeType("moneyline"));
  if (!moneylines.length) return null;

  let teamAName = "",
    teamBName = "",
    mlA: SportsOdds | null = null,
    mlB: SportsOdds | null = null,
    logoA: string | undefined,
    logoB: string | undefined,
    startTime: string | undefined;

  const teamMl = moneylines.find((m) => {
    const [a, b] = parseMarketOutcomes(m);
    return !(a.toLowerCase() === "yes" && b.toLowerCase() === "no");
  });

  if (teamMl) {
    const [a, b] = parseMarketOutcomes(teamMl);
    teamAName = a;
    teamBName = b;
    mlA = makeOdds(teamMl, "yes");
    mlB = makeOdds(teamMl, "no");
    logoA = teamLogoFor(a, 0, roster);
    logoB = teamLogoFor(b, 1, roster);
    startTime = teamMl.gameStartTime;
  } else {
    if (roster.length < 2) return null;
    const home = roster.find((t) => t.ordering === "home") ?? roster[0]!;
    const away = roster.find((t) => t.ordering === "away") ?? roster[1]!;
    const win = (t: EventTeam) => moneylines.find((m) => (m.groupItemTitle ?? "").toLowerCase() === t.name.toLowerCase());
    const ma = win(home),
      mb = win(away);
    if (!ma || !mb) return null;
    teamAName = home.name;
    teamBName = away.name;
    mlA = makeOdds(ma, "yes");
    mlB = makeOdds(mb, "yes");
    logoA = cleanTeamLogo(home.logo);
    logoB = cleanTeamLogo(away.logo);
    startTime = ma.gameStartTime ?? mb.gameStartTime;
  }

  const shorten = (a: string) => (a.length > 4 && !/^(draw|over|under|yes|no)$/i.test(a) ? a.slice(0, 4) : a);
  const abbrevA = shorten(teamAbbreviation(teamAName, roster));
  const abbrevB = shorten(teamAbbreviation(teamBName, roster));
  const colorA = teamColorFor(teamAName, 0, roster);
  const colorB = teamColorFor(teamBName, 1, roster);
  mlA.label = abbrevA;
  mlA.color = colorA;
  mlB.label = abbrevB;
  mlB.color = colorB;

  const spreadByLine = new Map<number, GammaMarket[]>();
  for (const m of markets.filter((x) => isHandicapType(x.sportsMarketType ?? "") && Number.isFinite(x.line) && activeMarket(x))) {
    const line = Math.abs(Number(m.line));
    (spreadByLine.get(line) ?? spreadByLine.set(line, []).get(line)!).push(m);
  }
  const spreadOptions = [...spreadByLine.values()]
    .map(pickPreferred)
    .filter((m): m is GammaMarket => m !== undefined)
    .map((m) => spreadOption(m, teamAName, teamBName, abbrevA, abbrevB, colorA, colorB))
    .filter((o): o is SportsLineOption => o !== null)
    .sort((a, b) => a.line - b.line);
  const mainSpread = pickMainLine(spreadOptions) ?? spreadOptions[0];
  const spreadA = mainSpread?.teams[0] ?? null;
  const spreadB = mainSpread?.teams[1] ?? null;

  const totalOptions = markets
    .filter((m) => isMainTotalType(m.sportsMarketType ?? "") && Number.isFinite(m.line) && activeMarket(m))
    .map(totalOption)
    .filter((o): o is SportsLineOption => o !== null)
    .sort((a, b) => a.line - b.line);
  const mainTotal = pickMainLine(totalOptions) ?? totalOptions[0];
  const totalA = mainTotal?.teams[0] ?? null;
  const totalB = mainTotal?.teams[1] ?? null;

  const league = eventLeague(event);
  const live = event.live === true;
  const period = event.period?.trim() || null;
  const scores = live ? scoresForTeams(event.score, teamAName, roster) : {};
  const mkTeam = (name: string, abbrev: string, logo: string | undefined, color: string | undefined, score: string | undefined, moneyline: SportsOdds | null, spread: SportsOdds | null, total: SportsOdds | null, idx: number): SportsGameTeam => ({
    name,
    abbrev,
    logo,
    record: teamRecordFor(name, idx, roster),
    color,
    score,
    moneyline,
    spread,
    total,
  });

  const esports = isEsportsEvent(event);
  return {
    id: String(event.id),
    slug: event.slug,
    url: esports ? esportsEventUrl(event, league.slug) : sportsEventUrl(event, league.slug),
    title: event.title,
    leagueSlug: league.slug,
    leagueLabel: league.label,
    tournament: eventTournament(event),
    startTime: startTime ?? event.startTime ?? null,
    startMs: parseSportsTime(startTime ?? event.startTime ?? null),
    volume: Number(event.volume) || 0,
    live,
    period,
    teams: [mkTeam(teamAName, abbrevA, logoA, colorA, scores.a, mlA, spreadA, totalA, 0), mkTeam(teamBName, abbrevB, logoB, colorB, scores.b, mlB, spreadB, totalB, 1)],
    hasOdds: mlA.price !== null || Boolean(spreadA) || Boolean(totalA),
    spreadOptions,
    totalOptions,
  };
}

export function parseSportsTime(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const ms = Date.parse(raw.replace(" ", "T").replace(/\+00$/, "Z"));
  return Number.isFinite(ms) ? ms : null;
}
