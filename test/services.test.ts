import { describe, expect, it } from "vitest";
import { capabilities } from "../src/data/capabilities.js";
import { GLOSSARY_IDS } from "../src/data/glossary.js";
import { explainTerm, getCapabilities, getEmitterLibrary, getFrontierPicks, getNewsDrop } from "../src/services.js";

function metricsOf(document: typeof capabilities) {
  return document.divisions.flatMap((division) => division.metrics);
}

describe("getCapabilities", () => {
  it("labels every quantitative figure illustrative", () => {
    const document = getCapabilities();
    const metrics = metricsOf(document);
    expect(metrics.length).toBeGreaterThan(0);
    for (const metric of metrics) {
      expect(metric.label).toBe("illustrative");
    }
    const serialized = JSON.stringify(document);
    for (const figure of ["<12 ms", "<50 ms", "99.3%", "40,000+", "up to 64", "0.5–18 GHz"]) {
      expect(serialized).toContain(figure);
    }
    expect(document.figures_are).toBe("illustrative");
    expect(document.disclaimer.toLowerCase()).toContain("illustrative");
    for (const division of document.divisions) {
      for (const entry of division.bands ?? []) {
        expect(entry.label).toBe("illustrative");
      }
    }
  });

  it("keeps advanced research closed and unnamed", () => {
    const research = getCapabilities().divisions.find((division) => division.id === "advanced_research");
    expect(research?.briefing).toBe("not_open");
    expect(research?.metrics).toEqual([]);
    expect(research?.summary.toLowerCase()).toContain("not yet available for general briefing");
    expect(research?.techniques).toBeUndefined();
  });

  it("names the public techniques without adding a procedure", () => {
    const radar = getCapabilities().divisions.find((division) => division.id === "radar_jamming");
    expect(radar?.techniques?.join(" ")).toMatch(/spot jamming/);
    expect(radar?.techniques?.join(" ")).toMatch(/barrage jamming/);
    expect(radar?.techniques?.join(" ")).toMatch(/swept jamming/);
    expect(radar?.techniques?.join(" ")).toMatch(/RGPO/);
    expect(radar?.techniques?.join(" ")).toMatch(/VGPO/);
    expect(radar?.techniques?.join(" ")).toMatch(/angle deception/);
    const comms = getCapabilities().divisions.find((division) => division.id === "communications_disruption");
    expect(comms?.bands?.map((band) => band.name)).toEqual(["HF", "VHF", "UHF", "L-band", "S-band"]);
    expect(comms?.techniques?.join(" ")).toMatch(/FHSS/);
    expect(comms?.techniques?.join(" ")).toMatch(/DSSS/);
    const deception = getCapabilities().divisions.find((division) => division.id === "electronic_deception");
    expect(deception?.techniques?.join(" ")).toMatch(/GNSS spoofing/);
    expect(deception?.techniques?.join(" ")).toMatch(/false target/i);
  });
});

describe("getEmitterLibrary", () => {
  it("returns the fictional training catalog", () => {
    const library = getEmitterLibrary();
    expect(library.schema).toBe("an-alq.emitter-library.v1");
    expect(library.role).toBe("training");
    expect(library.operational).toBe(false);
    expect(library.emitters.length).toBeGreaterThanOrEqual(25);
  });
});

describe("getNewsDrop", () => {
  it("serves a labeled sample drop and can note a ZIP without storing one", () => {
    const drop = getNewsDrop({ slot: "morning", zip: "94107" });
    expect(drop.found).toBe(true);
    if (!drop.found) return;
    expect(drop.drop.sample).toBe(true);
    expect(drop.drop.label).toBe("example");
    expect(drop.drop.slot).toBe("morning");
    expect(drop.localization?.postal_region).toMatch(/USPS prefix 9/);
    expect(drop.retention).toEqual({
      zip_logged: false,
      zip_stored: false,
      user_profile: "none",
    });
  });

  it("omits localization when no ZIP is offered", () => {
    const drop = getNewsDrop({ slot: "afternoon" });
    expect(drop.found).toBe(true);
    if (!drop.found) return;
    expect(drop.localization).toBeNull();
  });
});

describe("getFrontierPicks", () => {
  it("returns the sample month and a miss for an empty month", () => {
    const november = getFrontierPicks({ month: "2026-11" });
    expect(november.found).toBe(true);
    if (november.found) {
      expect(november.entry.sample).toBe(true);
      expect(november.entry.label).toBe("example");
      expect(november.entry.picks.length).toBeGreaterThan(0);
    }
    const missing = getFrontierPicks({ month: "1999-01" });
    expect(missing.found).toBe(false);
    if (!missing.found) {
      expect(missing.available_months).toContain("2026-11");
      expect(JSON.stringify(missing)).not.toMatch(/invented title/i);
    }
  });
});

describe("explainTerm", () => {
  it("defines the requested ids and does not echo an unknown term", () => {
    for (const id of ["rgpo", "vgpo", "drfm", "esm", "elint", "tdoa", "aoa", "fhss", "dsss"]) {
      const hit = explainTerm(id);
      expect(hit.ok).toBe(true);
      if (hit.ok) expect(hit.body.entry.definition.length).toBeGreaterThan(20);
    }
    const alias = explainTerm("Range Gate Pull-Off");
    expect(alias.ok).toBe(true);
    if (alias.ok) expect(alias.body.entry.id).toBe("rgpo");
    const planted = "01945";
    const miss = explainTerm(planted);
    expect(miss.ok).toBe(false);
    if (!miss.ok) {
      expect(miss.message).not.toContain(planted);
      expect(miss.message).toContain("rgpo");
    }
    expect(GLOSSARY_IDS).toContain("gnss_spoofing");
  });
});
