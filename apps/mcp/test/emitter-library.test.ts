// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { capabilities } from "../src/data/capabilities.js";
import {
  capabilityBandNames,
  emitterLibrary,
  emitterLibrarySchema,
  emittersById,
  responseIdsFromCapabilities,
} from "../src/data/emitter-library.js";
import { resolveGlossaryEntry } from "../src/data/glossary.js";
import { explainTerm } from "../src/services.js";

const BANNED = [
  "patriot",
  "aegis",
  "s-400",
  "s400",
  "thaad",
  "iron dome",
  "nasams",
  "link 16",
  "link-16",
  "an/apg",
  "an/spy",
  "an/fps",
  "an/tpq",
  "global hawk",
  "jstars",
  "awacs",
  "classified",
];

describe("emitter library schema", () => {
  it("parses the shipped catalog and stays inside the size bounds", () => {
    expect(emitterLibrarySchema.safeParse(emitterLibrary).success).toBe(true);
    expect(emitterLibrary.emitters.length).toBeGreaterThanOrEqual(25);
    expect(emitterLibrary.emitters.length).toBeLessThanOrEqual(40);
    expect(emitterLibrary.figures_are).toBe("illustrative");
    expect(emitterLibrary.fictional).toBe(true);
    expect(emitterLibrary.operational).toBe(false);
    expect(emitterLibrary.transmits).toBe(false);
    expect(emitterLibrary.tiers).toEqual(["T1", "T2", "T3", "T4", "T5"]);
  });

  it("reuses capability bands and radar technique labels", () => {
    const bands = new Set(capabilityBandNames());
    const radar = capabilities.divisions.find((division) => division.id === "radar_jamming");
    expect(radar?.techniques?.length).toBeGreaterThan(0);
    expect(responseIdsFromCapabilities()).toEqual([
      "spot_jamming",
      "barrage_jamming",
      "swept_jamming",
      "rgpo",
      "vgpo",
      "angle_deception",
      "observe_only",
    ]);
    expect(emitterLibrary.bands).toEqual(capabilityBandNames());
    const used = new Set(emitterLibrary.emitters.map((emitter) => emitter.frequency.band));
    for (const band of bands) {
      if (band === "EO/IR") continue;
      expect(used.has(band)).toBe(true);
    }
    expect(used.has("EO/IR")).toBe(false);
  });

  it("points every archetype at the glossary and keeps hooks non-operational", () => {
    const ids = new Set<string>();
    for (const emitter of emitterLibrary.emitters) {
      expect(ids.has(emitter.id)).toBe(false);
      ids.add(emitter.id);
      expect(emitter.figures).toBe("illustrative");
      expect(emitter.fictional).toBe(true);
      expect(emitter.hooks.geolocation.coordinates).toBeNull();
      expect(emitter.hooks.recommendedResponse.procedure).toBe(false);
      expect(emitter.name).not.toMatch(/AN\//);
      for (const term of emitter.glossaryTerms) {
        const entry = resolveGlossaryEntry(term);
        expect(entry?.definition.length).toBeGreaterThan(20);
        const explained = explainTerm(term);
        expect(explained.ok).toBe(true);
        if (explained.ok) expect(explained.body.entry.definition).toBe(entry?.definition);
      }
      if (emitter.hooks.collateral === "protected") {
        expect(emitter.hooks.recommendedResponse.id).toBe("observe_only");
      }
      expect(emitter.frequency.maxMhz).toBeGreaterThanOrEqual(emitter.frequency.minMhz);
      expect(emitter.bandwidthMhz.max).toBeGreaterThan(0);
    }
    expect(emittersById.size).toBe(emitterLibrary.emitters.length);
  });

  it("does not name real systems or claim a procedure", () => {
    const serialized = JSON.stringify(emitterLibrary).toLowerCase();
    for (const banned of BANNED) {
      expect(serialized).not.toContain(banned);
    }
    expect(serialized).not.toContain("how to");
    expect(serialized).not.toMatch(/\b(lat|lon|latitude|longitude)\b/);
  });
});
