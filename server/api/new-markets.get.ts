export default defineEventHandler(async (event) => {
  return await proxyUpstream<{ events: unknown[]; next_cursor: string }>(GAMMA_BASE_URL, "/events/keyset", {
    limit: 20,
    closed: false,
    order: "startDate",
    ascending: false,
    cursor: getQuery(event).cursor?.toString() || undefined,
    exclude_tag_id: ["100639", "102169"],
  });
});
