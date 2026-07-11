const ALLOWED_PATHS = new Set(["nonce", "relay-payload", "submit", "transaction", "transactions", "deployed"]);

export default defineEventHandler(async (event) => {
  const path = (getRouterParam(event, "path") || "").replace(/^\/+/, "").split("/")[0];
  if (!path || !ALLOWED_PATHS.has(path)) throw createError({ statusCode: 400, statusMessage: "Unknown relayer path" });

  const method = event.method.toUpperCase();
  const query = getQuery(event) as Record<string, string | string[] | undefined>;
  const raw = method === "GET" || method === "DELETE" ? undefined : await readRawBody(event);
  const body = raw === undefined || raw === null ? undefined : raw.toString();

  return await proxyImpit(RELAYER_BASE_URL, `/${path}`, query, { method, body });
});
