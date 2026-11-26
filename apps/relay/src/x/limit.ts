// SPDX-License-Identifier: MIT
export interface HeaderBag {
  get(name: string): string | null;
}

/**
 * Spaces read requests. Honors x-rate-limit-remaining / reset and Retry-After.
 * This limiter never grants a write.
 */
export class XRateLimiter {
  #nextAt = 0;
  #remaining = Number.POSITIVE_INFINITY;
  #resetAt = 0;

  constructor(private readonly minIntervalMs: number) {
    if (minIntervalMs < 0) throw new Error("interval must be non-negative");
  }

  update(headers: HeaderBag, now: number): void {
    const remaining = headers.get("x-rate-limit-remaining");
    const reset = headers.get("x-rate-limit-reset");
    const retryAfter = headers.get("retry-after");
    if (remaining !== null && remaining !== "" && Number.isFinite(Number(remaining))) {
      this.#remaining = Number(remaining);
    }
    if (reset !== null && reset !== "" && Number.isFinite(Number(reset))) {
      this.#resetAt = Number(reset) * 1000;
    }
    if (retryAfter !== null && retryAfter !== "" && Number.isFinite(Number(retryAfter))) {
      this.#remaining = 0;
      this.#resetAt = Math.max(this.#resetAt, now + Number(retryAfter) * 1000);
    }
  }

  delayMs(now: number): number {
    const spacing = Math.max(0, this.#nextAt - now);
    if (this.#remaining <= 1 && this.#resetAt > now) return Math.max(spacing, this.#resetAt - now);
    return spacing;
  }

  markSent(now: number): void {
    this.#nextAt = now + this.minIntervalMs;
  }
}
