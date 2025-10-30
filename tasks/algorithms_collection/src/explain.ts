import { computeBlocks, POW10, digitsPadded, lettersFromIndex } from "./algorithms/shared.js";

/**
 * Verbose explanation of how a given plate number (n) is decoded
 * into its correct block of digits/letters.
 */
export function explain(n: number): void {
  if (n < 0) throw new Error("n must be non-negative");

  const blocks = computeBlocks();

  console.log("\n--- DMV LICENSE PLATE EXPLAINER ---");
  console.log(`Target n = ${n.toLocaleString()}\n`);

  console.log("--- Block configuration ---");
  blocks.forEach((count, i) => {
    console.log(
      `Block ${i}: digits=${6 - i}, letters=${i}, combinations=${count.toLocaleString()}`
    );
  });

  
  let block = 0;
  let offset = n;
  while (block < blocks.length && offset >= blocks[block]!) {
    console.log(
      `\nSubtracting block[${block}] (${blocks[block]!.toLocaleString()}) → offset decreases`
    );
    offset -= blocks[block]!;
    block++;
  }

  if (block === blocks.length) {
    console.error("\n❌ The sequence limit (501,363,136 plates) has been exceeded!");
    return;
  }

  const digitsCount = 6 - block;
  const lettersCount = block;
  const numBase = POW10[digitsCount]!;

  const letterPart = Math.floor(offset / numBase);
  const digitPart = offset % numBase;

  console.log("\n--- RESULT ---");
  console.log(`Block index: ${block}`);
  console.log(`Digits count: ${digitsCount}`);
  console.log(`Letters count: ${lettersCount}`);
  console.log(`Offset inside block: ${offset.toLocaleString()}`);
  console.log(`Num base: ${numBase}`);
  console.log(`Letter part: ${letterPart}`);
  console.log(`Digit part: ${digitPart}`);

  const result =
    digitsPadded(digitPart, digitsCount) + lettersFromIndex(letterPart, lettersCount);
  console.log(`\n✅ Final plate = ${result}\n`);
}

/* Run interactively from command line:
   npx tsx src/explain.ts 3600000
*/

if (process.argv[2]) {
  const n = parseInt(process.argv[2], 10);
  explain(n);
} else {
  console.log("Usage: npx tsx src/explain.ts <n>");
  console.log("Example: npx tsx src/explain.ts 3600000");
}
