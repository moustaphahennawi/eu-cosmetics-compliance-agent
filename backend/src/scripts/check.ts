/**
 * CLI script — check an ingredient from natural language.
 *
 * Usage:
 *   npm run check "phenoxyethanol 1% in a leave-on cream"
 *   npm run check "is hydroquinone allowed in hair dye?"
 */

import 'dotenv/config';
import { runFromText } from '../pipeline/run.js';

const text = process.argv[2];

if (!text) {
  console.error('Usage: npm run check "<natural language query>"');
  process.exit(1);
}

console.log(`\nQuery: "${text}"\n`);

const { query, verdict } = await runFromText(text);

console.log('Parsed query:');
console.log(`  name:          ${query.name}`);
if (query.cas)           console.log(`  cas:           ${query.cas}`);
if (query.concentration) console.log(`  concentration: ${query.concentration}%`);
if (query.productType)   console.log(`  productType:   ${query.productType}`);

console.log('\nVerdict:');
console.log(`  status:        ${verdict.status}`);
console.log(`  confidence:    ${verdict.confidence}`);
if (verdict.maxConcentrationRaw) console.log(`  maxConc:       ${verdict.maxConcentrationRaw}`);
if (verdict.conditions.length)   console.log(`  conditions:    ${verdict.conditions.join(' | ')}`);
if (verdict.warnings.length)     console.log(`  warnings:      ${verdict.warnings.join(' | ')}`);
if (verdict.annexReferences.length) {
  console.log(`  annexes:       ${verdict.annexReferences.map(r => `${r.annex} §${r.entry}`).join(', ')}`);
}
console.log(`  source:        ${verdict.source}`);
