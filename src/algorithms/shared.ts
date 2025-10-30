export const POW10 = [1, 10, 100, 1000, 10000, 100000, 1000000] as const;
export const POW26 = [1, 26, 26**2, 26**3, 26**4, 26**5, 26**6] as const;

export function digitsPadded(num: number, digitsCount: number): string {
  return digitsCount > 0 ? num.toString().padStart(digitsCount, "0") : "";
}

export function lettersFromIndex(idx: number, lettersCount: number): string {
  let s = "";
  let x = idx;
  for (let i = 0; i < lettersCount; i++) {
    const ch = 65 + (x % 26);
    s = String.fromCharCode(ch) + s;
    x = Math.floor(x / 26);
  }
  return s.padStart(lettersCount, "A");
}

export function computeBlocks(): number[] {
  const blocks: number[] = [];
  for (let letters = 0; letters <= 6; letters++) {
    const digits = 6 - letters;
    blocks.push(POW10[digits]! * POW26[letters]!);
  }
  return blocks;
}
