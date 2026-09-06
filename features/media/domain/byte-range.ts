/** Single byte ranges used by native media controls; unknown syntax is left to storage. */
export function isUnsatisfiableByteRange(range: string, length: string | null): boolean {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || !length || !/^\d+$/.test(length)) return false;
  const size = BigInt(length);
  if (!match[1] && !match[2]) return true;
  if (size === BigInt(0)) return true;
  if (!match[1]) return BigInt(match[2]) === BigInt(0);
  const start = BigInt(match[1]);
  return start >= size || Boolean(match[2] && BigInt(match[2]) < start);
}
