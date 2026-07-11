import { Impit, type HttpMethod } from "impit";
import { buildUrl, type Query } from "./proxyGamma";

const DEFAULT_TIMEOUT_MS = 10_000;

let client: Impit | undefined;
const impit = () => (client ??= new Impit({ browser: "chrome" }));

export async function proxyImpit<T>(baseUrl: string, path: string, params?: Query, options: { timeoutMs?: number; method?: string; body?: string; headers?: Record<string, string> } = {}): Promise<T> {
  const url = buildUrl(baseUrl, path, params);
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await impit().fetch(url, { signal: c.signal, method: (options.method ?? "GET") as HttpMethod, body: options.body, headers: options.body === undefined ? options.headers : { "content-type": "application/json", ...options.headers } });
    if (!res.ok) {
      const d = await res.text().catch(() => "");
      console.error(`[impit] ${res.status} ${url} ${d.slice(0, 200)}`);
      throw createError({ statusCode: res.status, statusMessage: "Upstream request failed", data: { code: "gamma_upstream_error", url, detail: d.slice(0, 500) } });
    }
    return (await res.json()) as T;
    // oxlint-disable-next-line typescript/no-explicit-any
  } catch (err: any) {
    if (typeof err?.statusCode === "number") throw err;
    const status = err?.name === "AbortError" ? 504 : 502;
    console.error(`[impit] ${status} ${url}`, err?.message ?? err);
    throw createError({ statusCode: status, statusMessage: status === 504 ? "Upstream timeout" : "Upstream request failed", data: { code: "gamma_upstream_error", url } });
  } finally {
    clearTimeout(timer);
  }
}
