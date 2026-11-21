import { wordTokens } from "./normalize.js";

export interface SimilarityConfig {
  jaccardMin: number;
  simhashMaxDistance: number;
}

export const DEFAULT_SIMILARITY: SimilarityConfig = {
  jaccardMin: 0.55,
  simhashMaxDistance: 8,
};

interface Word64 {
  hi: number;
  lo: number;
}

const FNV_OFFSET: Word64 = { hi: 0xcbf29ce4, lo: 0x84222325 };
const FNV_PRIME: Word64 = { hi: 0x100, lo: 0x1b3 };

export function shingles(normalized: string, size = 2): string[] {
  const words = wordTokens(normalized);
  if (words.length === 0) return [];
  if (words.length < size) return [words.join(" ")];
  const grams: string[] = [];
  for (let index = 0; index <= words.length - size; index += 1) {
    grams.push(words.slice(index, index + size).join(" "));
  }
  return grams;
}

export function jaccard(left: readonly string[], right: readonly string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Force a 32-bit unsigned value. Bitwise operators are only applied to this result. */
function uint32(value: number): number {
  return value >>> 0;
}

export function fnv1a64(value: string): Word64 {
  let hash: Word64 = { hi: FNV_OFFSET.hi, lo: FNV_OFFSET.lo };
  for (let index = 0; index < value.length; index += 1) {
    const code = uint32(value.charCodeAt(index));
    hash = { hi: hash.hi, lo: uint32(hash.lo ^ code) };
    hash = mul64(hash, FNV_PRIME);
  }
  return hash;
}

/**
 * 32×32 → 64. The cross term can exceed 2^32, so its high half is taken with
 * division. `>>>` would convert that term to 32 bits first and drop the carry.
 */
function mul32(left: number, right: number): Word64 {
  const a = uint32(left);
  const b = uint32(right);
  const aLo = a & 0xffff;
  const aHi = a >>> 16;
  const bLo = b & 0xffff;
  const bHi = b >>> 16;
  const low = aLo * bLo;
  const mid = (low >>> 16) + aLo * bHi + aHi * bLo;
  const midLo = mid % 0x10000;
  const midHi = Math.floor(mid / 0x10000);
  return {
    hi: uint32(aHi * bHi + midHi),
    lo: uint32((midLo << 16) | (low & 0xffff)),
  };
}

function mul64(left: Word64, right: Word64): Word64 {
  const low = mul32(left.lo, right.lo);
  const hi = uint32(Math.imul(left.lo, right.hi) + Math.imul(left.hi, right.lo) + low.hi);
  return { hi, lo: low.lo };
}

/** 64-bit SimHash over the set of tokens. Order does not matter. */
export function simhash(tokens: readonly string[]): Word64 {
  const unique = [...new Set(tokens)];
  const weights = new Array<number>(64).fill(0);
  for (const token of unique) {
    const hash = fnv1a64(token);
    for (let bit = 0; bit < 64; bit += 1) {
      const current = weights[bit] ?? 0;
      weights[bit] = current + (bitIsSet(hash, bit) ? 1 : -1);
    }
  }
  let hi = 0;
  let lo = 0;
  for (let bit = 0; bit < 64; bit += 1) {
    if ((weights[bit] ?? 0) <= 0) continue;
    if (bit < 32) lo = uint32(lo | (1 << bit));
    else hi = uint32(hi | (1 << (bit - 32)));
  }
  return { hi, lo };
}

function bitIsSet(word: Word64, bit: number): boolean {
  const source = bit < 32 ? word.lo : word.hi;
  const shift = bit < 32 ? bit : bit - 32;
  return ((source >>> shift) & 1) === 1;
}

export function hamming(left: Word64, right: Word64): number {
  return popcount(uint32(left.lo ^ right.lo)) + popcount(uint32(left.hi ^ right.hi));
}

function popcount(value: number): number {
  let bits = uint32(value);
  let count = 0;
  while (bits !== 0) {
    count += bits & 1;
    bits >>>= 1;
  }
  return count;
}

export function textSimilar(
  leftNormalized: string,
  rightNormalized: string,
  config: SimilarityConfig = DEFAULT_SIMILARITY,
): boolean {
  if (!leftNormalized || !rightNormalized) return false;
  if (leftNormalized === rightNormalized) return true;
  const leftShingles = shingles(leftNormalized);
  const rightShingles = shingles(rightNormalized);
  if (jaccard(leftShingles, rightShingles) >= config.jaccardMin) return true;
  const distance = hamming(
    simhash(wordTokens(leftNormalized)),
    simhash(wordTokens(rightNormalized)),
  );
  if (distance > config.simhashMaxDistance) return false;
  // A small SimHash distance still needs some shared shingles, so unrelated
  // short strings do not collapse.
  return jaccard(leftShingles, rightShingles) >= 0.2;
}
