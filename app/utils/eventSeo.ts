import type { GammaEvent, GammaMarket } from "~/types/gamma";
import { HIDDEN_TAG_REGEX } from "~/utils/constants";
import { chancePct, parseOutcomePrices } from "~/utils/markets";
import { parseMarketOutcomes } from "~/utils/sports";

export interface EventOddsLine {
  label: string;
  yesPct: number;
  yesCents: number;
  noCents: number;
  yesLabel: string;
  noLabel: string;
}

export const getActiveMarkets = (event: GammaEvent): GammaMarket[] => (event.markets ?? []).filter((m) => !m.closed && m.active !== false).sort((a, b) => parseOutcomePrices(b).yes - parseOutcomePrices(a).yes);

export const getResolvedMarkets = (event: GammaEvent): GammaMarket[] => (event.markets ?? []).filter((m) => m.closed);

export const isEventResolved = (event: GammaEvent): boolean => getActiveMarkets(event).length === 0 && getResolvedMarkets(event).length > 0;

export function buildEventOddsLines(event: GammaEvent, limit = 3): EventOddsLine[] {
  return getActiveMarkets(event)
    .slice(0, limit)
    .map((m) => {
      const p = parseOutcomePrices(m);
      const [yesLabel, noLabel] = parseMarketOutcomes(m);
      return { label: m.groupItemTitle || m.question || event.title, yesPct: chancePct(m), yesCents: Math.round(p.yes * 100), noCents: Math.round(p.no * 100), yesLabel, noLabel };
    });
}

export const buildEventTags = (event: GammaEvent): string[] =>
  (event.tags ?? [])
    .map((t) => t.label)
    .filter((label): label is string => Boolean(label) && !HIDDEN_TAG_REGEX.test(label))
    .slice(0, 3);

export function buildEventDescription(event: GammaEvent): string {
  const active = getActiveMarkets(event);
  if (!active.length) return `${event.title} — ${isEventResolved(event) ? "Resolved. " : ""}Paper trade prediction markets on Stance.`;
  if (active.length === 1) {
    const l = buildEventOddsLines(event, 1)[0]!;
    return `${l.yesPct}% ${l.yesLabel} · ${l.noCents}¢ ${l.noLabel} — Paper trade on Stance`;
  }
  const odds = buildEventOddsLines(event, 3)
    .map((l) => `${truncateLabel(l.label, 36)}: ${l.yesPct}%`)
    .join(" · ");
  return `${odds} — Paper trade on Stance`;
}

export const buildEventTitle = (event: GammaEvent): string => `${event.title} · Stance`;

export function truncateLabel(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function wrapOgTitle(title: string, maxCharsPerLine = 42, maxLines = 2): string[] {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxCharsPerLine) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length >= maxLines - 1) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = truncateLabel(lines[maxLines - 1]!, maxCharsPerLine);
  return lines.slice(0, maxLines);
}
