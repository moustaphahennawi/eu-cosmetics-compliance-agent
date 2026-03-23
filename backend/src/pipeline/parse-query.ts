/**
 * Natural-language → IngredientQuery extraction.
 *
 * Uses generateObject (AI SDK) to force the LLM to produce a Zod-validated
 * IngredientQuery from free text.  One LLM call, no agentic loop.
 *
 * The Zod schema is the contract: if the LLM output doesn't match,
 * the SDK throws before the rule engine is ever called.
 */

import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { IngredientQuerySchema, type IngredientQuery } from '../schemas/ingredient-query.js';

const model = google('gemini-2.5-flash');

const SYSTEM_PROMPT = `
You are extracting a structured ingredient query from a user's message about cosmetic compliance.

Rules:
- "name" must be the INCI name if you recognise it, otherwise the name as given by the user.
- "cas" only if the user explicitly provides a CAS number. Do NOT infer it.
- "concentration" as a plain number in percent (1.5 for "1.5%"). Omit if not mentioned.
- "productType" mapped to the closest allowed enum value. Omit if not mentioned.
- When in doubt, omit optional fields rather than guessing.
`.trim();

/**
 * Parse a natural-language ingredient query into a validated IngredientQuery.
 *
 * @throws {Error} If the LLM output fails Zod validation (invalid CAS format, etc.)
 *
 * @example
 * await parseQuery("is phenoxyethanol at 2% ok in a leave-on cream?")
 * // → { name: "Phenoxyethanol", concentration: 2, productType: "leave-on" }
 */
export async function parseQuery(text: string): Promise<IngredientQuery> {
  const { object } = await generateObject({
    model,
    schema: IngredientQuerySchema,
    system: SYSTEM_PROMPT,
    prompt: text,
  });

  return object;
}
