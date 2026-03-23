/**
 * Concentration parsing utilities.
 *
 * Regulation concentration strings use European decimal notation (comma)
 * and may carry qualifiers: "5 %", "0,5 % (acid)", "10 % (as acid)",
 * "1,7 % (acid) / 0,5 % (acid)", "0,1 % (free formaldehyde)".
 *
 * All functions are pure.
 */

/** Regex: captures one decimal number immediately before a "%" sign. */
const CONC_NUM_RE = /(\d+[,.]?\d*)\s*%/g;

/**
 * Parse all numeric concentration values from a raw regulation string.
 *
 * @example
 * parseAllConcentrations("2,5 % (acid) / 1,7 % (acid) / 0,5 % (acid)")
 * // → [2.5, 1.7, 0.5]
 */
export function parseAllConcentrations(raw: string): number[] {
  const results: number[] = [];
  CONC_NUM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CONC_NUM_RE.exec(raw)) !== null) {
    const n = parseFloat(m[1].replace(',', '.'));
    if (!isNaN(n)) results.push(n);
  }
  return results;
}

/**
 * Return the most restrictive (minimum) concentration from a raw string.
 * Used when no product-type match can narrow down which limit applies.
 *
 * Returns `undefined` if no numeric value is found.
 */
export function parseMinConcentration(raw: string): number | undefined {
  const all = parseAllConcentrations(raw);
  return all.length > 0 ? Math.min(...all) : undefined;
}

/**
 * Return the most permissive (maximum) concentration from a raw string.
 * Used to answer "what is the highest allowed limit?".
 */
export function parseMaxConcentration(raw: string): number | undefined {
  const all = parseAllConcentrations(raw);
  return all.length > 0 ? Math.max(...all) : undefined;
}

/**
 * Compare a queried concentration against a regulation limit string.
 *
 * Returns:
 *   'within'  — queried ≤ most permissive limit
 *   'exceeds' — queried > all limits
 *   'unknown' — no numeric limit found in the regulation string
 */
export function compareConcentration(
  queried: number,
  regulationRaw: string,
): 'within' | 'exceeds' | 'unknown' {
  const max = parseMaxConcentration(regulationRaw);
  if (max === undefined) return 'unknown';
  return queried <= max ? 'within' : 'exceeds';
}
