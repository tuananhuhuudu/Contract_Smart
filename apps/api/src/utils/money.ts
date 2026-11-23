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

/** a x b / c rounded half up, all in hundredths (non-negative values). */
const mulDiv = (a: bigint, b: bigint, c: bigint): bigint => (a * b + c / 2n) / c;

/** The money a percentage of `total` is worth: shareOf("1290", "40") -> "516.00". */
export function shareOf(total: string, percent: string): string {
  return fromHundredths(mulDiv(toHundredths(total), toHundredths(percent), 10000n));
}

/** What percentage of `total` an amount is: percentOf("516", "1290") -> "40.00". */
export function percentOf(amount: string, total: string): string {
  return fromHundredths(mulDiv(toHundredths(amount), 10000n, toHundredths(total)));
}

/** Sum of amounts, exactly. */
export function sumAmounts(amounts: readonly string[]): string {
  return sumPercents(amounts);
}

/**
 * Scales amounts that add up to `from` so they add up to `to`, keeping their proportions; the last
 * amount takes the rounding remainder. rescale(["300", "700"], "1000", "2000") -> ["600.00", "1400.00"]
 */
export function rescale(amounts: readonly string[], from: string, to: string): string[] {
  const oldTotal = toHundredths(from), newTotal = toHundredths(to);
  let allocated = 0n;
  return amounts.map((amount, index) => {
    if (index === amounts.length - 1) return fromHundredths(newTotal - allocated);
    const share = mulDiv(toHundredths(amount), newTotal, oldTotal);
    allocated += share;
    return fromHundredths(share);
  });
}
