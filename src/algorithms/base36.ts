const BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function getPlateD_Base36(n: number): string {
  let x = n;
  let out = "";
  for (let i = 0; i < 6; i++) {
    out = BASE36[x % 36] + out;
    x = Math.floor(x / 36);
  }
  return out;
}
