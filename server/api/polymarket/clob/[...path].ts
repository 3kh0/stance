const PREFIXES = ["poly_", "poly-"];
const HEADERS = new Set(["content-type", "accept"]);

function pickForwardHeaders(headers: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [raw, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    const key = raw.toLowerCase();
    if (HEADERS.has(key) || PREFIXES.some((p) => key.startsWith(p))) out[raw] = value;
  }
  return out;
}

export default defineEventHandler(async (event) => {
  const path = (getRouterParam(event, "path") || "").replace(/^\/+/, "");
  if (!path) throw createError({ statusCode: 400, statusMessage: "Missing CLOB path" });

  const method = event.method.toUpperCase();
  const url = new URL(`https://clob.polymarket.com/${path}`);
  for (const [k, v] of Object.entries(getQuery(event))) {
    if (v != null) url.searchParams.append(k, String(v));
  }

  const headers = pickForwardHeaders(getHeaders(event));
  const body = method === "GET" || method === "DELETE" ? undefined : await readRawBody(event);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const upstream = await fetch(url.toString(), { method, headers, body, signal: controller.signal });
    setResponseStatus(event, upstream.status);
    setResponseHeader(event, "content-type", upstream.headers.get("content-type") || "application/json");
    return await upstream.text();
  } catch (err) {
    console.error(`[clob-relay] ${method} ${url.pathname}`, err);
    const aborted = (err as { name?: string })?.name === "AbortError";
    throw createError({ statusCode: aborted ? 504 : 502, statusMessage: aborted ? "CLOB upstream timeout" : "CLOB relay failed" });
  } finally {
    clearTimeout(timer);
  }
});
