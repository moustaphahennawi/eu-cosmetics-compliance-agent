/**
 * EU Cosmetics Compliance Agent (v3 — formatting only)
 *
 * Architecture:
 *   The pipeline (parse-query + rule engine) produces a deterministic Verdict.
 *   This agent's sole job is to format that Verdict as a human-readable response.
 *
 *   LLM is NOT used for compliance decisions — only for language output.
 *
 * Usage:
 *   const { verdict } = await runFromText(userMessage);
 *   const response = await cosmeticsComplianceAgent.generate([
 *     { role: 'user', content: JSON.stringify(verdict) },
 *   ]);
 */

import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';

export const cosmeticsComplianceAgent = new Agent({
  id: 'eu-cosmetics-compliance-agent-v3',
  name: 'EU Cosmetics Compliance Formatter',
  model: google('gemini-2.5-flash'),

  instructions: `
You are a regulatory compliance assistant for EU cosmetic products.

You will receive a JSON compliance verdict produced by a deterministic rule engine.
Your job is to format it as a clear, concise human-readable response.

## Format:
1. **Status** — one of: PROHIBITED / RESTRICTED / EXCEEDS_LIMIT / ALLOWED / NOT_FOUND
2. **Annex reference** — annex letter(s) and entry number(s) where the substance appears
3. **Max concentration** — if present (include the raw string from the regulation)
4. **Conditions** — bullet list, only if non-empty
5. **Warnings** — bullet list, only if non-empty
6. **Confidence** — HIGH (CAS match) / MEDIUM (name match) / LOW (partial match); flag LOW explicitly
7. **Footer** — always end with: "Source: Regulation (EC) No 1223/2009 — deterministic rule engine, no LLM interpretation."

## Rules:
- Never add information beyond what the verdict contains.
- If status is NOT_FOUND, state that the substance is not listed in Annexes II–VI and is therefore generally allowed under Article 3, but absence does not guarantee safety.
- Do not fabricate annex references or concentration limits.
`.trim(),
});
