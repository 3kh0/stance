import type { GammaEvent, GammaTag } from "~/types/gamma";
import { titleCase } from "~/utils/strings";

export interface LeagueMeta {
  slug: string;
  pathSlug?: string;
  label: string;
  icon: string;
  order: number;
}

const LEAGUE_REGISTRY: Record<string, LeagueMeta> = {
  fifwc: { slug: "fifwc", pathSlug: "world-cup", label: "World Cup", icon: "mdi:soccer", order: 0 },
  "fifa-world-cup": { slug: "fifa-world-cup", pathSlug: "world-cup", label: "World Cup", icon: "mdi:soccer", order: 0 },
  "world-cup": { slug: "world-cup", pathSlug: "world-cup", label: "World Cup", icon: "mdi:soccer", order: 0 },
  "2026-fifa-world-cup": { slug: "2026-fifa-world-cup", pathSlug: "world-cup", label: "World Cup", icon: "mdi:soccer", order: 0 },
  mlb: { slug: "mlb", label: "MLB", icon: "mdi:baseball", order: 1 },
  nhl: { slug: "nhl", label: "NHL", icon: "mdi:hockey-puck", order: 2 },
  nba: { slug: "nba", label: "NBA", icon: "mdi:basketball", order: 3 },
  wnba: { slug: "wnba", label: "WNBA", icon: "mdi:basketball", order: 4 },
  nfl: { slug: "nfl", label: "NFL", icon: "mdi:football", order: 5 },
  cfb: { slug: "cfb", label: "CFB", icon: "mdi:football", order: 6 },
  soccer: { slug: "soccer", label: "Soccer", icon: "mdi:soccer", order: 7 },
  epl: { slug: "epl", label: "EPL", icon: "mdi:soccer", order: 8 },
  mls: { slug: "mls", label: "MLS", icon: "mdi:soccer", order: 9 },
  ucl: { slug: "ucl", label: "Champions League", icon: "mdi:soccer", order: 10 },
  tennis: { slug: "tennis", label: "Tennis", icon: "mdi:tennis", order: 11 },
  atp: { slug: "atp", label: "ATP", icon: "mdi:tennis", order: 12 },
  wta: { slug: "wta", label: "WTA", icon: "mdi:tennis", order: 13 },
  ufc: { slug: "ufc", label: "UFC", icon: "mdi:mixed-martial-arts", order: 14 },
  boxing: { slug: "boxing", label: "Boxing", icon: "mdi:boxing-glove", order: 15 },
  cricket: { slug: "cricket", label: "Cricket", icon: "mdi:cricket", order: 16 },
  golf: { slug: "golf", label: "Golf", icon: "mdi:golf", order: 17 },
  f1: { slug: "f1", label: "Formula 1", icon: "mdi:racing-helmet", order: 18 },
  rugby: { slug: "rugby", label: "Rugby", icon: "mdi:rugby", order: 19 },
  chess: { slug: "chess", label: "Chess", icon: "mdi:chess-king", order: 20 },
  basketball: { slug: "basketball", label: "Basketball", icon: "mdi:basketball", order: 21 },
  bsn: { slug: "bsn", label: "BSN", icon: "mdi:basketball", order: 22 },
  bkbsn: { slug: "bkbsn", label: "BSN", icon: "mdi:basketball", order: 23 },
  baseball: { slug: "baseball", label: "Baseball", icon: "mdi:baseball", order: 24 },
  hockey: { slug: "hockey", label: "Hockey", icon: "mdi:hockey-puck", order: 25 },
  football: { slug: "football", label: "Football", icon: "mdi:football", order: 26 },
  "fantasy-football": { slug: "fantasy-football", label: "Fantasy Football", icon: "mdi:football", order: 27 },
  "table-tennis": { slug: "table-tennis", label: "Table Tennis", icon: "mdi:table-tennis", order: 28 },
  esports: { slug: "esports", pathSlug: "esports", label: "Esports", icon: "mdi:controller-classic", order: 29 },
  "counter-strike-2": { slug: "cs2", pathSlug: "cs2", label: "CS2", icon: "simple-icons:counterstrike", order: 30 },
  cs2: { slug: "cs2", pathSlug: "cs2", label: "CS2", icon: "simple-icons:counterstrike", order: 30 },
  "counter-strike": { slug: "cs2", pathSlug: "cs2", label: "CS2", icon: "simple-icons:counterstrike", order: 30 },
  csgo: { slug: "cs2", pathSlug: "cs2", label: "CS2", icon: "simple-icons:counterstrike", order: 30 },
  "league-of-legends": { slug: "lol", pathSlug: "lol", label: "LoL", icon: "simple-icons:leagueoflegends", order: 31 },
  lol: { slug: "lol", pathSlug: "lol", label: "LoL", icon: "simple-icons:leagueoflegends", order: 31 },
  "dota-2": { slug: "dota2", pathSlug: "dota2", label: "Dota 2", icon: "simple-icons:dota2", order: 32 },
  dota2: { slug: "dota2", pathSlug: "dota2", label: "Dota 2", icon: "simple-icons:dota2", order: 32 },
  valorant: { slug: "valorant", pathSlug: "valorant", label: "Valorant", icon: "simple-icons:valorant", order: 33 },
  "rainbow-six-siege": { slug: "rainbow-six", pathSlug: "rainbow-six", label: "Rainbow Six", icon: "simple-icons:ubisoft", order: 34 },
  "rainbow-six": { slug: "rainbow-six", pathSlug: "rainbow-six", label: "Rainbow Six", icon: "simple-icons:ubisoft", order: 34 },
  "honor-of-kings": { slug: "honor-of-kings", pathSlug: "honor-of-kings", label: "Honor of Kings", icon: "mdi:crown", order: 35 },
  "mobile-legends-bang-bang": { slug: "mobile-legends", pathSlug: "mobile-legends", label: "Mobile Legends", icon: "mdi:cellphone", order: 36 },
  "mobile-legends": { slug: "mobile-legends", pathSlug: "mobile-legends", label: "Mobile Legends", icon: "mdi:cellphone", order: 36 },
  overwatch: { slug: "overwatch", pathSlug: "overwatch", label: "Overwatch", icon: "lucide:gamepad-2", order: 37 },
  "overwatch-2": { slug: "overwatch", pathSlug: "overwatch", label: "Overwatch", icon: "lucide:gamepad-2", order: 37 },
  "call-of-duty": { slug: "cod", pathSlug: "cod", label: "Call of Duty", icon: "lucide:gamepad-2", order: 38 },
  cod: { slug: "cod", pathSlug: "cod", label: "Call of Duty", icon: "lucide:gamepad-2", order: 38 },
  "rocket-league": { slug: "rocket-league", pathSlug: "rocket-league", label: "Rocket League", icon: "lucide:gamepad-2", order: 39 },
};

