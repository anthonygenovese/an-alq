import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { guardRpcBody } from "../src/guard.js";
import {
  explainTermArgsSchema,
  formatIssues,
  frontierArgsSchema,
  newsDropArgsSchema,
} from "../src/schemas.js";
import { loadEvidence, type KeyValueStore } from "../src/sim/skill-map.js";

const SENTINEL = "zzplant";

function storeOf(raw: string): KeyValueStore {
  return {
    getItem: () => raw,
    setItem: () => undefined,
  };
}

describe("validator properties", () => {
  it("accepts only a 5-digit ZIP and never echoes the candidate", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 48 }), (noise) => {
        const zip = `${SENTINEL}${noise}`;
        const parsed = newsDropArgsSchema.safeParse({ slot: "morning", zip });
        expect(parsed.success).toBe(false);
        if (!parsed.success) expect(formatIssues(parsed.error)).not.toContain(SENTINEL);
      }),
    );
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99_999 }), (value) => {
        const zip = String(value).padStart(5, "0");
        const parsed = newsDropArgsSchema.safeParse({ slot: "midday", zip });
        expect(parsed.success).toBe(true);
        if (parsed.success) expect(parsed.data.zip).toBe(zip);
      }),
    );
  });

  it("does not echo unknown field values", () => {
    const key = fc
      .string({
        minLength: 1,
        maxLength: 12,
        unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")),
      })
      .filter((item) => item !== "slot" && item !== "zip");
    fc.assert(
      fc.property(key, fc.string({ maxLength: 40 }), (field, noise) => {
        const planted = `${SENTINEL}${noise}`;
        const parsed = newsDropArgsSchema.safeParse({ slot: "morning", [field]: planted });
        expect(parsed.success).toBe(false);
        if (!parsed.success) expect(formatIssues(parsed.error)).not.toContain(SENTINEL);
      }),
    );
  });

  it("accepts YYYY-MM and rejects everything else without echoing it", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        fc.integer({ min: 0, max: 99 }),
        (year, month) => {
          const text = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
          const parsed = frontierArgsSchema.safeParse({ month: text });
          expect(parsed.success).toBe(month >= 1 && month <= 12);
        },
      ),
    );
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 24 }), (month) => {
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
        const planted = `${SENTINEL}${month}`;
        const parsed = frontierArgsSchema.safeParse({ month: planted });
        expect(parsed.success).toBe(false);
        if (!parsed.success) expect(formatIssues(parsed.error)).not.toContain(SENTINEL);
      }),
    );
  });

  it("caps glossary terms and does not echo them", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 65, maxLength: 120 }), (term) => {
        const planted = `${SENTINEL}${term}`;
        const parsed = explainTermArgsSchema.safeParse({ term: planted });
        expect(parsed.success).toBe(false);
        if (!parsed.success) expect(formatIssues(parsed.error)).not.toContain(SENTINEL);
      }),
    );
  });

  it("keeps guard errors free of planted argument values", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 24 }), (noise) => {
        const planted = `${SENTINEL}${noise}`;
        let message = "";
        try {
          guardRpcBody({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "get_news_drop", arguments: { slot: "morning", phone: planted } },
          });
        } catch (error) {
          message = error instanceof Error ? error.message : "";
        }
        expect(message.length).toBeGreaterThan(0);
        expect(message).not.toContain(SENTINEL);
      }),
    );
  });

  it("drops arbitrary skill-evidence payloads instead of keeping a planted value", () => {
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
