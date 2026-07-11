import type { GammaEvent } from "~/types/gamma";

export default defineEventHandler(async (event) => {
  const ids = String(getQuery(event).ids || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (!ids.length) return { events: [] as GammaEvent[], failedIds: [] as string[] };

  const results = await Promise.allSettled(ids.map((id) => proxyUpstream<GammaEvent>(GAMMA_BASE_URL, `/events/${encodeURIComponent(id)}`)));
  const events: GammaEvent[] = [];
  const failedIds: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value?.id) events.push(r.value);
    else failedIds.push(ids[i]!);
  });
  return { events, failedIds };
});
