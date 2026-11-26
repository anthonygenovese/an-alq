// SPDX-License-Identifier: MIT
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Hex, utf8 } from "../src/sha256.js";

describe("sha256", () => {
  it("matches Node createHash for the relay concatenations", () => {
    const samples = ["", "abc", "an-alq.relay.nullifier.v1|alert|secret", "fixture-north"];
    for (const sample of samples) {
      const ours = sha256Hex([utf8(sample)]);
      const node = createHash("sha256").update(sample).digest("hex");
      expect(ours).toBe(node);
    }
    const salt = utf8("salt-bytes");
    const ours = sha256Hex([salt, new Uint8Array([0]), utf8("material")]);
    const node = createHash("sha256")
      .update(salt)
      .update(Buffer.from([0]))
      .update("material")
      .digest("hex");
    expect(ours).toBe(node);
  });
});
