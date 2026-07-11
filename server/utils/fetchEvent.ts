import type { GammaEvent } from "~/types/gamma";
import { isGenericSportsTag, mergeSportsGameEvents, sportsFixtureKey } from "~/utils/sports";
import { eventList } from "./eventFeed";

const SIBLING_WINDOW_MS = 60_000;

export const fetchEventBySlug = (slug: string) => proxyUpstream<GammaEvent>(GAMMA_BASE_URL, `/events/slug/${encodeURIComponent(slug)}`);

function siblingTagId(event: GammaEvent): number | undefined {
  for (const t of event.tags ?? []) {
    const id = Number(t.id);
    if (Number.isFinite(id) && id > 0 && !isGenericSportsTag(t.slug)) return id;
  }
}

export async function fetchEventWithSportsSiblings(slug: string): Promise<GammaEvent> {
  const event = await fetchEventBySlug(slug);
  const key = sportsFixtureKey(event);
  const tagId = siblingTagId(event);
  const closeMs = parseGammaDate(event.endDate ?? event.startTime);
  if (!key || !tagId || closeMs === null) return event;

  try {
    const payload = await proxyUpstream<unknown>(GAMMA_BASE_URL, "/events", {
      tag_id: tagId,
      closed: false,
      limit: 100,
      end_date_min: new Date(closeMs - SIBLING_WINDOW_MS).toISOString(),
      end_date_max: new Date(closeMs + SIBLING_WINDOW_MS).toISOString(),
    });
    const byId = new Map<string, GammaEvent>([[String(event.id), event]]);
    for (const s of eventList(payload)) {
      const id = String(s.id);
      if (id !== String(event.id) && sportsFixtureKey(s) === key) byId.set(id, s);
    }
    return mergeSportsGameEvents([...byId.values()])[0] ?? event;
  } catch (err) {
    console.warn(`[sports] failed to fetch sibling markets for ${slug}`, err);
    return event;
  }
}
