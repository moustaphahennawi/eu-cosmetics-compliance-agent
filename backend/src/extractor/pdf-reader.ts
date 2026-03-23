import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_PATH = path.resolve(__dirname, '../assets/CELEX_32009R1223_EN_TXT.pdf');

export function extractPdfText(): string {
  return execSync(`pdftotext -layout "${PDF_PATH}" -`, { maxBuffer: 50 * 1024 * 1024 }).toString();
}

const ANNEX_NAMES = ['II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

export function splitByAnnex(text: string): Record<string, string> {
  const positions: { name: string; pos: number }[] = [];

  for (const name of ANNEX_NAMES) {
    // Match "ANNEX II" as a standalone header (surrounded by whitespace/newlines)
    const regex = new RegExp(`\\bANNEX\\s+${name}\\b`);
    const match = text.search(regex);
    if (match !== -1) {
      positions.push({ name, pos: match });
    }
  }

  positions.sort((a, b) => a.pos - b.pos);

  const result: Record<string, string> = {};
  for (let i = 0; i < positions.length; i++) {
    const { name, pos } = positions[i];
    if (name === 'VII') break; // stop before Annex VII (symbols, not ingredients)
    const nextPos = i + 1 < positions.length ? positions[i + 1].pos : text.length;
    result[name] = text.slice(pos, nextPos);
  }

  return result;
}

