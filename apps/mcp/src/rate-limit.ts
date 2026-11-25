// SPDX-License-Identifier: MIT
import { createHash } from "node:crypto";

export interface RateLimitAllowed {
  allowed: true;
  remaining: number;
}

export interface RateLimitBlocked {
  allowed: false;
  remaining: 0;
  retryAfterMs: number;
}

export type RateLimitDecision = RateLimitAllowed | RateLimitBlocked;

/**
 * In-memory fixed window. Keys are caller-supplied and should already be
 * hashes. Nothing here is written to disk. Expired keys are dropped.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly maxKeys = 5_000,
  ) {
    if (limit < 1) throw new Error("rate limit must be at least 1");
    if (windowMs < 1) throw new Error("rate limit window must be positive");
  }

  check(key: string, now = Date.now()): RateLimitDecision {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((stamp) => stamp >= cutoff);
    if (recent.length >= this.limit) {
      const oldest = recent[0] ?? now;
      this.hits.set(key, recent);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, oldest + this.windowMs - now),
      };
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) this.prune(cutoff);
    return { allowed: true, remaining: this.limit - recent.length };
  }

  reset(): void {
    this.hits.clear();
  }

  private prune(cutoff: number): void {
    for (const [key, stamps] of this.hits) {
      const recent = stamps.filter((stamp) => stamp >= cutoff);
      if (recent.length === 0) this.hits.delete(key);
      else this.hits.set(key, recent);
    }
  }
}

/** One-way bucket id. The address is not retained by this function. */
export function bucketKeyFromAddress(address: string): string {
  return createHash("sha256").update(`an-alq-mcp|v0.1|${address}`).digest("hex");
}
