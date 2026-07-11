import { isEsportsEvent, sportsFeedTagSlug } from "~/utils/sports";
import { buildFeedQuery, coerceFeedQuery, fetchLiveMergedFeed, filterFeedPayload } from "../utils/eventFeed";

export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const { view, limit, offset } = coerceFeedQuery(q);
  const requested = coerceSlug(q.tag_slug);
  const tagSlug = requested ? sportsFeedTagSlug(requested) : "sports";
  const include = (ev: Parameters<typeof isEsportsEvent>[0]) => !isEsportsEvent(ev);

  if (view === "live") return fetchLiveMergedFeed({ tagSlug, include, limit, offset });
  return filterFeedPayload(await proxyUpstream(GAMMA_BASE_URL, "/events", buildFeedQuery({ view, limit, offset, tagSlug })), include);
});
