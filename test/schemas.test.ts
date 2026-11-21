import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  emptyArgsSchema,
  explainTermArgsSchema,
  formatIssues,
  frontierArgsSchema,
  frontierFileSchema,
  newsDropArgsSchema,
  newsDropFileSchema,
  zipCheckInArgsSchema,
} from "../src/schemas.js";
import { guardRpcBody } from "../src/guard.js";

const require = createRequire(import.meta.url);
const zodVersion = (require("zod/package.json") as { version: string }).version;

describe("zod package", () => {
  it("stays on the patched 4.6 line", () => {
    const [major, minor] = zodVersion.split(".").map(Number);
    expect(major).toBeGreaterThanOrEqual(4);
    expect((major ?? 0) > 4 || (minor ?? 0) >= 6).toBe(true);
  });
});

describe("tool argument schemas", () => {
  it("rejects unknown fields without echoing their values", () => {
    const planted = "01945";
    const parsed = newsDropArgsSchema.safeParse({
      slot: "morning",
      zip: "00501",
      name: planted,
      email: "a@b.c",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const message = formatIssues(parsed.error);
    expect(message).toContain("Unrecognized key");
    expect(message).not.toContain(planted);
    expect(message).not.toContain("a@b.c");
  });

  it("accepts a 5-digit ZIP and rejects anything else", () => {
    expect(newsDropArgsSchema.safeParse({ slot: "midday", zip: "00501" }).success).toBe(true);
    expect(newsDropArgsSchema.safeParse({ slot: "afternoon" }).success).toBe(true);
    for (const zip of ["1234", "123456", "9410a", "94107-1234", " 94107", "94107 ", "12 345"]) {
      const parsed = newsDropArgsSchema.safeParse({ slot: "morning", zip });
      expect(parsed.success).toBe(false);
      if (!parsed.success) expect(formatIssues(parsed.error)).not.toContain(zip);
    }
    const numeric = newsDropArgsSchema.safeParse({ slot: "morning", zip: 94107 });
    expect(numeric.success).toBe(false);
    if (!numeric.success) expect(formatIssues(numeric.error)).not.toContain("94107");
  });

  it("rejects a bad slot without a free-text field", () => {
    const parsed = newsDropArgsSchema.safeParse({ slot: "evening", notes: "call me" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const message = formatIssues(parsed.error);
      expect(message).not.toContain("call me");
      expect(message).not.toContain("evening");
    }
  });

  it("requires YYYY-MM and an empty capabilities object", () => {
    expect(frontierArgsSchema.safeParse({ month: "2026-11" }).success).toBe(true);
    for (const month of ["2026-13", "2026-1", "11-2026", "2026-11-01"]) {
      expect(frontierArgsSchema.safeParse({ month }).success).toBe(false);
    }
    expect(frontierArgsSchema.safeParse({ month: "2026-11", zip: "00501" }).success).toBe(false);
    expect(emptyArgsSchema.safeParse({}).success).toBe(true);
    expect(emptyArgsSchema.safeParse({ zip: "00501" }).success).toBe(false);
  });

  it("caps glossary input and the check-in prompt", () => {
    expect(explainTermArgsSchema.safeParse({ term: "RGPO" }).success).toBe(true);
    expect(explainTermArgsSchema.safeParse({ term: "RGPO", name: "Ada" }).success).toBe(false);
    expect(explainTermArgsSchema.safeParse({ term: "x".repeat(65) }).success).toBe(false);
    expect(zipCheckInArgsSchema.safeParse({ zip: "01945" }).success).toBe(true);
    expect(zipCheckInArgsSchema.safeParse({ zip: "01945", email: "a@b.c" }).success).toBe(false);
    expect(zipCheckInArgsSchema.safeParse({}).success).toBe(false);
  });
});

describe("content file schemas", () => {
  it("rejects a news file that tries to store a ZIP", () => {
    const parsed = newsDropFileSchema.safeParse({
      format: "an-alq.news-drop.v1",
      updated: "2026-11-21",
      sample: true,
      label: "example",
      disclaimer: "sample",
      drops: [],
      zip: "01945",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(formatIssues(parsed.error)).not.toContain("01945");
  });

  it("rejects a frontier month that is not YYYY-MM", () => {
    const parsed = frontierFileSchema.safeParse({
      format: "an-alq.frontier-picks.v1",
      updated: "2026-11-21",
      sample: true,
      label: "example",
      disclaimer: "sample",
      months: [
        {
          month: "November",
          sample: true,
          label: "example",
          intro: "no",
          picks: [{ id: "a", title: "t", why: "w", sample: true, label: "example" }],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("guardRpcBody", () => {
  it("rejects batches, unknown tool fields, and bad prompt fields", () => {
    expect(() => guardRpcBody([])).toThrow(/Batch/);
    expect(() =>
      guardRpcBody({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get_news_drop", arguments: { slot: "morning", phone: "555" } },
      }),
    ).toThrow(/Unrecognized key/);
    expect(() =>
      guardRpcBody({
        jsonrpc: "2.0",
        id: 2,
        method: "prompts/get",
        params: { name: "zip_check_in", arguments: { zip: "1234" } },
      }),
    ).toThrow(/5 digits/);
    expect(() =>
      guardRpcBody({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_capabilities", arguments: {} },
      }),
    ).not.toThrow();
  });
});
