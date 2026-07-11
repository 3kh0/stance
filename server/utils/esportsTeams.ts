import type { EventTeam, GammaEvent } from "~/types/gamma";
import { isEsportsEvent, parseMarketOutcomes } from "~/utils/sports";

interface GammaTeam {
  id?: number;
  name?: string;
  abbreviation?: string;
  logo?: string;
  color?: string;
  record?: string;
  league?: string;
}

const cache = new Map<string, { team: GammaTeam | null; expires: number }>();
const hasArt = (t: GammaTeam) => Boolean(t.color) || /team_logos/.test(t.logo ?? "");

function moneylineNames(event: GammaEvent): string[] {
  for (const m of event.markets ?? []) {
    if (m.sportsMarketType !== "moneyline") continue;
    const [a, b] = parseMarketOutcomes(m);
    if (a.toLowerCase() === "yes" && b.toLowerCase() === "no") continue;
    return [a, b];
  }
  return [];
}

async function fetchTeamRecords(names: string[]): Promise<Map<string, GammaTeam>> {
  const now = Date.now();
  const result = new Map<string, GammaTeam>();
  const missing: string[] = [];
  for (const name of names) {
    const c = cache.get(name.toLowerCase());
    if (c && c.expires > now) {
      if (c.team) result.set(name.toLowerCase(), c.team);
    } else missing.push(name);
  }

  for (let i = 0; i < missing.length; i += 40) {
    const chunk = missing.slice(i, i + 40);
    let teams: GammaTeam[] = [];
    try {
      teams = await proxyUpstream<GammaTeam[]>(GAMMA_BASE_URL, "/teams", { name: chunk, limit: 100 });
    } catch {
      teams = [];
    }
    for (const t of Array.isArray(teams) ? teams : []) {
      if (!t?.name) continue;
      const key = t.name.toLowerCase();
      const e = result.get(key);
      if (!e || (!hasArt(e) && hasArt(t))) result.set(key, t);
    }
    for (const name of chunk) cache.set(name.toLowerCase(), { team: result.get(name.toLowerCase()) ?? null, expires: now + 6 * 3_600_000 });
  }
  return result;
}

const toEventTeam = (name: string, i: number, r: GammaTeam | undefined): EventTeam => ({
  id: r?.id,
  name,
  abbreviation: r?.abbreviation,
  logo: /team_logos/.test(r?.logo ?? "") ? r!.logo : undefined,
  color: r?.color,
  record: r?.record && !/^0-0$/.test(r.record) ? r.record : undefined,
  league: r?.league,
  ordering: i === 0 ? "home" : "away",
});

export async function enrichEsportsTeams(events: GammaEvent[]): Promise<GammaEvent[]> {
  const targets = events
    .filter((e) => isEsportsEvent(e) && (e.teams?.length ?? 0) < 2)
    .map((e) => ({ e, names: moneylineNames(e).slice(0, 2) }))
    .filter((t) => t.names.length >= 2);
  if (!targets.length) return events;
  const records = await fetchTeamRecords([...new Set(targets.flatMap((t) => t.names))]);
  for (const { e, names } of targets) e.teams = names.map((name, i) => toEventTeam(name, i, records.get(name.toLowerCase())));
  return events;
}

export async function enrichEsportsTeamsForEvent(event: GammaEvent): Promise<GammaEvent> {
  await enrichEsportsTeams([event]);
  return event;
}
