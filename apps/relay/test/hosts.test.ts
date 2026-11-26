import { describe, expect, it } from "vitest";
import { isNixleHost } from "../src/nixle.js";
import { hostAllowed, hostListed, NIXLE_HOSTS } from "../src/sources/allow.js";

describe("source host allowlist", () => {
  it("accepts a listed host and rejects a lookalike subdomain", () => {
    expect(hostAllowed("https://local.nixle.com/alert/1", NIXLE_HOSTS)).toBe(true);
    expect(hostAllowed("https://nixle.com/alert/1", NIXLE_HOSTS)).toBe(true);
    expect(hostAllowed("https://evil.nixle.com/alert/1", NIXLE_HOSTS)).toBe(false);
    expect(hostAllowed("https://nixle.com.evil.test/alert/1", NIXLE_HOSTS)).toBe(false);
    expect(isNixleHost("local.nixle.com")).toBe(true);
    expect(isNixleHost("evil.nixle.com")).toBe(false);
    expect(isNixleHost("notnixle.com")).toBe(false);
    expect(hostListed("www.nixle.com", NIXLE_HOSTS)).toBe(true);
    expect(hostListed("www.evil.nixle.com", NIXLE_HOSTS)).toBe(false);
  });
});
