import { POW10, computeBlocks, digitsPadded, lettersFromIndex } from "./shared.js";

export function getPlateA(n: number): string {
  if (n < 0) throw new Error("n must be non-negative");

  const blocks = computeBlocks();
  let block = 0;
  let offset = n;

  while (block < blocks.length && offset >= blocks[block]!) {
    offset -= blocks[block]!;
    block++;
  }
  if (block === blocks.length) throw new Error("n exceeds total sequence length");

  const digitsCount = 6 - block;
  const lettersCount = block;
  const numBase = POW10[digitsCount]!;

  const letterPart = Math.floor(offset / numBase);
  const digitPart = offset % numBase;

  return digitsPadded(digitPart, digitsCount) + lettersFromIndex(letterPart, lettersCount);
}
