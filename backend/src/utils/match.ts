/**
 * Matching utilities for resolving an ingredient query against rule names.
 *
 * Matching strategies (in priority order):
 *   1. cas       — exact CAS number match (most reliable)
 *   2. inci      — exact INCI / Common Ingredients Glossary name match
 *   3. name-exact — normalised full name equality
 *   4. name-partial — sufficient token overlap between query and rule name
 *
 * All functions are pure.
 */

import { normalizeCAS, normalizeName, tokenize } from './normalize.js';

/** Minimum fraction of query tokens that must appear in the rule name. */
const PARTIAL_MATCH_THRESHOLD = 0.6;

/** Return true if `queryCAS` matches any CAS in the rule's list. */
export function matchesCASList(queryCAS: string, ruleCASNumbers: string[]): boolean {
  const q = normalizeCAS(queryCAS);
  return ruleCASNumbers.some(c => normalizeCAS(c) === q);
}

/**
 * Return true if `queryName` matches the rule's INCI name exactly
 * (case-insensitive, after normalisation).
 */
export function matchesINCI(queryName: string, ruleINCI: string | undefined): boolean {
  if (!ruleINCI) return false;
  return normalizeName(queryName) === normalizeName(ruleINCI);
}

/**
 * Return true if `queryName` matches any of the rule's substance names exactly.
 */
export function matchesNameExact(queryName: string, ruleNames: string[]): boolean {
  const q = normalizeName(queryName);
  return ruleNames.some(n => normalizeName(n) === q);
}

/**
 * Return true if `queryName` has sufficient token overlap with any rule name.
 *
 * Overlap score = |query_tokens ∩ rule_tokens| / |query_tokens|
 * A score ≥ PARTIAL_MATCH_THRESHOLD (0.6) is considered a match.
 *
 * This handles cases like:
 *   "Thioglycolic acid" ↔ "Thioglycolic acid and its salts"
 *   "Benzoic acid"      ↔ "Benzoic acid and its sodium salt"
 */
export function matchesNamePartial(queryName: string, ruleNames: string[]): boolean {
  const qTokens = tokenize(queryName);
  if (qTokens.length === 0) return false;

  return ruleNames.some(ruleName => {
    const rTokens = new Set(tokenize(ruleName));
    const overlap = qTokens.filter(t => rTokens.has(t)).length;
    return overlap / qTokens.length >= PARTIAL_MATCH_THRESHOLD;
  });
}

/**
 * Return true if the query's product type overlaps with the rule's product
 * type restriction string.
 *
 * Uses simple keyword intersection — "rinse-off shampoo" will match a rule
 * restriction that mentions "rinse-off".
 */
export function matchesProductType(
  queryProductType: string,
  ruleProductType: string | undefined,
): boolean {
  if (!ruleProductType) return true; // no restriction → applies to all
  const qTerms = new Set(queryProductType.toLowerCase().split(/\W+/).filter(Boolean));
  const rTerms = ruleProductType.toLowerCase().split(/\W+/).filter(Boolean);
  return rTerms.some(t => qTerms.has(t));
}
