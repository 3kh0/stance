const hasDec = (n: number) => Math.abs(n - Math.round(n)) > 0.001;
const loc = (n: number, max: number, min = 0) => (n || 0).toLocaleString("en-US", { minimumFractionDigits: min, maximumFractionDigits: max });

export const fmtc = (cents: number, forceDecimal = false): string => {
  if (cents === undefined || cents === null) return "0¢";
  const r = Math.round(cents * 10) / 10;
  return (forceDecimal || hasDec(r) ? r.toFixed(1) : r.toFixed(0)) + "¢";
};

export const fmtcp = (price: number, forceDecimal?: boolean): string => (price === undefined || price === null ? "0¢" : fmtc(price * 100, forceDecimal ?? hasDec(price * 100)));

export const fmtm = (amount: number): string => loc(amount, 2, 2);

export const fmtsp = (points: number): string => (points === 0 ? "0.0%" : `${points > 0 ? "+" : "−"}${Math.abs(points).toFixed(1)}%`);

export const fmtn = (num: number): string => loc(num, 0);

export const fmts = (value: number): string => loc(value, 2);

export const fmtcn = (num: number): string => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(num) || 0);

export function fmtv(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export const proba = (pct: number, neutral = "text-text"): string => (pct >= 55 ? "text-yes" : pct <= 45 ? "text-no" : neutral);

export const probb = (pct: number): string => (pct >= 50 ? "bg-yes" : "bg-no");

export const decimalcent = (levels: Array<{ price: number }>): boolean => levels.some((l) => hasDec(Math.round(l.price * 1000) / 10));

export const fmtClob = (price: number, decimalBook: boolean): string => (price === undefined || price === null ? "0¢" : fmtc(price * 100, decimalBook));
