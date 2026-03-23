/**
 * Mastra tool: check-ingredient
 *
 * Exposes the deterministic rule engine as a Mastra tool for:
 *   - consumption by external agents
 *   - MCP server exposure
 *
 * The inputSchema reuses IngredientQuerySchema — same Zod contract
 * as the pipeline's parseQuery output.  No duplication.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { IngredientQuerySchema } from '../schemas/ingredient-query.js';
import { checkIngredient } from '../engine/index.js';

export const checkIngredientTool = createTool({
  id: 'check-ingredient',

  description:
    'Check whether a cosmetic ingredient complies with EU Regulation (EC) No 1223/2009. ' +
    'Returns a deterministic verdict (PROHIBITED / RESTRICTED / EXCEEDS_LIMIT / ALLOWED / NOT_FOUND) ' +
    'derived from the pre-built rules database (Annexes II–VI). No network call, no LLM.',

  inputSchema: IngredientQuerySchema,

  outputSchema: z.object({
    status: z.enum(['PROHIBITED', 'EXCEEDS_LIMIT', 'RESTRICTED', 'ALLOWED', 'NOT_FOUND']),
    ingredient: z.string(),
    concentration: z.number().optional(),
    productType: z.string().optional(),
    maxConcentrationRaw: z.string().optional(),
    maxConcentrationParsed: z.number().optional(),
    conditions: z.array(z.string()),
    warnings: z.array(z.string()),
    annexReferences: z.array(
      z.object({ annex: z.string(), entry: z.string(), description: z.string() }),
    ),
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    source: z.literal('Regulation (EC) No 1223/2009'),
    matchedRulesCount: z.number(),
  }),

  execute: async (inputData) => {
    const verdict = checkIngredient(inputData);
    return {
      status: verdict.status,
      ingredient: verdict.ingredient,
      concentration: verdict.concentration,
      productType: verdict.productType,
      maxConcentrationRaw: verdict.maxConcentrationRaw,
      maxConcentrationParsed: verdict.maxConcentrationParsed,
      conditions: verdict.conditions,
      warnings: verdict.warnings,
      annexReferences: verdict.annexReferences,
      confidence: verdict.confidence,
      source: verdict.source,
      matchedRulesCount: verdict.matchedRules.length,
    };
  },
});
