/**
 * Money and percentages as exact decimals (VND million with 2 decimals). Values arrive as strings
 * ("1290", "516.00", "0.10") and are computed in integer hundredths, never floating point.
 */

const DECIMAL = /^(\d+)(?:\.(\d{1,2}))?$/;

/** "516.5" -> 51650n (hundredths). Throws on anything that is not a non-negative decimal. */
export function toHundredths(value: string): bigint {
  const match = DECIMAL.exec(value.trim());
  if (!match) throw new Error(`Not a decimal with at most 2 places: ${value}`);
  const [, whole = "0", fraction = ""] = match;
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

/** 51650n -> "516.50". */
export function fromHundredths(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

/**
 * Splits `total` by percentages, rounding each share half up to the hundredth; the last share takes
 * the remainder, so the shares always add up to exactly `total`.
 * splitByPercent("1290", ["20", "40", "30", "10"]) -> ["258.00", "516.00", "387.00", "129.00"]
 */
export function splitByPercent(total: string, percents: readonly string[]): string[] {
  const whole = toHundredths(total);
  let allocated = 0n;
  return percents.map((percent, index) => {
    if (index === percents.length - 1) return fromHundredths(whole - allocated);
    // whole (hundredths) x percent (hundredths) / 10000, rounded half up.
    const share = (whole * toHundredths(percent) + 5000n) / 10000n;
    allocated += share;
    return fromHundredths(share);
  });
}

/** Sum of percentages, exactly ("20" + "40.5" -> "60.50"). */
export function sumPercents(percents: readonly string[]): string {
  return fromHundredths(percents.reduce((sum, p) => sum + toHundredths(p), 0n));
}
