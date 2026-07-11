import { isEsportsEvent } from "~/utils/sports";
import { buildFeedQuery, coerceFeedQuery, compareFeedEvents, eventList, fetchLiveMergedFeed } from "../utils/eventFeed";

export default defineEventHandler(async (event) => {
  const { view, limit, offset } = coerceFeedQuery(getQuery(event));

  if (view === "live") return enrichEsportsTeams(await fetchLiveMergedFeed({ tagSlug: "esports", include: isEsportsEvent, limit, offset }));

  const payload = await proxyUpstream(GAMMA_BASE_URL, "/events", buildFeedQuery({ view, limit, offset, tagSlug: "esports" }));
  return enrichEsportsTeams(eventList(payload).filter(isEsportsEvent).sort(compareFeedEvents));
});
