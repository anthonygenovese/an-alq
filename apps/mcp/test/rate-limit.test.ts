// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { SlidingWindowRateLimiter, bucketKeyFromAddress } from "../src/rate-limit.js";

describe("SlidingWindowRateLimiter", () => {
  it("allows a burst up to the limit and then blocks", () => {
    const limiter = new SlidingWindowRateLimiter(2, 1_000);
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 10).allowed).toBe(true);
    const blocked = limiter.check("a", 20);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterMs).toBe(980);
    expect(limiter.check("b", 20).allowed).toBe(true);
  });

  it("reopens the window after the oldest hit expires", () => {
    const limiter = new SlidingWindowRateLimiter(1, 1_000);
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("a", 1_000).allowed).toBe(false);
    expect(limiter.check("a", 1_001).allowed).toBe(true);
  });
});

describe("bucketKeyFromAddress", () => {
  it("does not keep the address in the key", () => {
    const address = "203.0.113.10";
    const key = bucketKeyFromAddress(address);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain(address);
    expect(bucketKeyFromAddress(address)).toBe(key);
    expect(bucketKeyFromAddress("203.0.113.11")).not.toBe(key);
  });
});
