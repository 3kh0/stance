export default defineEventHandler(async (event) => {
  const rawUrl = getQuery(event).url;
  if (typeof rawUrl !== "string" || !rawUrl) throw createError({ statusCode: 400, statusMessage: "Missing url" });

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid url" });
  }

  const allowed = parsed.protocol === "https:" && (parsed.hostname === "lmt.fn.sportradar.com" || parsed.hostname.endsWith(".fn.sportradar.com"));
  if (!allowed) throw createError({ statusCode: 403, statusMessage: "Host not allowed" });

  const response = await fetch(parsed.toString(), {
    headers: { Referer: "https://polymarket.com/", Origin: "https://polymarket.com" },
  });
  setHeader(event, "content-type", response.headers.get("content-type") ?? "application/json");
  setHeader(event, "cache-control", "no-store");
  return response.body ?? (await response.text());
});
