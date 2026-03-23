/**
 * Parser for Annexes III, V, VI — 9-column tables (a-i):
 * a=ref | b=chemical name | c=INCI | d=CAS | e=EC | f=product type | g=max conc | h=other | i=warnings
 *
 * Strategy: content-based parsing using known patterns (CAS/EC regex, concentration regex,
 * large-whitespace column splitting) rather than fragile fixed character positions.
 */
import type { AnnexId, Rule, Restriction } from '../types.js';

const CAS_RE = /\b\d{2,7}-\d{2}-\d\b/g;
const EC_RE = /\b\d{3}-\d{3}-\d\b/g;
// Match concentrations like "5 %", "0,5 % (acid)", "10 % (as acid)" — but not long chemical names in parens
const CONC_RE = /\d+[,.]?\d*\s*%(?:\s*\(as\s+[a-z\s]+\)|\s*\(free\s+[a-z\s]+\))?/gi;

// Entry reference: digits + optional letter, at start of line with indent ≤ 10
const REF_RE = /^(\s{0,10})(\d{1,3}[a-z]?)\s{2,}/;

function isPageNoise(line: string): boolean {
  return (
    /Official Journal/.test(line) ||
    /L 342\//.test(line) ||
    /22\.12\.2009/.test(line) ||
    /^EN$/.test(line.trim()) ||
    /LIST OF (SUBSTANCES|PRESERVATIVES|UV FILTERS)/.test(line) ||
    /Substance identification/.test(line) ||
    /Con dit ion s/.test(line) ||
    /Chemical name/.test(line) ||
    /CAS n/.test(line) ||
    /EC n/.test(line) ||
    /Reference/.test(line) ||
    /n u mb er/.test(line) ||
    /Maximum concentration/.test(line) ||
    /Maximum con/.test(line) ||
    /centration in/.test(line) ||
    /Product type/.test(line) ||
    /body parts/.test(line) ||
    /Wording of/.test(line) ||
    /ready for use/.test(line) ||
    /Name of C ommon/.test(line) ||
    /Ingredients Glossary/.test(line) ||
    /ANNEX/.test(line) ||
    /Preamble/.test(line) ||
    /For the purposes/.test(line) ||
    /'Salts'/.test(line) ||
    /'Esters'/.test(line) ||
    /finished products containing/.test(line) ||
    line.trim() === '' ||
    /^\s+[a-i]\s*$/.test(line) ||
    // Column label line: "   a     b     c  ...  i"
    /^\s+a\s+b\s+c\s+d/.test(line)
  );
}

/** Split a line into tokens separated by 5+ spaces (column boundaries) */
function splitByLargeGaps(line: string, minGap = 5): string[] {
  return line.split(new RegExp(`\\s{${minGap},}`)).map(s => s.trim()).filter(Boolean);
}

function extractNamesFromFirstLine(firstLine: string, ref: string): { name: string; inci: string } {
  // Remove leading spaces + ref number
  const stripped = firstLine.replace(new RegExp(`^\\s{0,10}${ref}\\s+`), '').trimStart();

  // Split by 3+ spaces — name and INCI columns are often only 3 spaces apart
  const chunks = splitByLargeGaps(stripped, 3);

  // Name = first chunk that isn't a CAS/EC number or pure number
  const nameChunk = chunks.find(
    c => !c.match(/^\d{2,7}-\d{2}-\d$/) && !c.match(/^\d{3}-\d{3}-\d$/) && !/^\d+$/.test(c)
  ) ?? '';

  // INCI = second non-number, non-CAS/EC, non-concentration chunk
  const remainingChunks = chunks.slice(chunks.indexOf(nameChunk) + 1);
  const inciChunk = remainingChunks.find(
    c =>
      !c.match(/^\d{2,7}-\d{2}-\d/) &&
      !c.match(/^\d{3}-\d{3}-\d/) &&
      !/%/.test(c) &&                    // not a concentration
      !/^\d+$/.test(c) &&               // not a pure number
      !/^Not to/i.test(c) &&            // not a warning phrase
      !/^For professional/i.test(c) &&  // not a condition
      !/^Contains/i.test(c) &&
      !/^\(a\)/.test(c)                 // not a sub-restriction label
  ) ?? '';

  return { name: nameChunk, inci: inciChunk };
}

