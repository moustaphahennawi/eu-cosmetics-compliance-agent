/**
 * String normalisation utilities used across the rule engine.
 *
 * All functions are pure: same input always yields the same output,
 * no external dependencies, no side effects.
 */

/**
 * Normalise a substance name for comparison:
 * - lowercase
 * - collapse whitespace
 * - strip trailing footnote markers like "(1)", "(2)", "(INN)", "(USAN)"
 * - remove soft hyphens (U+00AD) introduced by PDF hyphenation
 */
export function normalizeName(s: string): string {
  return s
    .replace(/\u00AD/g, '')           // soft hyphen from PDF
    .replace(/\s*\(\d+\)\s*/g, ' ')   // footnote markers (1), (2)…
    .replace(/\s*\(INN\)\s*/g, ' ')
    .replace(/\s*\(USAN[^)]*\)\s*/g, ' ')
    .replace(/\s*\(BAN\)\s*/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalise a CAS number:
 * - strip surrounding whitespace
 * - collapse runs of dashes (sometimes "- -" appears in PDF extracts)
 */
export function normalizeCAS(cas: string): string {
  return cas.trim().replace(/\s*-\s*/g, '-');
}

/**
 * Tokenise a normalised name into meaningful words (≥ 3 chars).
 * Used for partial-match scoring.
 */
export function tokenize(name: string): string[] {
  return normalizeName(name)
    .split(/[\s,;()/[\]]+/)
    .filter(t => t.length >= 3);
}

