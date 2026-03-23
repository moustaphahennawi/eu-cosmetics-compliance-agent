import type { Rule } from '../types.js';

// CAS: 2-7 digits - 2 digits - 1 digit
const CAS_RE = /\b\d{2,7}-\d{2}-\d\b/g;
// EC: exactly 3-3-1
const EC_RE = /\b\d{3}-\d{3}-\d\b/g;
// Annex II reference number: 1-4 digits at start of an indented line
const ENTRY_START_RE = /^(\s{0,20})(\d{1,4})\s{2,}/;

function isPageNoise(line: string): boolean {
  return (
    /Official Journal/.test(line) ||
    /L 342\//.test(line) ||
    /22\.12\.2009/.test(line) ||
    /ANNEX/.test(line) ||
    /LIST OF SUBSTANCES/.test(line) ||
    /Substance identification/.test(line) ||
    /Chemical name/.test(line) ||
    /CAS number/.test(line) ||
    /EC number/.test(line) ||
    /Reference/.test(line) ||
    /number/.test(line) ||
    line.trim() === '' ||
    /^\s+[a-d]\s*$/.test(line)
  );
}

export function parseAnnexII(text: string): Rule[] {
  const rules: Rule[] = [];
  const lines = text.split('\n');

  // Group lines into entry blocks
  const blocks: { ref: string; lines: string[] }[] = [];
  let current: { ref: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (isPageNoise(line)) continue;

    const m = line.match(ENTRY_START_RE);
    if (m) {
      if (current) blocks.push(current);
      current = { ref: m[2], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);

  for (const block of blocks) {
    const fullText = block.lines.join(' ');

    const casNumbers = [...new Set((fullText.match(CAS_RE) || []))];
    const ecNumbers = [...new Set((fullText.match(EC_RE) || []))];

    // Remove ref number, CAS, EC, and noise to get the substance name
    let nameText = fullText
      .replace(new RegExp(`^\\s{0,20}${block.ref}\\s+`), '')  // strip ref
      .replace(CAS_RE, '')
      .replace(EC_RE, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    rules.push({
      id: `annex-ii-${block.ref}`,
      annex: 'II',
      entryNumber: block.ref,
      substanceNames: nameText ? [nameText] : [],
      casNumbers,
      ecNumbers,
      status: 'PROHIBITED',
      restrictions: [],
    });
  }

  return rules;
}
