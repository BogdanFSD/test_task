import { POW10, computeBlocks, digitsPadded, lettersFromIndex } from "./shared.js";

export function getPlateB(n: number): string {
  if (n < 0) throw new Error("n must be non-negative");

  const blocks = computeBlocks();
  const pref: number[] = [];
  let acc = 0;
  for (const b of blocks) {
    acc += b;
    pref.push(acc);
  }

  let lo = 0, hi = pref.length - 1, block = pref.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (n < pref[mid]!) {
      block = mid;
      hi = mid - 1;
    } else lo = mid + 1;
  }
  if (block === pref.length) throw new Error("n exceeds total sequence length");

  const startOfBlock = block === 0 ? 0 : pref[block - 1]!;
  const offset = n - startOfBlock;

  const digitsCount = 6 - block;
  const lettersCount = block;
  const numBase = POW10[digitsCount]!;

  const letterPart = Math.floor(offset / numBase);
  const digitPart = offset % numBase;

  return digitsPadded(digitPart, digitsCount) + lettersFromIndex(letterPart, lettersCount);
}
