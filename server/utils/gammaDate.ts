export function parseGammaDate(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const ms = Date.parse(raw.replace(" ", "T").replace(/\+00$/, "Z"));
  return Number.isFinite(ms) ? ms : null;
}
