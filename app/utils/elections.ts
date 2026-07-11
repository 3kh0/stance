import type { GammaTag, MarketFeedEvent } from "~/types/gamma";

export const GLOBAL_BUCKET = "GLOBAL";

export interface ElectionCountry {
  iso: string;
  name: string;
  tagSlugs: string[];
  keywords: RegExp;
}

export const ELECTION_COUNTRIES: ElectionCountry[] = [
  { iso: "USA", name: "United States", tagSlugs: ["us-elections", "us-election", "elections-us", "2024-election", "us-politics"], keywords: /\b(?:u\.?s\.?a?|united states|america[n]?|trump|biden|harris|kamala|white house|electoral college|los angeles)\b/i },
  { iso: "GBR", name: "United Kingdom", tagSlugs: ["uk-elections", "uk-election", "uk-politics", "british-politics"], keywords: /\b(?:u\.?k\.?|united kingdom|britain|british|england|scotland|wales|westminster|downing street|labour|tory|tories|starmer|sunak|by-election)\b/i },
  { iso: "CAN", name: "Canada", tagSlugs: ["canada", "canadian-politics", "canada-elections"], keywords: /\b(?:canada|canadian|trudeau|poilievre|ottawa)\b/i },
  { iso: "FRA", name: "France", tagSlugs: ["france", "french-election", "french-politics"], keywords: /\b(?:france|french|macron|le pen|élysée|elysee|paris election)\b/i },
  { iso: "DEU", name: "Germany", tagSlugs: ["germany", "german-election", "german-politics"], keywords: /\b(?:germany|german|bundestag|scholz|merz|afd|chancellor)\b/i },
  { iso: "VEN", name: "Venezuela", tagSlugs: ["venezuela", "venezuela-election"], keywords: /\b(?:venezuela[n]?|maduro|caracas)\b/i },
  { iso: "ARG", name: "Argentina", tagSlugs: ["argentina", "argentina-election"], keywords: /\b(?:argentina|argentine|milei|buenos aires)\b/i },
  { iso: "BRA", name: "Brazil", tagSlugs: ["brazil", "brazil-election"], keywords: /\b(?:brazil|brazilian|lula|bolsonaro|brasília|brasilia)\b/i },
  { iso: "MEX", name: "Mexico", tagSlugs: ["mexico", "mexico-election"], keywords: /\b(?:mexico|mexican|sheinbaum|amlo)\b/i },
  { iso: "IND", name: "India", tagSlugs: ["india", "india-election", "indian-politics"], keywords: /\b(?:india[n]?|modi|lok sabha|new delhi|bjp)\b/i },
  { iso: "POL", name: "Poland", tagSlugs: ["poland", "poland-election"], keywords: /\b(?:poland|polish|tusk|warsaw)\b/i },
  { iso: "ROU", name: "Romania", tagSlugs: ["romania", "romania-election"], keywords: /\b(?:romania[n]?|bucharest)\b/i },
  { iso: "IRL", name: "Ireland", tagSlugs: ["ireland", "ireland-election"], keywords: /\b(?:ireland|irish|dublin|dáil|dail)\b/i },
  { iso: "NLD", name: "Netherlands", tagSlugs: ["netherlands", "dutch-election"], keywords: /\b(?:netherlands|dutch|wilders|amsterdam|the hague)\b/i },
  { iso: "AUS", name: "Australia", tagSlugs: ["australia", "australia-election"], keywords: /\b(?:australia[n]?|albanese|canberra)\b/i },
  { iso: "JPN", name: "Japan", tagSlugs: ["japan", "japan-election"], keywords: /\b(?:japan(?:ese)?|tokyo|diet election|ishiba|kishida)\b/i },
  { iso: "KOR", name: "South Korea", tagSlugs: ["south-korea", "korea-election"], keywords: /\b(?:south korea[n]?|seoul|yoon)\b/i },
  { iso: "ISR", name: "Israel", tagSlugs: ["israel", "israel-election"], keywords: /\b(?:israel[i]?|netanyahu|knesset|jerusalem)\b/i },
  { iso: "IRN", name: "Iran", tagSlugs: ["iran", "iran-election"], keywords: /\b(?:iran(?:ian)?|tehran|khamenei|pezeshkian)\b/i },
  { iso: "RUS", name: "Russia", tagSlugs: ["russia", "russia-election"], keywords: /\b(?:russia[n]?|putin|kremlin|moscow)\b/i },
  { iso: "UKR", name: "Ukraine", tagSlugs: ["ukraine", "ukraine-election"], keywords: /\b(?:ukraine|ukrainian|zelensky|kyiv|kiev)\b/i },
  { iso: "ITA", name: "Italy", tagSlugs: ["italy", "italy-election"], keywords: /\b(?:italy|italian|meloni|rome)\b/i },
  { iso: "ESP", name: "Spain", tagSlugs: ["spain", "spain-election"], keywords: /\b(?:spain|spanish|sanchez|sánchez|madrid election)\b/i },
  { iso: "TUR", name: "Turkey", tagSlugs: ["turkey", "turkey-election"], keywords: /\b(?:turkey|turkish|erdogan|erdoğan|ankara)\b/i },
  { iso: "TWN", name: "Taiwan", tagSlugs: ["taiwan", "taiwan-election"], keywords: /\b(?:taiwan(?:ese)?|taipei)\b/i },
  { iso: "PER", name: "Peru", tagSlugs: ["peru", "peru-election"], keywords: /\b(?:peru(?:vian)?|castillo|lima)\b/i },
  { iso: "COL", name: "Colombia", tagSlugs: ["colombia", "colombia-election"], keywords: /\b(?:colombia[n]?|bogotá|bogota|petro)\b/i },
  { iso: "NZL", name: "New Zealand", tagSlugs: ["new-zealand", "nz-election"], keywords: /\b(?:new zealand|\bnz\b|wellington)\b/i },
  { iso: "SWE", name: "Sweden", tagSlugs: ["sweden", "sweden-election"], keywords: /\b(?:sweden|swedish|stockholm)\b/i },
  { iso: "ZAF", name: "South Africa", tagSlugs: ["south-africa", "south-africa-election"], keywords: /\b(?:south africa[n]?|johannesburg|cape town|pretoria)\b/i },
  { iso: "ETH", name: "Ethiopia", tagSlugs: ["ethiopia", "ethiopia-election"], keywords: /\b(?:ethiopia[n]?|addis ababa)\b/i },
  { iso: "LVA", name: "Latvia", tagSlugs: ["latvia", "latvia-election"], keywords: /\b(?:latvia[n]?|riga)\b/i },
  { iso: "THA", name: "Thailand", tagSlugs: ["thailand", "thailand-election"], keywords: /\b(?:thai(?:land)?|bangkok)\b/i },
];

