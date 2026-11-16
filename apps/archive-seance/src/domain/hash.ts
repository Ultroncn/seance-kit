/** Stable 64-bit-ish content hash (two FNV-1a passes) as hex. Not cryptographic. */
export function contentHash(input: string): string {
  let a = 0x811c9dc5;
  let b = 0x01234567;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 13);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}
