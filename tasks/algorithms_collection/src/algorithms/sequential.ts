import { POW10, POW26, digitsPadded, lettersFromIndex } from "./shared.js";

export function getPlateC(n: number): string {
  if (n < 0) throw new Error("n must be non-negative");

  let lettersCount = 0;
  let letterVal = 0;
  let digitsCount = 6;
  let digits = 0;
  let digitsMax = POW10[digitsCount]! - 1;

  for (let i = 0; i < n; i++) {
    if (digits < digitsMax) {
      digits += 1;
    } else {
      digits = 0;
      if (lettersCount === 0) {
        lettersCount = 1;
        letterVal = 0;
      } else {
        const letterMax = POW26[lettersCount]! - 1;
        if (letterVal < letterMax) {
          letterVal += 1;
        } else {
          lettersCount += 1;
          if (lettersCount > 6) throw new Error("sequence exceeded 6 letters");
          letterVal = 0;
        }
      }
      digitsCount = 6 - lettersCount;
      digitsMax = POW10[digitsCount]! - 1;
    }
  }

  return digitsPadded(digits, digitsCount) + lettersFromIndex(letterVal, lettersCount);
}
