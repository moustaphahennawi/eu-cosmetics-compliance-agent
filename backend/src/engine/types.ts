/**
 * Core domain types for the EU cosmetics rule engine.
 *
 * Design principle: all types are plain data — no classes, no side effects.
 * The rule engine operates as a pure data transformation pipeline:
 *   IngredientQuery → [resolve] → MatchedRule[] → [evaluate] → Verdict
 */

// ─── Input ───────────────────────────────────────────────────────────────────

/**
 * IngredientQuery is defined by the Zod schema (single source of truth).
 * Re-exported here so engine internals don't import from schemas/.
 */
export type { IngredientQuery } from '../schemas/ingredient-query.js';

// ─── Intermediate ────────────────────────────────────────────────────────────

/** How a rule was matched to the query ingredient. */
export type MatchStrategy = 'cas' | 'inci' | 'name-exact' | 'name-partial';

/** A rule from rules.json that matched the query. */
export interface MatchedRule {
  ruleId: string;
  annex: 'II' | 'III' | 'IV' | 'V' | 'VI';
  entryNumber: string;
  substanceName: string;
  matchedBy: MatchStrategy;
  matchedValue: string;
  /** The raw restriction data from the rule. */
  maxConcentration?: string;
  productType?: string;
  conditions?: string;
  warnings?: string;
  /** Annex IV specific. */
  ciNumber?: string;
  colour?: string;
}

// ─── Output ──────────────────────────────────────────────────────────────────

/**
 * Compliance status of the queried ingredient.
 *
 * Priority (highest to lowest):
 *   PROHIBITED > EXCEEDS_LIMIT > RESTRICTED > ALLOWED > NOT_FOUND
 */
export type ComplianceStatus =
  | 'PROHIBITED'     // Annex II — unconditionally banned
  | 'EXCEEDS_LIMIT'  // Found but queried concentration > regulatory max
  | 'RESTRICTED'     // Annex III/V/VI — allowed under specific conditions
  | 'ALLOWED'        // Annex IV colorant — allowed under conditions
  | 'NOT_FOUND';     // Not listed in any annex → generally allowed under Article 3

export interface AnnexReference {
  annex: string;
  entry: string;
  description: string;
}

/** Final compliance verdict — fully deterministic, no LLM involved. */
export interface Verdict {
  status: ComplianceStatus;
  /** Resolved or normalised ingredient name. */
  ingredient: string;
  concentration?: number;
  productType?: string;
  /** All rules from rules.json that matched this ingredient. */
  matchedRules: MatchedRule[];
  /** Parsed numeric max from the regulation (most restrictive across matches). */
  maxConcentrationParsed?: number;
  /** Raw max concentration string from the regulation. */
  maxConcentrationRaw?: string;
  /** Deduped list of applicable conditions. */
  conditions: string[];
  /** Deduped list of required label warnings. */
  warnings: string[];
  annexReferences: AnnexReference[];
  /**
   * HIGH   = matched by CAS number
   * MEDIUM = matched by INCI name
   * LOW    = matched by partial name
   */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source: 'Regulation (EC) No 1223/2009';
}
