import { describe, expect, it } from "vitest";
import { frontierPicks, newsDrops } from "../src/data/content.js";

describe("shipped content store", () => {
  it("is sample data in the documented formats", () => {
    expect(newsDrops.format).toBe("an-alq.news-drop.v1");
    expect(newsDrops.sample).toBe(true);
    expect(newsDrops.label).toBe("example");
    expect(newsDrops.drops.map((drop) => drop.slot).sort()).toEqual([
      "afternoon",
      "midday",
      "morning",
    ]);
    for (const drop of newsDrops.drops) {
      expect(drop.sample).toBe(true);
      expect(drop.label).toBe("example");
      expect(drop.edition).toBe("national");
    }
    expect(frontierPicks.format).toBe("an-alq.frontier-picks.v1");
    expect(frontierPicks.sample).toBe(true);
    expect(frontierPicks.months.map((month) => month.month)).toEqual([
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
    const serialized = JSON.stringify({ newsDrops, frontierPicks });
    expect(serialized).not.toMatch(/\b\d{5}\b/);
  });
});
