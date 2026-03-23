/**
 * Unit tests for the rule engine — pure functions, no LLM, no network.
 *
 * Tests cover:
 *   - utils/normalize
 *   - utils/concentration
 *   - utils/match
 *   - engine/resolver
 *   - engine/evaluator
 *   - engine/index (integration)
 */

import { checkIngredient, resolve, evaluate } from '../engine/index.js';
import { normalizeName, normalizeCAS, tokenize } from '../utils/normalize.js';
import {
  parseAllConcentrations,
  parseMinConcentration,
  parseMaxConcentration,
  compareConcentration,
} from '../utils/concentration.js';
import { matchesCASList, matchesINCI, matchesNamePartial } from '../utils/match.js';

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(label: string, fn: () => void) {
  try {
    fn();
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
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toContain(item: unknown) {
      if (!Array.isArray(actual) && typeof actual !== 'string')
        throw new Error('toContain requires array or string');
      if (!(actual as any[]).includes(item as T))
        throw new Error(`expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`);
    },
    toBeGreaterThan(n: number) {
      if ((actual as number) <= n)
        throw new Error(`expected ${actual} > ${n}`);
    },
    toBeDefined() {
      if (actual === undefined || actual === null)
        throw new Error(`expected value to be defined, got ${actual}`);
    },
    toBeUndefined() {
      if (actual !== undefined)
        throw new Error(`expected undefined, got ${JSON.stringify(actual)}`);
    },
  };
}

// ─── utils/normalize ─────────────────────────────────────────────────────────

console.log('\n📐 utils/normalize');

test('normalizeName strips footnote markers', () => {
  expect(normalizeName('Hydroquinone (4)')).toBe('hydroquinone');
});

test('normalizeName strips INN markers', () => {
  expect(normalizeName('Spironolactone (INN)')).toBe('spironolactone');
});

test('normalizeName collapses whitespace', () => {
  expect(normalizeName('  Boric  acid  ')).toBe('boric acid');
});

test('normalizeName strips soft hyphens', () => {
  expect(normalizeName('Octo\u00ADcrilene')).toBe('octocrilene');
});

test('normalizeCAS strips spaces around dashes', () => {
  expect(normalizeCAS('122 - 99 - 6')).toBe('122-99-6');
});

test('tokenize splits on word boundaries and filters short tokens', () => {
  const tokens = tokenize('Thioglycolic acid and its salts');
  expect(tokens).toContain('thioglycolic');
  expect(tokens).toContain('acid');
  expect(tokens).toContain('salts');
});

// ─── utils/concentration ─────────────────────────────────────────────────────

console.log('\n🧪 utils/concentration');

test('parseAllConcentrations handles European decimal notation', () => {
  expect(parseAllConcentrations('0,5 % (acid)')).toEqual([0.5]);
});

test('parseAllConcentrations handles multiple values', () => {
  expect(parseAllConcentrations('2,5 % (acid) / 1,7 % (acid) / 0,5 % (acid)')).toEqual([2.5, 1.7, 0.5]);
});

test('parseMinConcentration returns smallest', () => {
  expect(parseMinConcentration('2,5 % / 1,7 % / 0,5 %')).toBe(0.5);
});

test('parseMaxConcentration returns largest', () => {
  expect(parseMaxConcentration('2,5 % / 1,7 % / 0,5 %')).toBe(2.5);
});

test('compareConcentration: within limit', () => {
  expect(compareConcentration(0.8, '1,0 %')).toBe('within');
});

test('compareConcentration: exactly at limit', () => {
  expect(compareConcentration(1.0, '1,0 %')).toBe('within');
});

test('compareConcentration: exceeds limit', () => {
  expect(compareConcentration(1.5, '1,0 %')).toBe('exceeds');
});

test('compareConcentration: unknown when no % in string', () => {
  expect(compareConcentration(5, 'see conditions')).toBe('unknown');
});

// ─── utils/match ─────────────────────────────────────────────────────────────

console.log('\n🔍 utils/match');

test('matchesCASList finds exact CAS', () => {
  expect(matchesCASList('122-99-6', ['122-99-6', '50-00-0'])).toBe(true);
});

test('matchesCASList returns false when not present', () => {
  expect(matchesCASList('999-99-9', ['122-99-6'])).toBe(false);
});

test('matchesINCI is case-insensitive', () => {
  expect(matchesINCI('phenoxyethanol', 'Phenoxyethanol')).toBe(true);
});

test('matchesNamePartial handles "and its salts" suffix', () => {
  expect(matchesNamePartial('thioglycolic acid', ['Thioglycolic acid and its salts'])).toBe(true);
});

test('matchesNamePartial rejects unrelated names', () => {
  expect(matchesNamePartial('glycerin', ['Thioglycolic acid and its salts'])).toBe(false);
});

// ─── engine/resolver ─────────────────────────────────────────────────────────

console.log('\n🔎 engine/resolver');

test('resolve by CAS finds phenoxyethanol in Annex V', () => {
  const matches = resolve({ name: 'Phenoxyethanol', cas: '122-99-6' });
  expect(matches.length).toBeGreaterThan(0);
  const hit = matches.find(m => m.annex === 'V');
  expect(hit?.matchedBy).toBe('cas');
});

