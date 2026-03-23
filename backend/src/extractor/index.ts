import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractPdfText, splitByAnnex } from './pdf-reader.js';
import { parseAnnexII } from './parsers/annex-ii.js';
import { parseAnnexComplex } from './parsers/annex-complex.js';
import { parseAnnexIV } from './parsers/annex-iv.js';
import type { Rule } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(__dirname, '../data/rules.json');

async function main() {
  console.log('📄 Extracting PDF text...');
  const text = extractPdfText();

  console.log('🔪 Splitting by annex...');
  const annexes = splitByAnnex(text);
  console.log(`   Found annexes: ${Object.keys(annexes).join(', ')}`);

  const all: Rule[] = [];

  // Annex II — Prohibited substances
  console.log('\n⛔ Parsing Annex II (prohibited)...');
  const ii = parseAnnexII(annexes['II'] ?? '');
  console.log(`   → ${ii.length} entries`);
  all.push(...ii);

  // Annex III — Restricted substances
  console.log('⚠️  Parsing Annex III (restricted)...');
  const iii = parseAnnexComplex(annexes['III'] ?? '', 'III');
  console.log(`   → ${iii.length} entries`);
  all.push(...iii);

  // Annex IV — Colorants
  console.log('🎨 Parsing Annex IV (colorants)...');
  const iv = parseAnnexIV(annexes['IV'] ?? '');
  console.log(`   → ${iv.length} entries`);
  all.push(...iv);

  // Annex V — Preservatives
  console.log('🧪 Parsing Annex V (preservatives)...');
  const v = parseAnnexComplex(annexes['V'] ?? '', 'V');
  console.log(`   → ${v.length} entries`);
  all.push(...v);

  // Annex VI — UV Filters
  console.log('☀️  Parsing Annex VI (UV filters)...');
  const vi = parseAnnexComplex(annexes['VI'] ?? '', 'VI');
  console.log(`   → ${vi.length} entries`);
  all.push(...vi);

  console.log(`\n✅ Total rules extracted: ${all.length}`);

  writeFileSync(OUTPUT_PATH, JSON.stringify(all, null, 2), 'utf-8');
  console.log(`💾 Written to ${OUTPUT_PATH}`);

  // Summary stats
  const byAnnex = all.reduce<Record<string, number>>((acc, r) => {
    acc[r.annex] = (acc[r.annex] ?? 0) + 1;
    return acc;
  }, {});
  console.log('\n📊 Summary:');
  for (const [annex, count] of Object.entries(byAnnex)) {
    console.log(`   Annex ${annex}: ${count} rules`);
  }
}

main().catch((err) => {
  console.error('❌ Extraction failed:', err);
  process.exit(1);
});
