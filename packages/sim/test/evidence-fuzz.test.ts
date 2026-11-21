import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { loadEvidence, type KeyValueStore } from "../src/engine/skill-map.js";

const SENTINEL = "zzplant";

function storeOf(raw: string): KeyValueStore {
  return {
    getItem: () => raw,
    setItem: () => undefined,
  };
}

describe("skill evidence properties", () => {
  it("drops arbitrary payloads instead of keeping a planted value", () => {
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 3 }), (value) => {
        const planted = `${SENTINEL}-${JSON.stringify(value).slice(0, 12)}`;
        const raw = JSON.stringify({ value, email: planted, note: planted });
        const evidence = loadEvidence(storeOf(raw));
        expect(evidence.schema).toBe("an-alq.skill-evidence.v1");
        expect(JSON.stringify(evidence)).not.toContain(SENTINEL);
      }),
    );
  });
});
