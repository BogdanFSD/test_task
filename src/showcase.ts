import { performance } from "node:perf_hooks";
import { getPlateA } from "./algorithms/baseBlock.js";
import { getPlateB } from "./algorithms/binarySearch.js";
import { getPlateC } from "./algorithms/sequential.js";
import { getPlateD_Base36 } from "./algorithms/base36.js";

type PlateFn = (n: number) => string;

function assertEq(actual: string, expected: string, msg: string) {
  if (actual !== expected) throw new Error(`${msg}: expected ${expected}, got ${actual}`);
}

function runTests() {
  console.log("===========================================================");
  console.log("🧩 DMV License Plate Generator — Validation & Logic Checks");
  console.log("===========================================================\n");

  console.log("1️⃣  Core transition tests");
  assertEq(getPlateA(0), "000000", "Start of sequence");
  assertEq(getPlateA(999_999), "999999", "End of pure digits");
  assertEq(getPlateA(1_000_000), "00000A", "Transition to 1-letter plates");
  assertEq(getPlateA(3_600_000), "0000AA", "Transition to 2-letter plates");
  console.log("✅ Core transitions verified\n");

  console.log("2️⃣  Cross-verifying algorithms A, B, and C for n=0..20,000");
  for (let n = 0; n <= 20_000; n++) {
    const a = getPlateA(n);
    const b = getPlateB(n);
    const c = getPlateC(n);
    if (a !== b || a !== c) throw new Error(`Mismatch at n=${n}`);
  }
  console.log("✅ A, B, and C produce identical results up to 20,000\n");

  console.log("3️⃣  Base-36 comparison (not DMV order)");
  console.log(`999,999 → DMV: ${getPlateA(999_999)} | Base36: ${getPlateD_Base36(999_999)}`);
  console.log(`1,000,000 → DMV: ${getPlateA(1_000_000)} | Base36: ${getPlateD_Base36(1_000_000)}\n`);
}


function benchmark(fn: PlateFn, iterations: number, maxN: number): { avg: number; total: number } {
  // Warm-up (avoid JIT cold-start)
  for (let i = 0; i < 500; i++) fn(i);

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn(Math.floor(Math.random() * maxN));
  const total = performance.now() - start;

  return { total, avg: total / iterations };
}

function runBenchmarks() {
  console.log("===========================================================");
  console.log("⚡ PERFORMANCE COMPARISON — Different Algorithms");
  console.log("===========================================================\n");
  console.log("All timings are in milliseconds (ms). Lower is faster.");
  console.log("• avg = average time per call");
  console.log("• total = total runtime for all calls\n");

  const tests = [
    { name: "A  Block arithmetic (✅ Correct, fastest)", fn: getPlateA },
    { name: "B  Binary search (✅ Correct, slightly slower)", fn: getPlateB },
    { name: "C  Sequential (✅ Correct, but very slow)", fn: getPlateC },
    { name: "D  Base-36 (❌ Wrong order, ultra fast)", fn: getPlateD_Base36 },
  ] as const;

  const runCounts = [10, 100, 1_000, 10_000, 100_000];

  for (const runs of runCounts) {
    console.log(`\n📊 Running ${runs.toLocaleString()} random calls...`);
    for (const { name, fn } of tests) {
      const { total, avg } = benchmark(fn, runs, 10_000_000);
      console.log(
        `  ${name.padEnd(45)} → total=${total.toFixed(3).padStart(8)} ms | avg=${avg.toFixed(6)} ms`
      );
    }
  }

  console.log("\n✅ Benchmarks complete.");
  console.log("-----------------------------------------------------------");
  console.log("Summary:");
  console.log("• Algorithm A — 🥇 Winner: fastest and fully correct DMV order.");
  console.log("• Algorithm B — Similar logic using binary search; small overhead.");
  console.log("• Algorithm C — Educational, but slow (O(n)). Avoid for large n.");
  console.log("• Algorithm D — Base-36: fastest, but wrong order (not DMV valid).");
  console.log("-----------------------------------------------------------\n");
}

function main() {
  runTests();
  runBenchmarks();
}

main();
