import { performance } from "node:perf_hooks";

export function getLicensePlate(n: number, verbose = false): string {
  if (n < 0) throw new Error("n must be non-negative");

  const pow10 = [1, 10, 100, 1000, 10000, 100000, 1000000] as const;
  const pow26 = [1, 26, 26 ** 2, 26 ** 3, 26 ** 4, 26 ** 5, 26 ** 6] as const;

  // Compute total number of combinations for each "block" (letters = 0..6)
  const blocks: number[] = [];
  for (let letters = 0; letters <= 6; letters++) {
    const digits = 6 - letters;
    const count = pow10[digits]! * pow26[letters]!;
    blocks.push(count);
  }

  if (verbose) {
    console.log("\n--- Block configuration ---");
    blocks.forEach((count, i) => {
      console.log(
        `Block ${i}: digits=${6 - i}, letters=${i}, combinations=${count.toLocaleString()}`
      );
    });
  }

  // Find the correct block for given n
  let block = 0;
  let offset = n;

  if (verbose) console.log(`\nFinding block for n = ${n.toLocaleString()}:`);
  while (block < blocks.length && offset >= blocks[block]!) {
    if (verbose) {
      console.log(
        `  n still >= block[${block}] (${blocks[block]!.toLocaleString()}) → subtract and continue`
      );
    }
    offset -= blocks[block]!;
    block++;
  }

  if (block === blocks.length) throw new Error("n exceeds total sequence length");

  const digitsCount = 6 - block;
  const lettersCount = block;

  if (verbose) {
    console.log(`\nResult:`);
    console.log(`  Landed in block #${block}`);
    console.log(`  digitsCount = ${digitsCount}`);
    console.log(`  lettersCount = ${lettersCount}`);
    console.log(`  offset within this block = ${offset.toLocaleString()}`);
  }

  const numBase = pow10[digitsCount]!;
  const letterPart = Math.floor(offset / numBase);
  const digitPart = offset % numBase;

  if (verbose) {
    console.log(`\n  numBase = ${numBase}`);
    console.log(`  letterPart = ${letterPart}`);
    console.log(`  digitPart = ${digitPart}`);
  }

  const digitsStr = digitsCount > 0 ? digitPart.toString().padStart(digitsCount, "0") : "";

  let lettersStr = "";
  let num = letterPart;
  for (let i = 0; i < lettersCount; i++) {
    const charCode = 65 + (num % 26);
    lettersStr = String.fromCharCode(charCode) + lettersStr;
    num = Math.floor(num / 26);
  }
  lettersStr = lettersStr.padStart(lettersCount, "A");

  const result = digitsStr + lettersStr;
  if (verbose) console.log(`\n✅ Final plate = ${result}\n`);
  return result;
}

/* -------------------------------------------------------------------------- */
/*                            EXPLANATION DEMO RUN                            */
/* -------------------------------------------------------------------------- */

console.log("=== EXPLANATION MODE ===");
getLicensePlate(0, true);
getLicensePlate(999_999, true);
getLicensePlate(1_000_000, true);
getLicensePlate(3_600_000, true);
getLicensePlate(308_915_775, true);

/* -------------------------------------------------------------------------- */
/*                              VALIDATION TESTS                              */
/* -------------------------------------------------------------------------- */

function assertEqual(actual: string, expected: string, msg: string) {
  if (actual !== expected) {
    console.error(`❌ ${msg} → Expected: ${expected}, Got: ${actual}`);
    process.exit(1);
  } else {
    console.log(`✅ ${msg}`);
  }
}

console.log("=== AUTOMATED DMV SEQUENCE VALIDATION ===");

// 6-digit block
assertEqual(getLicensePlate(0), "000000", "Start of sequence");
assertEqual(getLicensePlate(999_999), "999999", "End of pure digits");

// ---- 5 digits + 1 letter block (each letter = 100,000 plates) ----
assertEqual(getLicensePlate(1_000_000), "00000A", "After 999999 → 00000A");
assertEqual(getLicensePlate(1_000_001), "00001A", "Digits increment first within A-block");
assertEqual(getLicensePlate(1_099_999), "99999A", "End of A-block");
assertEqual(getLicensePlate(1_100_000), "00000B", "Start of B-block");
assertEqual(getLicensePlate(3_599_999), "99999Z", "End of all single-letter plates (…Z)");

// ---- 4 digits + 2 letters block starts next ----
assertEqual(getLicensePlate(3_600_000), "0000AA", "Start of two-letter plates");
assertEqual(getLicensePlate(3_609_999), "9999AA", "End of first AA digits span");
assertEqual(getLicensePlate(3_610_000), "0000AB", "Next two-letter pair begins (AB)");

console.log("\n✅ All transitions and logic verified.\n");

/* -------------------------------------------------------------------------- */
/*                           ILLUSTRATIVE EXAMPLES                            */
/* -------------------------------------------------------------------------- */

console.log("=== DMV SEQUENCE EXAMPLES ===");
console.log("  0 →", getLicensePlate(0));
console.log("  1 →", getLicensePlate(1));
console.log("  999999 →", getLicensePlate(999_999));
console.log("  1,000,000 →", getLicensePlate(1_000_000));
console.log("  1,099,999 →", getLicensePlate(1_099_999));
console.log("  1,100,000 →", getLicensePlate(1_100_000));
console.log("  3,599,999 →", getLicensePlate(3_599_999));
console.log("  3,600,001 →", getLicensePlate(3_600_001));
console.log("  3_609_999 →", getLicensePlate(3_609_999));

/* -------------------------------------------------------------------------- */
/*                           PERFORMANCE BENCHMARK                            */
/* -------------------------------------------------------------------------- */

function benchmarkMultiple(): void {
  const runsArray = [10, 100, 1_000, 10_000, 100_000, 1_000_000];
  console.log("\n=== PERFORMANCE BENCHMARK ===");

  for (const runs of runsArray) {
    // Warm-up
    getLicensePlate(123_456);

    const start = performance.now();
    for (let i = 0; i < runs; i++) {
      const n = Math.floor(Math.random() * 10_000_000);
      getLicensePlate(n);
    }
    const end = performance.now();

    const totalMs = end - start;
    const avgMs = totalMs / runs;
    console.log(`\n${runs.toLocaleString()} runs → Total: ${totalMs.toFixed(3)} ms | Avg: ${avgMs.toFixed(6)} ms`);
  }
}

benchmarkMultiple();

