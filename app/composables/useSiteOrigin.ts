export function useSiteOrigin(): ComputedRef<string> {
  const config = useRuntimeConfig();
  let origin = "";
  if (import.meta.server)
    try {
      origin = useRequestURL().origin;
    } catch {}
  return computed(() => {
    if (config.public.siteUrl) return config.public.siteUrl.replace(/\/$/, "");
    if (origin) return origin;
    if (import.meta.client && typeof window !== "undefined") return window.location.origin;
    return "";
  });
}
