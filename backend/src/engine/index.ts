/**
 * Rule engine public API.
 *
 * Single entry point for compliance checking.  Composes resolver + evaluator.
 *
 * Usage:
 *   import { checkIngredient } from './engine/index.js';
 *   const verdict = checkIngredient({ name: 'Phenoxyethanol', concentration: 1.0 });
 */

import type { IngredientQuery, Verdict } from './types.js';
import { resolve } from './resolver.js';
import { evaluate } from './evaluator.js';

export { resolve } from './resolver.js';
export { evaluate } from './evaluator.js';
export type { IngredientQuery, Verdict, MatchedRule, ComplianceStatus } from './types.js';

/**
 * Check whether an ingredient is compliant with EU Regulation 1223/2009.
 *
 * This function is pure (given the loaded rules.json is stable):
 *   - deterministic: same input → same output
 *   - no network calls
 *   - no LLM calls
 *   - runs in < 5ms
 *
 * @param query  Structured ingredient query (name required; cas, concentration, productType optional).
 * @returns      Compliance verdict with matched rules, conditions, and warnings.
 */
export function checkIngredient(query: IngredientQuery): Verdict {
  const matched = resolve(query);
  return evaluate(query, matched);
}