function extractContinuationName(lines: string[]): string {
  // Lines after the first that start far to the left (still in name column)
  // are continuations of the substance name
  const parts: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const leadingSpaces = line.match(/^(\s*)/)?.[1].length ?? 0;
    // Name column text typically has low indentation (< 30 chars)
    if (leadingSpaces < 30) {
      const trimmed = line.trim();
      if (trimmed && !CAS_RE.test(trimmed) && !EC_RE.test(trimmed)) {
        parts.push(trimmed);
      }
    }
    CAS_RE.lastIndex = 0;
    EC_RE.lastIndex = 0;
  }
  return parts.join(' ');
}

function extractRestrictions(lines: string[]): Restriction[] {
  // Join all text and extract concentration + product type mentions
  const fullText = lines.join(' ').replace(/\s{2,}/g, ' ');

  // Find all concentration values
  const concMatches = fullText.match(CONC_RE) ?? [];

  // Find product type keywords
  const productTypeKeywords = [
    'rinse-off',
    'leave-on',
    'oral product',
    'hair product',
    'hair dye',
    'hair colouring',
    'skin care',
    'face product',
    'body product',
    'eye product',
    'lip product',
    'nail product',
    'spray',
    'aerosol',
    'sun product',
    'bath product',
    'general use',
    'professional use',
    'non-oxidative',
    'oxidative',
    'mucous membrane',
  ];

  const productTypeMatches: string[] = [];
  const lowerText = fullText.toLowerCase();
  for (const kw of productTypeKeywords) {
    if (lowerText.includes(kw)) productTypeMatches.push(kw);
  }

  // Extract warning text (typical warning phrases)
  const warningPhrases: string[] = [];
  const warningRE =
    /Not to be used[^.;]*/gi;
  let wm: RegExpExecArray | null;
  warningRE.lastIndex = 0;
  while ((wm = warningRE.exec(fullText)) !== null) {
    warningPhrases.push(wm[0].trim());
  }

  const restriction: Restriction = {
    productType: productTypeMatches.length > 0 ? productTypeMatches.join(', ') : undefined,
    maxConcentration: concMatches.length > 0 ? concMatches.join(' / ') : undefined,
    warnings: warningPhrases.length > 0 ? warningPhrases.slice(0, 3).join('; ') : undefined,
  };

  if (!restriction.productType && !restriction.maxConcentration && !restriction.warnings) {
    return [];
  }
  return [restriction];
}

interface Block {
  ref: string;
  lines: string[];
}

function collectBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

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
  return blocks;
}

export function parseAnnexComplex(text: string, annexId: AnnexId): Rule[] {
  const lines = text.split('\n');
  const blocks = collectBlocks(lines);
  const rules: Rule[] = [];

  for (const block of blocks) {
    const fullText = block.lines.join(' ');
    if (/moved or deleted/i.test(fullText)) continue;

    const casNumbers = [...new Set((fullText.match(CAS_RE) || []))];
    const ecNumbers = [...new Set((fullText.match(EC_RE) || []))];

    const { name: firstName, inci } = extractNamesFromFirstLine(block.lines[0], block.ref);
    const continuation = extractContinuationName(block.lines);

    const fullName = [firstName, continuation].filter(Boolean).join(' ').replace(/\s{2,}/g, ' ').trim();

    const restrictions = extractRestrictions(block.lines);

    rules.push({
      id: `annex-${annexId.toLowerCase()}-${block.ref}`,
      annex: annexId,
      entryNumber: block.ref,
      substanceNames: fullName ? [fullName] : [],
      inciName: inci || undefined,
      casNumbers,
      ecNumbers,
      status: 'RESTRICTED',
      restrictions,
    });
  }

  return rules;
}
