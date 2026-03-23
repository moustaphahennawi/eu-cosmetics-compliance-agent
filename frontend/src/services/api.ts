// ─── Types aligned with backend Verdict ──────────────────────────────────────

export interface ParsedQuery {
  name: string;
  cas?: string;
  concentration?: number;
  productType?: string;
}

export interface AnnexReference {
  annex: string;
  entry: string;
  description: string;
}

export type ComplianceStatus =
  | 'PROHIBITED'
  | 'EXCEEDS_LIMIT'
  | 'RESTRICTED'
  | 'ALLOWED'
  | 'NOT_FOUND';

export interface Verdict {
  status: ComplianceStatus;
  ingredient: string;
  concentration?: number;
  productType?: string;
  maxConcentrationRaw?: string;
  maxConcentrationParsed?: number;
  conditions: string[];
  warnings: string[];
  annexReferences: AnnexReference[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source: string;
  matchedRulesCount: number;
}

export interface NLCheckResult {
  query: ParsedQuery;
  verdict: Verdict;
}

// ─── API calls ────────────────────────────────────────────────────────────────

const API_BASE = '/api';

export async function checkIngredientNL(text: string): Promise<NLCheckResult> {
  const response = await fetch(`${API_BASE}/check-ingredient`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    throw new Error(payload.details || payload.error || 'Request failed');
  }

  return response.json();
}

async function parseErrorPayload(
  response: Response,
): Promise<{ error?: string; details?: string }> {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object') return payload as { error?: string; details?: string };
  } catch { /* non-JSON error body */ }
  return {};
}
