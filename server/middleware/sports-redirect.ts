import { esportsEventUrl, isEsportsEvent, isSportsEvent, sportsEventUrl } from "~/utils/sports";

const EVENT_PATH = /^\/event\/([^/]+)\/?$/;

export default defineEventHandler(async (event) => {
  if (event.method !== "GET") return;
  const match = EVENT_PATH.exec(getRequestURL(event).pathname);
  if (!match) return;

  let data;
  try {
    data = await fetchEventBySlug(decodeURIComponent(match[1]!));
  } catch {
    return;
  }

  if (isEsportsEvent(data)) return sendRedirect(event, esportsEventUrl(data), 301);
  if (isSportsEvent(data)) return sendRedirect(event, sportsEventUrl(data), 301);
});