export const leagueMeta = (slug: string | undefined | null): LeagueMeta | undefined => (slug ? LEAGUE_REGISTRY[slug.toLowerCase()] : undefined);
export const leagueIcon = (slug: string | undefined | null): string => leagueMeta(slug)?.icon ?? "mdi:trophy-outline";
export const leagueOrder = (slug: string | undefined | null): number => leagueMeta(slug)?.order ?? 900;
export function leaguePathSlug(slug: string | undefined | null): string {
  const n = slug?.toLowerCase();
  return (n && leagueMeta(n)?.pathSlug) || n || "other";
}

const SPORTS_FEED_TAG_ALIASES: Record<string, string> = {
  fifwc: "fifa-world-cup",
  "2026-fifa-world-cup": "fifa-world-cup",
  "world-cup": "fifa-world-cup",
};

export function sportsFeedTagSlug(slug: string | undefined | null): string {
  const k = normalizeLeagueKey(slug);
  return SPORTS_FEED_TAG_ALIASES[k] ?? k;
}

const ESPORTS_LEAGUE_TAGS = new Set([
  "esports",
  "e-sports",
  "counter-strike",
  "counter-strike-2",
  "cs2",
  "cs-go",
  "csgo",
  "dota-2",
  "dota2",
  "league-of-legends",
  "lol",
  "valorant",
  "overwatch",
  "overwatch-2",
  "rainbow-six",
  "rainbow-six-siege",
  "rocket-league",
  "call-of-duty",
  "cod",
  "honor-of-kings",
  "mobile-legends",
  "mobile-legends-bang-bang",
]);

export function normalizeLeagueKey(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

export function isEsportsLeagueSlug(value: string | undefined | null): boolean {
  return ESPORTS_LEAGUE_TAGS.has(normalizeLeagueKey(value));
}

export function isEsportsEvent(event: Pick<GammaEvent, "seriesSlug" | "tags"> & { sport?: { sport?: string } }): boolean {
  if (isEsportsLeagueSlug(event.seriesSlug) || isEsportsLeagueSlug(event.sport?.sport)) return true;
  return ((event.tags as GammaTag[] | undefined) ?? []).some((t) => isEsportsLeagueSlug(t.slug) || isEsportsLeagueSlug(t.label));
}

const GENERIC_LEAGUE_TAGS = new Set(["sports", "games", "all", "live", "futures"]);

export function isGenericSportsTag(value: string | undefined | null): boolean {
  return GENERIC_LEAGUE_TAGS.has(normalizeLeagueKey(value));
}

function leagueSpecificity(slug: string | undefined | null): number {
  const k = normalizeLeagueKey(slug);
  if (!k) return 0;
  if (k === "esports" || k === "e-sports") return 5;
  if (["soccer", "tennis", "basketball", "baseball", "hockey", "football"].includes(k)) return 10;
  if (["nfl", "cfb", "nba", "wnba", "mlb", "nhl", "ufc", "boxing", "cricket", "golf", "f1", "rugby", "chess"].includes(k)) return 50;
  return 100;
}

export function eventLeague(event: Pick<GammaEvent, "tags">): { slug: string; label: string } {
  const usable = ((event.tags as GammaTag[] | undefined) ?? []).filter((t) => t.slug && !isGenericSportsTag(t.slug));
  const known = usable.filter((t) => LEAGUE_REGISTRY[t.slug!.toLowerCase()]).sort((a, b) => leagueSpecificity(b.slug) - leagueSpecificity(a.slug) || leagueOrder(a.slug) - leagueOrder(b.slug))[0];
  if (known) {
    const m = LEAGUE_REGISTRY[known.slug!.toLowerCase()]!;
    return { slug: m.slug, label: m.label };
  }
  const f = usable[0];
  if (f?.slug) return { slug: f.slug, label: f.label || titleCase(f.slug) };
  return { slug: "other", label: "Other" };
}

const eventPath = (base: "sports" | "esports", event: Pick<GammaEvent, "id" | "slug" | "tags">, leagueSlug?: string) => `/${base}/${leaguePathSlug(leagueSlug ?? eventLeague(event).slug)}/${event.slug ?? event.id}`;

export const sportsEventUrl = (event: Pick<GammaEvent, "id" | "slug" | "tags">, leagueSlug?: string): string => eventPath("sports", event, leagueSlug);
export const esportsEventUrl = (event: Pick<GammaEvent, "id" | "slug" | "tags">, leagueSlug?: string): string => eventPath("esports", event, leagueSlug);
export const eventTournament = (event: Pick<GammaEvent, "eventMetadata">): string | null => event.eventMetadata?.league?.trim() || null;
