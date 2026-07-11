import type { EventTeam, GammaEvent, GammaMarket } from "~/types/gamma";
import { parseClobTokenIds } from "~/utils/markets";
import type { TennisSetCell } from "~/utils/sports";
import { normalizeTeamColor, parseMarketOutcomes, parseScore, parseTennisSets, sportsDisplayPrice, teamAbbreviation, teamColorFor, teamLogoFor } from "~/utils/sports";

export interface SportsMoneylineOutcome {
  key: string;
  label: string;
  abbrev: string;
  price: number;
  market: GammaMarket;
  tokenId?: string;
  logo?: string;
  color?: string;
}

export interface SportsMatchup {
  teamA: string;
  teamB: string;
  abbrevA: string;
  abbrevB: string;
  logoA?: string;
  logoB?: string;
  colorA?: string;
  colorB?: string;
  recordA?: string;
  recordB?: string;
  scoreA?: string;
  scoreB?: string;
  setsA?: TennisSetCell[];
  setsB?: TennisSetCell[];
  live: boolean;
  ended: boolean;
  period: string | null;
  priceA: number;
  priceB: number;
  drawPrice: number | null;
  drawMarket: GammaMarket | null;
  moneylineOutcomes: SportsMoneylineOutcome[];
  startTime: string | null;
}

function scoreParts(raw: string | null | undefined): [string | undefined, string | undefined] {
  const p = parseScore(raw);
  return [p?.home || undefined, p?.away || undefined];
}

function side(name: string, idx: 0 | 1, teams: EventTeam[], price: number, market: GammaMarket, key: string, tokenId?: string, color?: string): SportsMoneylineOutcome {
  return {
    key,
    label: name,
    abbrev: teamAbbreviation(name, teams),
    price,
    market,
    tokenId,
    logo: teamLogoFor(name, idx, teams),
    color: color ?? teamColorFor(name, idx, teams),
  };
}

export function buildSportsMatchup(event: Pick<GammaEvent, "markets" | "teams" | "score" | "period" | "live" | "ended"> | null | undefined): SportsMatchup | null {
  if (!event) return null;
  const teams = event.teams ?? [];
  const moneylines = (event.markets ?? []).filter((m) => m.sportsMarketType === "moneyline" && m.active !== false);
  if (moneylines.length === 0) return null;
  const [homeScore, awayScore] = scoreParts(event.score);
  const tennisSets = parseTennisSets(event.score);
  const homeSets = tennisSets?.map((s) => s.home);
  const awaySets = tennisSets?.map((s) => s.away);
  const live = event.live === true;
  const ended = event.ended === true;
  const period = event.period?.trim() || null;
  const base = { live, ended, period, scoreA: homeScore, scoreB: awayScore, setsA: homeSets, setsB: awaySets };

  const teamMoneyline = moneylines.find((m) => {
    const [a, b] = parseMarketOutcomes(m);
    return !(a.toLowerCase() === "yes" && b.toLowerCase() === "no");
  });

  if (teamMoneyline) {
    const [teamA, teamB] = parseMarketOutcomes(teamMoneyline);
    const yes = sportsDisplayPrice(teamMoneyline, "yes") ?? 0;
    const no = sportsDisplayPrice(teamMoneyline, "no") ?? 0;
    const [tokenA, tokenB] = parseClobTokenIds(teamMoneyline);
    const a = side(teamA, 0, teams, yes, teamMoneyline, "home", tokenA);
    const b = side(teamB, 1, teams, no, teamMoneyline, "away", tokenB);
    return {
      teamA,
      teamB,
      abbrevA: a.abbrev,
      abbrevB: b.abbrev,
      logoA: a.logo,
      logoB: b.logo,
      colorA: a.color,
      colorB: b.color,
      recordA: teams[0]?.record,
      recordB: teams[1]?.record,
      ...base,
      priceA: yes,
      priceB: no,
      drawPrice: null,
      drawMarket: null,
      moneylineOutcomes: [a, b],
      startTime: teamMoneyline.gameStartTime ?? null,
    };
  }

  if (teams.length < 2) return null;
  const home = teams.find((t) => t.ordering === "home") ?? teams[0]!;
  const away = teams.find((t) => t.ordering === "away") ?? teams[1]!;
  const norm = (s: string | undefined) =>
    (s ?? "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const winMarket = (team: EventTeam) => {
    const keys = new Set([norm(team.name), norm(team.alias), norm(team.abbreviation)].filter(Boolean));
    return moneylines.find((m) => keys.has(norm(m.groupItemTitle)));
  };
  const homeMarket = winMarket(home);
  const awayMarket = winMarket(away);
  if (!homeMarket || !awayMarket) return null;

  const drawMarket = moneylines.find((m) => /draw/i.test(m.groupItemTitle ?? m.question ?? "")) ?? null;
  const drawPrice = drawMarket ? (sportsDisplayPrice(drawMarket, "yes") ?? 0) : null;
  const homePrice = sportsDisplayPrice(homeMarket, "yes") ?? 0;
  const awayPrice = sportsDisplayPrice(awayMarket, "yes") ?? 0;
  const homeColor = normalizeTeamColor(home.color);
  const awayColor = normalizeTeamColor(away.color);
  const swapped = home.ordering === "away";

  const moneylineOutcomes: SportsMoneylineOutcome[] = [
    side(home.name, 0, teams, homePrice, homeMarket, "home", parseClobTokenIds(homeMarket)[0], homeColor),
    ...(drawMarket ? [{ key: "draw", label: "Draw", abbrev: "DRAW", price: drawPrice!, market: drawMarket, tokenId: parseClobTokenIds(drawMarket)[0], logo: undefined }] : []),
    side(away.name, 1, teams, awayPrice, awayMarket, "away", parseClobTokenIds(awayMarket)[0], awayColor),
  ];

  return {
    teamA: home.name,
    teamB: away.name,
    abbrevA: teamAbbreviation(home.name, teams),
    abbrevB: teamAbbreviation(away.name, teams),
    logoA: teamLogoFor(home.name, 0, teams),
    logoB: teamLogoFor(away.name, 1, teams),
    colorA: homeColor,
    colorB: awayColor,
    recordA: home.record,
    recordB: away.record,
    scoreA: swapped ? awayScore : homeScore,
    scoreB: swapped ? homeScore : awayScore,
    setsA: swapped ? awaySets : homeSets,
    setsB: swapped ? homeSets : awaySets,
    live,
    ended,
    period,
    priceA: homePrice,
    priceB: awayPrice,
    drawPrice,
    drawMarket,
    moneylineOutcomes,
    startTime: homeMarket.gameStartTime ?? drawMarket?.gameStartTime ?? null,
  };
}

export function useSportsMatchup(event: Ref<Pick<GammaEvent, "markets" | "teams" | "score" | "period" | "live" | "ended"> | null | undefined>) {
  return computed(() => buildSportsMatchup(event.value));
}
