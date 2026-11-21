import { wordTokens } from "./normalize.js";

export interface SimilarityConfig {
  jaccardMin: number;
  simhashMaxDistance: number;
}

export const DEFAULT_SIMILARITY: SimilarityConfig = {
  jaccardMin: 0.55,
  simhashMaxDistance: 8,
};

const FNV_OFFSET = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;
const MASK_64 = 0xffffffffffffffffn;

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

export function fnv1a64(value: string): bigint {
  let hash = FNV_OFFSET;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash;
}

/** 64-bit SimHash over the set of tokens. Order does not matter. */
export function simhash(tokens: readonly string[]): bigint {
  const unique = [...new Set(tokens)];
  if (unique.length === 0) return 0n;
  const weights = new Array<number>(64).fill(0);
  for (const token of unique) {
    const hash = fnv1a64(token);
    for (let bit = 0; bit < 64; bit += 1) {
      const on = ((hash >> BigInt(bit)) & 1n) === 1n;
      const current = weights[bit] ?? 0;
      weights[bit] = current + (on ? 1 : -1);
    }
  }
  let out = 0n;
  for (let bit = 0; bit < 64; bit += 1) {
    if ((weights[bit] ?? 0) > 0) out |= 1n << BigInt(bit);
  }
  return out;
}

export function hamming(left: bigint, right: bigint): number {
  let value = (left ^ right) & MASK_64;
  let count = 0;
  while (value > 0n) {
    count += Number(value & 1n);
    value >>= 1n;
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