test('resolve by INCI finds Octocrylene in Annex VI', () => {
  const matches = resolve({ name: 'Octocrylene' });
  const hit = matches.find(m => m.annex === 'VI');
  expect(hit?.matchedBy).toBe('inci');
});

test('resolve by name finds Hydroquinone', () => {
  const matches = resolve({ name: 'Hydroquinone' });
  expect(matches.length).toBeGreaterThan(0);
});

test('resolve unknown ingredient returns empty array', () => {
  const matches = resolve({ name: 'xyzzy-unknown-substance-12345' });
  expect(matches.length).toBe(0);
});

test('resolve annex II match is sorted first', () => {
  // Hydrogen peroxide appears in both Annex III entries with some context
  const matches = resolve({ name: 'Hydroquinone', cas: '123-31-9' });
  if (matches.length > 1) {
    expect(matches[0].annex).toBe('III'); // Hydroquinone is in III, not II
  }
});

// ─── engine/evaluator ────────────────────────────────────────────────────────

console.log('\n⚖️  engine/evaluator');

test('evaluate with empty matches returns NOT_FOUND', () => {
  const v = evaluate({ name: 'unknown' }, []);
  expect(v.status).toBe('NOT_FOUND');
});

test('evaluate with Annex II match returns PROHIBITED', () => {
  const fakeAnnexII: any = [{
    ruleId: 'annex-ii-1',
    annex: 'II',
    entryNumber: '1',
    substanceName: 'Test prohibited substance',
    matchedBy: 'cas',
    matchedValue: '999-00-0',
  }];
  const v = evaluate({ name: 'test' }, fakeAnnexII);
  expect(v.status).toBe('PROHIBITED');
});

test('evaluate concentration exceeding limit returns EXCEEDS_LIMIT', () => {
  const fakeRule: any = [{
    ruleId: 'annex-v-29',
    annex: 'V',
    entryNumber: '29',
    substanceName: 'Phenoxyethanol',
    matchedBy: 'cas',
    matchedValue: '122-99-6',
    maxConcentration: '1,0 %',
  }];
  const v = evaluate({ name: 'Phenoxyethanol', concentration: 1.5 }, fakeRule);
  expect(v.status).toBe('EXCEEDS_LIMIT');
});

test('evaluate concentration within limit returns RESTRICTED', () => {
  const fakeRule: any = [{
    ruleId: 'annex-v-29',
    annex: 'V',
    entryNumber: '29',
    substanceName: 'Phenoxyethanol',
    matchedBy: 'cas',
    matchedValue: '122-99-6',
    maxConcentration: '1,0 %',
  }];
  const v = evaluate({ name: 'Phenoxyethanol', concentration: 0.5 }, fakeRule);
  expect(v.status).toBe('RESTRICTED');
});

// ─── engine/index (integration) ──────────────────────────────────────────────

console.log('\n🏁 engine/index (integration)');

test('checkIngredient: phenoxyethanol 1% → RESTRICTED', () => {
  const v = checkIngredient({ name: 'Phenoxyethanol', cas: '122-99-6', concentration: 1.0 });
  expect(v.status).toBe('RESTRICTED');
  expect(v.confidence).toBe('HIGH');
});

test('checkIngredient: phenoxyethanol 2% → EXCEEDS_LIMIT', () => {
  const v = checkIngredient({ name: 'Phenoxyethanol', cas: '122-99-6', concentration: 2.0 });
  expect(v.status).toBe('EXCEEDS_LIMIT');
});

test('checkIngredient: hydroquinone by CAS → RESTRICTED (Annex III)', () => {
  const v = checkIngredient({ name: 'Hydroquinone', cas: '123-31-9' });
  expect(v.status).toBe('RESTRICTED');
  expect(v.annexReferences[0].annex).toBe('Annex III');
});

test('checkIngredient: octocrylene 10% UV filter → RESTRICTED (within limit)', () => {
  const v = checkIngredient({ name: 'Octocrylene', cas: '6197-30-4', concentration: 10 });
  expect(v.status).toBe('RESTRICTED');
});

test('checkIngredient: octocrylene 15% → EXCEEDS_LIMIT', () => {
  const v = checkIngredient({ name: 'Octocrylene', cas: '6197-30-4', concentration: 15 });
  expect(v.status).toBe('EXCEEDS_LIMIT');
});

test('checkIngredient: glycerin → NOT_FOUND (allowed)', () => {
  const v = checkIngredient({ name: 'Glycerin' });
  expect(v.status).toBe('NOT_FOUND');
});

test('checkIngredient: titanium dioxide as UV filter → RESTRICTED', () => {
  const v = checkIngredient({ name: 'Titanium Dioxide', cas: '13463-67-7' });
  expect(v.status).toBe('RESTRICTED');
  expect(v.confidence).toBe('HIGH');
});

test('checkIngredient: boric acid → RESTRICTED with max concentration', () => {
  const v = checkIngredient({ name: 'Boric acid', cas: '10043-35-3' });
  expect(v.status).toBe('RESTRICTED');
  expect(v.maxConcentrationRaw).toBeDefined();
});

test('checkIngredient: result has source field', () => {
  const v = checkIngredient({ name: 'Phenoxyethanol' });
  expect(v.source).toBe('Regulation (EC) No 1223/2009');
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\n❌ Some tests failed.');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed.');
}
