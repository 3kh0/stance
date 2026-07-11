export default defineEventHandler(async (event) => {
  const url = getQuery(event).url;
  if (typeof url !== "string" || !url) throw createError({ statusCode: 400, statusMessage: "Missing url" });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid url" });
  }

  const allowed = parsed.protocol === "https:" && /(^|\.)polymarket[\w-]*\.(com|s3[\w.-]*\.amazonaws\.com)$/.test(parsed.hostname);
  if (!allowed && !/polymarket-upload\.s3[\w.-]*\.amazonaws\.com$/.test(parsed.hostname)) throw createError({ statusCode: 403, statusMessage: "Host not allowed" });

  const upstream = await fetch(parsed.toString());
  if (!upstream.ok || !upstream.body) throw createError({ statusCode: 502, statusMessage: "Upstream fetch failed" });

  const contentType = upstream.headers.get("content-type") ?? "image/png";
  if (!contentType.startsWith("image/")) throw createError({ statusCode: 415, statusMessage: "Not an image" });

  setHeader(event, "content-type", contentType);
  setHeader(event, "cache-control", "public, max-age=86400");
  return upstream.body;
});
