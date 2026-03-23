/**
 * Integration tests — full stack.
 *
 * Layers covered:
 *   1. parse-query   — LLM call (Gemini 2.5 Flash), Zod-validated output
 *   2. pipeline/run  — NL → parse → engine (runFromText)
 *   3. tools         — checkIngredientTool.execute() via Mastra createTool
 *
 * These tests make real LLM calls. Expect 5–30 s per test.
 * Run with: npm run test:integration
 */

import 'dotenv/config';
import { parseQuery } from '../pipeline/parse-query.js';
import { runFromText } from '../pipeline/run.js';
import { checkIngredientTool } from '../tools/check-ingredient.js';
import type { IngredientQuery } from '../schemas/ingredient-query.js';

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e: any) {
    console.error(`  ❌ ${label}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected)
        throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeOneOf(options: T[]) {
      if (!options.includes(actual))
        throw new Error(`expected one of ${JSON.stringify(options)}, got ${JSON.stringify(actual)}`);
    },
    toMatch(re: RegExp) {
      if (typeof actual !== 'string' || !re.test(actual))
        throw new Error(`expected "${actual}" to match ${re}`);
    },
    toBeDefined() {
      if (actual === undefined || actual === null)
        throw new Error(`expected defined value, got ${actual}`);
    },
    toBeGreaterThan(n: number) {
      if ((actual as number) <= n)
        throw new Error(`expected ${actual} > ${n}`);
    },
  };
}

// ─── Layer 1 — parse-query (LLM extraction) ──────────────────────────────────

console.log('\n🧠 Layer 1 — parse-query (LLM → Zod)');

await test('parses ingredient name to INCI', async () => {
  const q = await parseQuery('is phenoxyethanol at 1% safe in a leave-on cream?');
  expect(q.name.toLowerCase()).toMatch(/phenoxyethanol/);
  expect(q.concentration).toBe(1);
  expect(q.productType).toBe('leave-on');
});

await test('parses concentration without product type', async () => {
  const q = await parseQuery('phenoxyethanol 2%');
  expect(q.name.toLowerCase()).toMatch(/phenoxyethanol/);
  expect(q.concentration).toBe(2);
});

await test('omits concentration when not mentioned', async () => {
  const q = await parseQuery('what is the status of hydroquinone?');
  expect(q.name.toLowerCase()).toMatch(/hydroquinone/);
  if (q.concentration !== undefined)
    throw new Error(`concentration should be undefined, got ${q.concentration}`);
});

await test('maps shampoo to rinse-off product type', async () => {
  const q = await parseQuery('glycerin 5% in a shampoo');
  expect(q.productType).toBe('rinse-off');
});

await test('does NOT infer CAS when not provided by user', async () => {
  const q = await parseQuery('check phenoxyethanol at 1%');
  if (q.cas !== undefined)
    throw new Error(`CAS should not be inferred, got ${q.cas}`);
});

await test('passes through explicit CAS number', async () => {
  const q = await parseQuery('check ingredient with CAS 122-99-6 at 0.5%');
  expect(q.cas).toBe('122-99-6');
});

// ─── Layer 2 — runFromText (NL → LLM → engine) ───────────────────────────────

console.log('\n🔗 Layer 2 — runFromText (full pipeline)');

await test('phenoxyethanol 0.5% → RESTRICTED', async () => {
  const { verdict } = await runFromText('phenoxyethanol at 0.5% in a rinse-off product');
  expect(verdict.status).toBe('RESTRICTED');
  expect(verdict.confidence).toBeOneOf(['HIGH', 'MEDIUM']);
});

await test('phenoxyethanol 2% → EXCEEDS_LIMIT', async () => {
  const { verdict } = await runFromText('phenoxyethanol 2%');
  expect(verdict.status).toBe('EXCEEDS_LIMIT');
});

await test('hydroquinone → RESTRICTED (Annex III)', async () => {
  const { verdict } = await runFromText('hydroquinone in hair dye');
  expect(verdict.status).toBeOneOf(['RESTRICTED', 'EXCEEDS_LIMIT']);
  const annexes = verdict.annexReferences.map(r => r.annex);
  if (!annexes.some(a => a.includes('III') || a.includes('II')))
    throw new Error(`expected Annex II or III, got ${JSON.stringify(annexes)}`);
});

await test('glycerin → NOT_FOUND (allowed)', async () => {
  const { verdict } = await runFromText('glycerin at 5% in moisturiser');
  expect(verdict.status).toBe('NOT_FOUND');
});

await test('octocrylene 10% sunscreen → RESTRICTED', async () => {
  const { verdict } = await runFromText('octocrylene 10% sunscreen');
  expect(verdict.status).toBe('RESTRICTED');
});

await test('runFromText returns structured query alongside verdict', async () => {
  const { query, verdict } = await runFromText('titanium dioxide in sunscreen');
  expect(query.name).toBeDefined();
  expect(verdict.source).toBe('Regulation (EC) No 1223/2009');
});

// ─── Layer 3 — checkIngredientTool (Mastra tool) ─────────────────────────────

console.log('\n🔧 Layer 3 — checkIngredientTool (Mastra tool)');

/** Call the tool's execute and throw if Mastra returns a ValidationError. */
async function callTool(input: IngredientQuery) {
  if (!checkIngredientTool.execute) throw new Error('tool.execute is undefined');
  const result = await checkIngredientTool.execute(input, {} as any);
  if ('error' in result && result.error) throw new Error((result as any).message);
  return result as Exclude<typeof result, { error: true }>;
}

await test('tool returns correct output schema for RESTRICTED ingredient', async () => {
  const result = await callTool({ name: 'Phenoxyethanol', cas: '122-99-6', concentration: 0.5 });
  expect(result.status).toBe('RESTRICTED');
  expect(result.ingredient).toMatch(/phenoxyethanol/i);
  expect(result.confidence).toBe('HIGH');
  expect(result.matchedRulesCount).toBeGreaterThan(0);
  expect(result.source).toBe('Regulation (EC) No 1223/2009');
});

await test('tool returns EXCEEDS_LIMIT when over max', async () => {
  const result = await callTool({ name: 'Phenoxyethanol', cas: '122-99-6', concentration: 2.0 });
  expect(result.status).toBe('EXCEEDS_LIMIT');
  expect(result.maxConcentrationParsed).toBeDefined();
});

await test('tool returns NOT_FOUND for unknown ingredient', async () => {
  const result = await callTool({ name: 'xyzzy-unknown-12345' });
  expect(result.status).toBe('NOT_FOUND');
  expect(result.matchedRulesCount).toBe(0);
});

await test('tool returns PROHIBITED for banned substance (Annex II)', async () => {
  // Chloroform is listed in Annex II (prohibited)
  const result = await callTool({ name: 'Chloroform', cas: '67-66-3' });
  expect(result.status).toBe('PROHIBITED');
});

await test('tool output includes annexReferences array', async () => {
  const result = await callTool({ name: 'Octocrylene', cas: '6197-30-4' });
  if (!Array.isArray(result.annexReferences) || result.annexReferences.length === 0)
    throw new Error('expected non-empty annexReferences array');
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\n❌ Some integration tests failed.');
  process.exit(1);
} else {
  console.log('\n✅ All integration tests passed.');
}
