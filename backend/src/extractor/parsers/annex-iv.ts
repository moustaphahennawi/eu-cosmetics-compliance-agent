/**
 * Parser for Annex IV — Colorants allowed in cosmetic products
 * 10 columns: a=ref | b=name | c=CI/INCI | d=CAS | e=EC | f=colour | g=product type | h=max conc | i=other | j=warnings
 *
 * Strategy: content-based — CI numbers are 4-6 pure digits, colours are keywords, CAS/EC by regex.
 */
import type { Rule } from '../types.js';

const CAS_RE = /\b\d{2,7}-\d{2}-\d\b/g;
const EC_RE = /\b\d{3}-\d{3}-\d\b/g;
// CI number: 4-6 pure digits, not adjacent to dashes (not CAS fragment)
const CI_RE = /(?<!\d-)\b(\d{4,6})\b(?!-\d)/g;

const COLOUR_KEYWORDS = [
  'Red', 'Green', 'Yellow', 'Orange', 'Blue', 'Brown', 'Black',
  'White', 'Violet', 'Pink', 'Grey', 'Gray', 'Silver', 'Gold',
];

const REF_RE = /^(\s{0,10})(\d{1,3})\s{2,}/;

function isPageNoise(line: string): boolean {
  return (
    /Official Journal/.test(line) ||
    /L 342\//.test(line) ||
    /22\.12\.2009/.test(line) ||
    /^EN$/.test(line.trim()) ||
    /LIST OF COLORANTS/.test(line) ||
    /Substance identification/.test(line) ||
    /Colour index/.test(line) ||
    /Common Ingredients/.test(line) ||
    /Ingredients Glossary/.test(line) ||
    /Chemical Name/.test(line) ||
    /CAS number/.test(line) ||
    /EC number/.test(line) ||
    /Reference/.test(line) ||
    /n u mb er/.test(line) ||
    /Con dit ion s/.test(line) ||
    /Maximum con/.test(line) ||
    /centration in/.test(line) ||
    /Product type/.test(line) ||
    /Body parts/.test(line) ||
    /Wording of/.test(line) ||
    /ready for use/.test(line) ||
    /preparation/.test(line) ||
    /ANNEX/.test(line) ||
    /Preamble/.test(line) ||
    /Without prejudice/.test(line) ||
    /colorant shall include/.test(line) ||
    /N umb er/.test(line) ||
    /Na me of/.test(line) ||
    line.trim() === '' ||
    /^\s+[a-j]\s*$/.test(line) ||
    /^\s+a\s+b\s+c\s+d/.test(line)
  );
}

/** Split a line by 4+ consecutive spaces */
function splitByGaps(line: string, minGap = 4): string[] {
  return line.split(new RegExp(`\\s{${minGap},}`)).map(s => s.trim()).filter(Boolean);
}

function extractColour(text: string): string | undefined {
  for (const kw of COLOUR_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(text)) return kw;
  }
  return undefined;
}

export function parseAnnexIV(text: string): Rule[] {
  const lines = text.split('\n');
  const rules: Rule[] = [];

  const blocks: { ref: string; lines: string[] }[] = [];
  let current: { ref: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (isPageNoise(line)) continue;

    const m = line.match(REF_RE);
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
    if (/moved or deleted/i.test(fullText)) continue;

    const casNumbers = [...new Set((fullText.match(CAS_RE) || []))];
    const ecNumbers = [...new Set((fullText.match(EC_RE) || []))];
    const colour = extractColour(fullText);

    // CI number: first 4-6 digit standalone number in the full text
    // (after removing CAS/EC numbers to avoid false positives)
    const textNoCasEc = fullText
      .replace(new RegExp(CAS_RE.source, 'g'), '')
      .replace(new RegExp(EC_RE.source, 'g'), '');
    CI_RE.lastIndex = 0;
    const ciMatch = CI_RE.exec(textNoCasEc);
    const ciNumber = ciMatch ? ciMatch[1] : undefined;

    // Name: first line, split by 4+ spaces — take chunk before the CI number
    const firstLine = block.lines[0];
    const stripped = firstLine.replace(REF_RE, '').trimStart();
    const chunks = splitByGaps(stripped, 4);

    // Name is the first text chunk that isn't a pure number or CAS/EC
    const nameChunk = chunks.find(
      c => !/^\d{4,6}$/.test(c) && !c.match(/^\d{2,7}-\d{2}-\d/) && !c.match(/^\d{3}-\d{3}-\d/)
    ) ?? '';

    // INCI: look for Common Ingredients Glossary name — it's often after the CI number
    // and is non-numeric text that isn't the chemical name or a colour keyword
    const nameIdx = chunks.indexOf(nameChunk);
    const afterName = chunks.slice(nameIdx + 1);
    const inciChunk = afterName.find(
      c =>
        !/^\d{4,6}$/.test(c) &&
        !c.match(/^\d{2,7}-\d{2}-\d/) &&
        !c.match(/^\d{3}-\d{3}-\d/) &&
        !COLOUR_KEYWORDS.some(kw => c.toLowerCase() === kw.toLowerCase()) &&
        !/Rinse|Leave|product|purity/i.test(c)
    );

    // Max concentration: look for patterns like "3%", "0,5 %", "10 %" in full text
    const CONC_RE_LOCAL = /\b\d+[,.]?\d*\s*%(?:\s*\([^)]*\))?/g;
    const concMatches = [...new Set((fullText.match(CONC_RE_LOCAL) || []))];
    const maxConcentration = concMatches.length > 0 ? concMatches.join(' / ') : undefined;

    // Product type and conditions — keyword-based (avoids name text bleeding)
    const productTypeMatches: string[] = [];
    const conditionParts: string[] = [];

    if (/Rinse-off/i.test(fullText)) productTypeMatches.push('rinse-off products');
    if (/Leave-on/i.test(fullText)) productTypeMatches.push('leave-on products');
    // Handle PDF hyphenation: "mem-\nbranes", "mem- branes" → still detectable
    const normalised = fullText.replace(/mem-\s*branes/gi, 'membranes');
    if (/mucous\s*membranes?/i.test(normalised)) conditionParts.push('Not to be used on mucous membranes');
    if (/eye product|eye area|Not to be used in eye/i.test(normalised)) conditionParts.push('Not to be used in eye products');
    if (/hair dye|hair colour/i.test(fullText)) productTypeMatches.push('hair dye products');
    if (/Purity criteri/i.test(fullText)) conditionParts.push('Purity criteria apply');

    const restrictions =
      productTypeMatches.length > 0 || conditionParts.length > 0 || maxConcentration
        ? [{
            productType: productTypeMatches.join(', ') || undefined,
            maxConcentration,
            conditions: [...new Set(conditionParts)].join('; ') || undefined,
          }]
        : [];

    rules.push({
      id: `annex-iv-${block.ref}`,
      annex: 'IV',
      entryNumber: block.ref,
      substanceNames: nameChunk ? [nameChunk] : [],
      inciName: inciChunk || undefined,
      casNumbers,
      ecNumbers,
      status: 'ALLOWED',
      ciNumber,
      colour,
      restrictions,
    });
  }

  return rules;
}
