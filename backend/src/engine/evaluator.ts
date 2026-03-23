/**
 * Evaluator — pure decision function.
 *
 * Takes a list of matched rules + the original query and produces a Verdict.
 * No I/O, no LLM calls, no side effects. Identical inputs → identical output.
 *
 * Decision tree:
 *
 *   matchedRules is empty
 *     → NOT_FOUND  (not listed = generally allowed under Article 3)
 *
 *   any rule is Annex II
 *     → PROHIBITED  (absolute, overrides everything)
 *
 *   concentration provided AND exceeds the most restrictive limit
 *     → EXCEEDS_LIMIT
 *
 *   any rule is Annex III / V / VI
 *     → RESTRICTED  (conditions apply)
 *
 *   only Annex IV matches
 *     → ALLOWED  (colorant — allowed under conditions)
 */

import type { IngredientQuery, MatchedRule, Verdict, AnnexReference, ComplianceStatus } from './types.js';
import { compareConcentration, parseMinConcentration } from '../utils/concentration.js';
import { matchesProductType } from '../utils/match.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Deduplicate an array of strings (case-insensitive, preserves first occurrence). */
function dedup(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter(s => {
    const k = s.toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Extract annex references from matched rules for output. */
function buildAnnexReferences(matched: MatchedRule[]): AnnexReference[] {
  return matched.map(r => ({
    annex: `Annex ${r.annex}`,
    entry: r.entryNumber,
    description: [
      r.substanceName,
      r.maxConcentration ? `Max: ${r.maxConcentration}` : null,
      r.productType ? `Products: ${r.productType}` : null,
      r.conditions ?? null,
    ]
      .filter(Boolean)
      .join(' | '),
  }));
}

/** Derive confidence from the best match strategy across all matched rules. */
function deriveConfidence(matched: MatchedRule[]): Verdict['confidence'] {
  const strategies = matched.map(r => r.matchedBy);
  if (strategies.includes('cas')) return 'HIGH';
  if (strategies.includes('inci') || strategies.includes('name-exact')) return 'MEDIUM';
  return 'LOW';
}

/**
 * Find the most restrictive max concentration across all matched rules,
 * optionally filtered to product-type-relevant rules.
 */
function resolveConcentrationLimit(
  matched: MatchedRule[],
  productType?: string,
): { raw: string | undefined; parsed: number | undefined } {
  // Filter to rules that have a concentration limit
  const withConc = matched.filter(r => r.maxConcentration);
  if (withConc.length === 0) return { raw: undefined, parsed: undefined };

  // Prefer rules that match the queried product type
  const relevant = productType
    ? withConc.filter(r => matchesProductType(productType, r.productType))
    : withConc;

  const pool = relevant.length > 0 ? relevant : withConc;

  // Use the most restrictive (minimum) limit as the conservative bound
  let minParsed = Infinity;
  let rawForMin = pool[0].maxConcentration!;

  for (const r of pool) {
    const min = parseMinConcentration(r.maxConcentration!);
    if (min !== undefined && min < minParsed) {
      minParsed = min;
      rawForMin = r.maxConcentration!;
    }
  }

  return {
    raw: rawForMin,
    parsed: minParsed === Infinity ? undefined : minParsed,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluate matched rules against the query and produce a compliance Verdict.
 *
 * @param query    Original ingredient query.
 * @param matched  Output of resolver.resolve().
 * @returns        Deterministic compliance verdict.
 */
export function evaluate(query: IngredientQuery, matched: MatchedRule[]): Verdict {
  const ingredient = query.name;

  // ── No match ──────────────────────────────────────────────────────────────
  if (matched.length === 0) {
    return {
      status: 'NOT_FOUND',
      ingredient,
      concentration: query.concentration,
      productType: query.productType,
      matchedRules: [],
      conditions: [],
      warnings: [],
      annexReferences: [],
      confidence: 'LOW',
      source: 'Regulation (EC) No 1223/2009',
    };
  }

  // ── Annex II — absolute prohibition ───────────────────────────────────────
  const annexIIMatches = matched.filter(r => r.annex === 'II');
  if (annexIIMatches.length > 0) {
    return {
      status: 'PROHIBITED',
      ingredient,
      concentration: query.concentration,
      productType: query.productType,
      matchedRules: matched,
      conditions: [],
      warnings: ['This substance is prohibited in cosmetic products under Annex II.'],
      annexReferences: buildAnnexReferences(matched),
      confidence: deriveConfidence(matched),
      source: 'Regulation (EC) No 1223/2009',
    };
  }

  // ── Concentration check ───────────────────────────────────────────────────
  const { raw: maxRaw, parsed: maxParsed } = resolveConcentrationLimit(
    matched,
    query.productType,
  );

  let status: ComplianceStatus = 'RESTRICTED';

  if (query.concentration !== undefined && maxRaw !== undefined) {
    const cmp = compareConcentration(query.concentration, maxRaw);
    if (cmp === 'exceeds') {
      status = 'EXCEEDS_LIMIT';
    }
  }

  // ── Annex IV only → ALLOWED (colorant, conditions may apply) ─────────────
  const nonColorantMatches = matched.filter(r => r.annex !== 'IV');
  if (nonColorantMatches.length === 0 && status !== 'EXCEEDS_LIMIT') {
    status = 'ALLOWED';
  }

  // ── Collect conditions and warnings ──────────────────────────────────────
  const rawConditions = matched
    .map(r => r.conditions)
    .filter((c): c is string => Boolean(c));

  const rawWarnings = matched
    .map(r => r.warnings)
    .filter((w): w is string => Boolean(w));

  const conditions = dedup(rawConditions);
  const warnings = dedup(rawWarnings);

  return {
    status,
    ingredient,
    concentration: query.concentration,
    productType: query.productType,
    matchedRules: matched,
    maxConcentrationParsed: maxParsed,
    maxConcentrationRaw: maxRaw,
    conditions,
    warnings,
    annexReferences: buildAnnexReferences(matched),
    confidence: deriveConfidence(matched),
    source: 'Regulation (EC) No 1223/2009',
  };
}
