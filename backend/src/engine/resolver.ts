/**
 * Resolver — looks up an IngredientQuery against the rules.json database
 * and returns all matching rules with their match strategy.
 *
 * Pure function: given the same query and the same rules array, the output
 * is always identical.  The rules array is loaded once at module init.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Rule } from '../extractor/types.js';
import type { IngredientQuery, MatchedRule, MatchStrategy } from './types.js';
import {
  matchesCASList,
  matchesINCI,
  matchesNameExact,
  matchesNamePartial,
} from '../utils/match.js';

// ─── Rules database (loaded once) ────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.resolve(__dirname, '../data/rules.json');

/** Singleton: all rules loaded from rules.json at module import time. */
const ALL_RULES: Rule[] = JSON.parse(readFileSync(RULES_PATH, 'utf-8')) as Rule[];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve an ingredient query to all matching rules.
 *
 * Matching priority:
 *   1. CAS exact match  → strategy 'cas'       (highest confidence)
 *   2. INCI exact match → strategy 'inci'
 *   3. Name exact match → strategy 'name-exact'
 *   4. Name partial     → strategy 'name-partial' (lowest confidence)
 *
 * A rule can only appear once in the result (deduped by ruleId).
 *
 * @param query  Structured ingredient query.
 * @param rules  Rules to search (defaults to ALL_RULES from rules.json).
 * @returns      Array of matched rules, sorted by annex priority (II first).
 */
export function resolve(
  query: IngredientQuery,
  rules: Rule[] = ALL_RULES,
): MatchedRule[] {
  const seen = new Set<string>();
  const results: MatchedRule[] = [];

  function add(rule: Rule, strategy: MatchStrategy, value: string) {
    if (seen.has(rule.id)) return;
    seen.add(rule.id);
    const restriction = rule.restrictions[0];
    results.push({
      ruleId: rule.id,
      annex: rule.annex,
      entryNumber: rule.entryNumber,
      substanceName: rule.substanceNames[0] ?? rule.inciName ?? rule.id,
      matchedBy: strategy,
      matchedValue: value,
      maxConcentration: restriction?.maxConcentration,
      productType: restriction?.productType,
      conditions: restriction?.conditions,
      warnings: restriction?.warnings,
      ciNumber: rule.ciNumber,
      colour: rule.colour,
    });
  }

  for (const rule of rules) {
    // 1. CAS exact
    if (query.cas && matchesCASList(query.cas, rule.casNumbers)) {
      add(rule, 'cas', query.cas);
      continue;
    }

    // 2. INCI exact
    if (matchesINCI(query.name, rule.inciName)) {
      add(rule, 'inci', query.name);
      continue;
    }

    // 3. Name exact
    if (matchesNameExact(query.name, rule.substanceNames)) {
      add(rule, 'name-exact', query.name);
      continue;
    }

    // 4. Name partial — only for non-Annex II rules to limit false positives
    //    (a false "PROHIBITED" match is much worse than a false "RESTRICTED" miss)
    if (rule.annex !== 'II' && matchesNamePartial(query.name, rule.substanceNames)) {
      add(rule, 'name-partial', query.name);
    }
  }

  // Sort: Annex II first (highest priority in evaluation), then by annex order
  const ANNEX_PRIORITY: Record<string, number> = { II: 0, III: 1, IV: 2, V: 3, VI: 4 };
  results.sort((a, b) => (ANNEX_PRIORITY[a.annex] ?? 9) - (ANNEX_PRIORITY[b.annex] ?? 9));

  return results;
}
