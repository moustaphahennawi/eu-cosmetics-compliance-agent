/**
 * Single source of truth for the IngredientQuery structure.
 *
 * This Zod schema is shared across three layers:
 *   - pipeline/parse-query.ts  → constrains generateObject output
 *   - tools/check-ingredient.ts → Mastra tool inputSchema
 *   - engine/types.ts           → TypeScript type is inferred from here
 *
 * Keeping it here avoids drift between what the LLM produces,
 * what the tool accepts, and what the rule engine consumes.
 */

import { z } from 'zod';

/**
 * Product type vocabulary aligned with the regulation's own terminology.
 * The LLM maps free-text product descriptions to one of these values.
 */
export const PRODUCT_TYPES = [
  'rinse-off',   // shampoos, shower gels, conditioners
  'leave-on',    // creams, serums, lotions
  'oral',        // toothpaste, mouthwash
  'hair-dye',    // permanent/semi-permanent colouring
  'hair',        // general hair products (non-dye)
  'eye',         // mascara, eye shadow, eye cream
  'nail',        // nail polish, nail care
  'sunscreen',   // SPF products
  'spray',       // aerosol or pump spray
  'general',     // unspecified / general cosmetic
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

export const IngredientQuerySchema = z.object({
  name: z
    .string()
    .min(1)
    .describe(
      'Ingredient name in English. Prefer the INCI name if you recognise it (e.g. "Phenoxyethanol" not "phenoxy ethanol"). Do not infer a CAS — leave cas undefined if unsure.',
    ),

  cas: z
    .string()
    .regex(/^\d{2,7}-\d{2}-\d$/, 'Must be a valid CAS number (e.g. "122-99-6")')
    .optional()
    .describe('CAS registry number. Only include if explicitly stated by the user.'),

  concentration: z
    .number()
    .positive()
    .max(100)
    .optional()
    .describe(
      'Concentration in percent as a plain number (e.g. 1.5 for "1.5%"). Omit if not specified.',
    ),

  productType: z
    .enum(PRODUCT_TYPES)
    .optional()
    .describe(
      'Closest product category from the allowed list. Omit if the user did not specify a product type.',
    ),
});

/** TypeScript type inferred from Zod — no separate interface needed. */
export type IngredientQuery = z.infer<typeof IngredientQuerySchema>;
