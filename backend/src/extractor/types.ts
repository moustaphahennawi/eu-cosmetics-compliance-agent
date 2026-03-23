export type AnnexId = 'II' | 'III' | 'IV' | 'V' | 'VI';
export type RuleStatus = 'PROHIBITED' | 'RESTRICTED' | 'ALLOWED';

export interface Restriction {
  productType?: string;
  maxConcentration?: string;
  conditions?: string;
  warnings?: string;
}

export interface Rule {
  id: string;           // e.g. "annex-ii-1", "annex-iii-1a"
  annex: AnnexId;
  entryNumber: string;  // "1", "1a", "584"
  substanceNames: string[];
  inciName?: string;    // Common Ingredients Glossary name
  casNumbers: string[];
  ecNumbers: string[];
  status: RuleStatus;
  restrictions: Restriction[];
  // Annex IV only
  ciNumber?: string;
  colour?: string;
}
