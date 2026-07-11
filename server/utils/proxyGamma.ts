const DEFAULT_TIMEOUT_MS = 10_000;

type QueryValue = string | number | boolean | undefined | null;
export type Query = Record<string, QueryValue | QueryValue[]>;
type Bounds = { min?: number; max?: number };

export function buildUrl(baseUrl: string, path: string, params?: Query): string {
  const url = path.startsWith("http") ? new URL(path) : new URL(path, baseUrl);
  for (const [k, v] of Object.entries(params ?? {})) for (const i of Array.isArray(v) ? v : [v]) if (i != null) url.searchParams.append(k, String(i));
  return url.toString();
}

export async function proxyUpstream<T>(baseUrl: string, path: string, params?: Query, options: { timeoutMs?: number } = {}): Promise<T> {
  const url = buildUrl(baseUrl, path, params);
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    return (await $fetch<T>(url, { signal: c.signal })) as T;
    // oxlint-disable-next-line typescript/no-explicit-any
  } catch (err: any) {
    const status = typeof err?.statusCode === "number" ? err.statusCode : typeof err?.response?.status === "number" ? err.response.status : err?.name === "AbortError" ? 504 : 502;
    console.error(`[proxy] ${status} ${url}`, err?.message ?? err);
    throw createError({ statusCode: status, statusMessage: status === 504 ? "Upstream timeout" : "Upstream request failed", data: { code: "gamma_upstream_error", url } });
  } finally {
    clearTimeout(timer);
  }
}

export const GAMMA_BASE_URL = "https://gamma-api.polymarket.com";
export const CLOB_BASE_URL = "https://clob.polymarket.com";
export const POLYMARKET_BASE_URL = "https://polymarket.com";
export const DATA_API_BASE_URL = "https://data-api.polymarket.com";
export const BRIDGE_BASE_URL = "https://bridge.polymarket.com";
export const RELAYER_BASE_URL = "https://relayer-v2.polymarket.com";

const str = (v: unknown) => (v == null || v === "" ? undefined : String(v));

export function coerceAddress(value: unknown): string | undefined {
  const s = str(value);
  return s && /^0x[a-fA-F0-9]{40}$/.test(s) ? s.toLowerCase() : undefined;
}

export function coerceChainId(value: unknown): string | undefined {
  const s = str(value);
  return s && /^\d{1,7}$/.test(s) ? s : undefined;
}

export function coercePositiveInt(value: unknown, { min = 0, max = 500 }: Bounds = {}): number | undefined {
  const s = str(value);
  const n = s == null ? NaN : Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

export function coerceEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  const s = str(value);
  return allowed.includes(s as T) ? (s as T) : undefined;
}

export function coerceSlug(value: unknown): string | undefined {
  const s = str(value)?.trim().toLowerCase();
  return s && /^[a-z0-9-]{1,80}$/.test(s) ? s : undefined;
}

export function requireAddress(value: unknown, statusMessage = "user must be a valid address"): string {
  const a = coerceAddress(value);
  if (!a) throw createError({ statusCode: 400, statusMessage });
  return a;
}

export function requireChainId(value: unknown, statusMessage = "Invalid destination chain id"): string {
  const c = coerceChainId(value);
  if (!c) throw createError({ statusCode: 400, statusMessage });
  return c;
}

export function requireDigits(value: unknown, statusMessage = "Invalid amount"): string {
  const s = str(value);
  if (!s || !/^\d{1,30}$/.test(s)) throw createError({ statusCode: 400, statusMessage });
  return s;
}
