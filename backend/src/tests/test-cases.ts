import "dotenv/config";
import { runFromText } from "../pipeline/run.js";

/**
 * Reference test cases for the EU Cosmetics Regulation compliance pipeline.
 * Scope is limited to the original Regulation (EC) No 1223/2009.
 *
 * Each test case defines:
 * - An ingredient, concentration, and product type
 * - Acceptable output statuses for this scenario
 * - A concise rationale with annex and entry context
 */

interface TestCase {
  name: string;
  ingredient: string;
  concentration: string;
  productType: string;
  expectedStatus: string[]; // Accept any listed status as a valid outcome.
  rationale: string;
}

const TEST_CASES: TestCase[] = [
  {
    name: "Boric acid 1% — restricted (Annex III)",
    ingredient: "Boric acid",
    concentration: "1%",
    productType: "Leave-on skin care",
    expectedStatus: ["RESTRICTED"],
    rationale: "Annex III: Boric acid restricted with conditions.",
  },
  {
    name: "Hydroquinone 2% skin care — exceeds limit (Annex III)",
    ingredient: "Hydroquinone",
    concentration: "2%",
    productType: "Leave-on skin care",
    expectedStatus: ["EXCEEDS_LIMIT"],
    rationale: "Annex III: Max 0.3% hair dye / 0.02% nail systems. 2% exceeds all limits.",
  },
  {
    name: "Hydrogen peroxide 12.5% hair dye — exceeds limit (Annex III)",
    ingredient: "Hydrogen peroxide",
    concentration: "12.5%",
    productType: "Hair dye",
    expectedStatus: ["EXCEEDS_LIMIT"],
    rationale: "Annex III: Max 12% for hair products. 12.5% exceeds limit.",
  },
  {
    name: "Salicylic acid 2% — restricted (Annex III)",
    ingredient: "Salicylic acid",
    concentration: "2%",
    productType: "Leave-on skin care",
    expectedStatus: ["RESTRICTED"],
    rationale: "Annex III: Max 2%.",
  },
  {
    name: "Phenoxyethanol 1% — restricted (Annex V)",
    ingredient: "Phenoxyethanol",
    concentration: "1%",
    productType: "Leave-on skin care",
    expectedStatus: ["RESTRICTED"],
    rationale: "Annex V: Max 1%.",
  },
  {
    name: "Formaldehyde 0.3% — restricted exception",
    ingredient: "Formaldehyde",
    concentration: "0.3%",
    productType: "Rinse-off",
    expectedStatus: ["RESTRICTED", "EXCEEDS_LIMIT"],
    rationale: "Annex V: Max 0.2% free formaldehyde in rinse-off.",
  },
  {
    name: "Octocrylene 10% — restricted UV filter (Annex VI)",
    ingredient: "Octocrylene",
    concentration: "10%",
    productType: "Sunscreen",
    expectedStatus: ["RESTRICTED"],
    rationale: "Annex VI: Max 10%.",
  },
  {
    name: "Glycerin — not listed",
    ingredient: "Glycerin",
    concentration: "10%",
    productType: "Skin care",
    expectedStatus: ["NOT_FOUND"],
    rationale: "Not listed in any annex — generally allowed under Article 3.",
  },
  {
    name: "Retinol — not listed in original regulation",
    ingredient: "Retinol",
    concentration: "0.3%",
    productType: "Skin care",
    expectedStatus: ["NOT_FOUND"],
    rationale: "Not listed in original 1223/2009 text.",
  },
];

async function runTest(testCase: TestCase, index: number): Promise<boolean> {
  const label = `[${index + 1}/${TEST_CASES.length}] ${testCase.name}`;
  console.log(`\n${"═".repeat(70)}`);
  console.log(`🧪 ${label}`);
  console.log(`   Ingredient:    ${testCase.ingredient}`);
  console.log(`   Concentration: ${testCase.concentration}`);
  console.log(`   Product type:  ${testCase.productType}`);
  console.log(`   Expected:      ${testCase.expectedStatus.join(" or ")}`);
  console.log(`   Rationale:     ${testCase.rationale}`);
  console.log(`${"─".repeat(70)}`);

  const startTime = Date.now();

  try {
    const text = `${testCase.ingredient} ${testCase.concentration} in ${testCase.productType}`;
    const { verdict } = await runFromText(text);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const passed = testCase.expectedStatus.includes(verdict.status);

    if (passed) {
      console.log(`   ✅ PASS — Engine returned: ${verdict.status}  (${elapsed}s)`);
    } else {
      console.log(`   ❌ FAIL — Engine returned: ${verdict.status}, expected: ${testCase.expectedStatus.join(" or ")}  (${elapsed}s)`);
    }

    if (verdict.conditions.length > 0) {
      console.log(`   Conditions: ${verdict.conditions.join("; ")}`);
    }
    if (verdict.annexReferences.length > 0) {
      console.log(`   References:`);
      for (const ref of verdict.annexReferences) {
        console.log(`     • ${ref.annex} #${ref.entry}: ${ref.description.slice(0, 100)}`);
      }
    }
    console.log(`   Confidence: ${verdict.confidence}`);

    return passed;
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   💥 ERROR (${elapsed}s): ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║  🧴 EU Cosmetics Regulation Compliance Pipeline Test Suite          ║
║  Running ${TEST_CASES.length} test cases against the deterministic rule engine     ║
╚══════════════════════════════════════════════════════════════════════╝`);

  const results: boolean[] = [];

  for (let i = 0; i < TEST_CASES.length; i++) {
    const passed = await runTest(TEST_CASES[i], i);
    results.push(passed);
  }

  const passed = results.filter(Boolean).length;
  const failed = results.length - passed;

  console.log(`\n${"═".repeat(70)}`);
  console.log(`\n📊 TEST RESULTS SUMMARY`);
  console.log(`${"─".repeat(40)}`);

  TEST_CASES.forEach((tc, i) => {
    const icon = results[i] ? "✅" : "❌";
    console.log(`   ${icon} ${tc.name}`);
  });

  console.log(`${"─".repeat(40)}`);
  console.log(`   Total:  ${results.length}`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Rate:   ${((passed / results.length) * 100).toFixed(0)}%\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