const ISO_TO_COUNTRY = new Map(ELECTION_COUNTRIES.map((c) => [c.iso, c]));

const TAG_SLUG_TO_ISO = new Map<string, string>(ELECTION_COUNTRIES.flatMap((c) => c.tagSlugs.map((slug) => [slug, c.iso] as [string, string])));

export const numericToIso3: Record<string, string> = {
  "840": "USA",
  "826": "GBR",
  "124": "CAN",
  "250": "FRA",
  "276": "DEU",
  "862": "VEN",
  "032": "ARG",
  "076": "BRA",
  "484": "MEX",
  "356": "IND",
  "616": "POL",
  "642": "ROU",
  "372": "IRL",
  "528": "NLD",
  "036": "AUS",
  "392": "JPN",
  "410": "KOR",
  "376": "ISR",
  "364": "IRN",
  "643": "RUS",
  "804": "UKR",
  "380": "ITA",
  "724": "ESP",
  "792": "TUR",
  "158": "TWN",
  "604": "PER",
  "170": "COL",
  "554": "NZL",
  "752": "SWE",
  "710": "ZAF",
  "231": "ETH",
  "428": "LVA",
  "764": "THA",
};

export const isoToCountry = (iso: string): ElectionCountry | undefined => ISO_TO_COUNTRY.get(iso);

export const countryName = (iso: string): string => (iso === GLOBAL_BUCKET ? "Global" : (ISO_TO_COUNTRY.get(iso)?.name ?? iso));

const US_STATES =
  /\b(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|washington dc|d\.c\.)\b/i;
const US_OFFICES = /\b(?:governor|senate|senator|house (?:election|popular|seat)|congress(?:ional)?|gubernatorial|presidential primary|gop|democratic primary|republican primary|midterm)\b/i;
const US_DISTRICT = /\b[a-z]{2}-\d{1,2}\b|\bdc\b|d\.c\.|district of columbia/i;

const eventTags = (event: MarketFeedEvent): GammaTag[] => (event.tags as GammaTag[] | undefined) ?? [];

const eventText = (event: MarketFeedEvent): string => `${event.title ?? ""} ${event.slug ?? ""}`.toLowerCase();

export function isUsElection(event: MarketFeedEvent): boolean {
  const t = eventText(event);
  return !!ISO_TO_COUNTRY.get("USA")?.keywords.test(t) || US_STATES.test(t) || US_OFFICES.test(t) || US_DISTRICT.test(t);
}

export function classifyCountry(event: MarketFeedEvent): string {
  for (const tag of eventTags(event)) {
    const slug = tag.slug?.toLowerCase();
    if (slug && TAG_SLUG_TO_ISO.has(slug)) return TAG_SLUG_TO_ISO.get(slug)!;
    const label = tag.label?.toLowerCase();
    if (label) {
      const hit = ELECTION_COUNTRIES.find((c) => c.tagSlugs.includes(label) || label === c.name.toLowerCase());
      if (hit) return hit.iso;
    }
  }
  const text = eventText(event);
  for (const c of ELECTION_COUNTRIES) if (c.iso !== "USA" && c.keywords.test(text)) return c.iso;
  return isUsElection(event) ? "USA" : GLOBAL_BUCKET;
}
