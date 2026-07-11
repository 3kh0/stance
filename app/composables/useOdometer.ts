import { computed, type MaybeRefOrGetter, toValue } from "vue";

export interface OdometerColumn {
  char: string;
  isDigit: boolean;
  val: number;
  key: string;
}

export interface OdometerOptions {
  prefix?: string;
  suffix?: string;
  decimals?: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  locale?: string;
  format?: (value: number) => string;
}

export function useOdometer(value: MaybeRefOrGetter<number>, options: OdometerOptions = {}) {
  const formattedValue = computed(() => {
    const raw = Number(toValue(value));
    const n = Number.isFinite(raw) ? raw : 0;
    if (options.format) return options.format(n);
    const num = Math.abs(n).toLocaleString(options.locale ?? "en-US", {
      minimumFractionDigits: options.minimumFractionDigits ?? options.decimals ?? 0,
      maximumFractionDigits: options.maximumFractionDigits ?? options.decimals ?? 0,
    });
    return `${n < 0 ? "-" : ""}${options.prefix ?? ""}${num}${options.suffix ?? ""}`;
  });

  const columns = computed<OdometerColumn[]>(() => {
    const str = formattedValue.value;
    const signLen = str.startsWith("-") ? 1 : 0;
    const prefixLen = (options.prefix ?? "").length;
    const suffixLen = (options.suffix ?? "").length;
    const numericStart = signLen + prefixLen;
    const numStr = suffixLen > 0 ? str.slice(numericStart, -suffixLen) : str.slice(numericStart);
    const dotPos = numStr.indexOf(".");
    const intDigitCount = ((dotPos >= 0 ? numStr.slice(0, dotPos) : numStr).match(/[0-9]/g) ?? []).length;

    const result: OdometerColumn[] = [];
    let intDigitIdx = 0;
    let fracDigitIdx = 0;
    let inFrac = false;
    let preIdx = 0;
    let sufIdx = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str[i]!;
      const isDigit = char >= "0" && char <= "9";
      let key: string;
      if (i < signLen) key = "sign";
      else if (i >= signLen && i < signLen + prefixLen) key = `p${preIdx++}`;
      else if (suffixLen > 0 && i >= str.length - suffixLen) key = `x${sufIdx++}`;
      else if (char === ".") {
        inFrac = true;
        key = "dot";
      } else if (isDigit) key = inFrac ? `f${fracDigitIdx++}` : `d${intDigitCount - 1 - intDigitIdx++}`;
      else key = `c${intDigitCount - 1 - intDigitIdx}`;

      result.push({ char, isDigit, val: isDigit ? Number.parseInt(char, 10) : 0, key });
    }

    return result;
  });

  return { ariaLabel: formattedValue, columns, formattedValue };
}
