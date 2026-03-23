/**
 * Full compliance pipeline.
 *
 * Composes:
 *   1. parseQuery  — 1 LLM call, produces a Zod-validated IngredientQuery
 *   2. checkIngredient — pure rule engine, no LLM, no network
 *
 * The pipeline can be called from:
 *   - the Express API (src/index.ts)
 *   - the Mastra agent (as a single step before formatting)
 *   - tests / scripts directly
 */

import { parseQuery } from './parse-query.js';
import { checkIngredient } from '../engine/index.js';
import type { IngredientQuery } from '../schemas/ingredient-query.js';
import type { Verdict } from '../engine/types.js';

export interface PipelineResult {
  /** The structured query extracted by the LLM. */
  query: IngredientQuery;
  /** The deterministic compliance verdict from the rule engine. */
  verdict: Verdict;
}

/**
 * Run the full compliance pipeline from a natural-language string.
 *
 * @param text  Free-text user input (e.g. "phenoxyethanol 1% in shampoo")
 */
export async function runFromText(text: string): Promise<PipelineResult> {
  const query = await parseQuery(text);
  const verdict = checkIngredient(query);
  return { query, verdict };
}

