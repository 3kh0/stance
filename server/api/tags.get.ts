export default defineEventHandler(() => proxyImpit(POLYMARKET_BASE_URL, "/api/tags/filteredBySlug", { tag: "all", status: "active" }));
