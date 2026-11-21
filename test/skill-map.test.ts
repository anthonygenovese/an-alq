import { describe, expect, it } from "vitest";
import { EMITTER_CATEGORIES } from "../src/data/emitter-library.js";
import {
  applyAttempt,
  emptyEvidence,
  evaluateMap,
  loadEvidence,
  participationRingOpacity,
  recordAttempt,
  saveEvidence,
  scoreCriterion,
  sectorCenter,
  skillMap,
  skillMapSchema,
  skillNodeById,
  type AttemptEvent,
  type KeyValueStore,
  type SkillEvidence,
} from "../src/sim/skill-map.js";

function memoryStore(initial = ""): KeyValueStore & { raw: string } {
  const box = { raw: initial };
  return {
    get raw() {
      return box.raw;
    },
    set raw(value: string) {
      box.raw = value;
    },
    getItem: () => (box.raw ? box.raw : null),
    setItem: (_key, value) => {
      box.raw = value;
    },
  };
}

function attempt(partial: Partial<AttemptEvent> & Pick<AttemptEvent, "category">): AttemptEvent {
  return {
    difficulty: "recruit",
    correct: true,
    elapsedMs: 400,
    ...partial,
  };
}

function play(evidence: SkillEvidence, event: AttemptEvent, times: number): SkillEvidence {
  let next = evidence;
  for (let i = 0; i < times; i += 1) next = recordAttempt(next, event);
  return next;
}

describe("skill map schema", () => {
  it("parses six domains and keeps later constellations locked", () => {
    expect(skillMapSchema.safeParse(skillMap).success).toBe(true);
    expect(skillMap.domains.map((domain) => domain.id)).toEqual([
      "sigint",
      "geolocation",
      "radar-response",
      "comms-disruption",
      "deception",
      "multi-threat",
    ]);
    expect(skillMap.domains.filter((domain) => domain.status === "playable").map((domain) => domain.id)).toEqual([
      "sigint",
    ]);
    expect(skillMap.participation.slot).toBe("participation-glow-ring");
    expect(skillMap.participation.shows).toBe("how-you-participate");
    expect(skillMap.participation.mapShows).toBe("what-you-learned");
    expect(skillMap.operational).toBe(false);
    for (const node of skillMap.nodes) {
      expect(skillNodeById.get(node.id)?.label).toBe(node.label);
      for (const category of node.criterion.source === "category" ? node.criterion.categories : []) {
        expect(EMITTER_CATEGORIES).toContain(category);
      }
    }
    expect(skillMap.nodes.some((node) => node.id === "classify-pulsed")).toBe(true);
    expect(skillMap.nodes.some((node) => node.id === "classify-fhss")).toBe(true);
    expect(skillMap.nodes.some((node) => node.id === "low-snr")).toBe(true);
    expect(sectorCenter(332, 28)).toBe(0);
  });
});

describe("mastery", () => {
  it("starts dark, then lights Open ear and pulsed radar in order", () => {
    const fresh = evaluateMap(emptyEvidence());
    expect(fresh.litCount).toBe(0);
    expect(fresh.nodes.find((node) => node.id === "open-ear")?.state).toBe("open");
    expect(fresh.nodes.find((node) => node.id === "classify-pulsed")?.state).toBe("sealed");
    expect(fresh.nodes.find((node) => node.id === "tdoa-lines")?.state).toBe("locked");

    const two = play(emptyEvidence(), attempt({ category: "search_radar" }), 2);
    const afterTwo = evaluateMap(two);
    expect(afterTwo.litIds).toEqual([]);
    expect(afterTwo.nodes.find((node) => node.id === "classify-pulsed")?.state).toBe("sealed");

    const three = recordAttempt(two, attempt({ category: "search_radar" }));
    const afterThree = evaluateMap(three);
    expect(afterThree.litIds).toEqual(["open-ear"]);
    expect(afterThree.nodes.find((node) => node.id === "classify-pulsed")?.state).toBe("open");

    const four = recordAttempt(three, attempt({ category: "tracking_radar", elapsedMs: 500 }));
    expect(evaluateMap(four).litIds).toEqual(["open-ear", "classify-pulsed"]);
  });

  it("holds a node unlit when accuracy or speed misses the gate", () => {
    const slow = play(
      emptyEvidence(),
      attempt({ category: "fire_control_radar", elapsedMs: 1800 }),
      4,
    );
    const slowMap = evaluateMap(slow);
    expect(slowMap.litIds).toEqual(["open-ear"]);
    expect(slowMap.nodes.find((node) => node.id === "classify-pulsed")?.state).toBe("open");
    const pulsed = skillNodeById.get("classify-pulsed");
    expect(pulsed).toBeDefined();
    if (pulsed) {
      const score = scoreCriterion(slow, pulsed.criterion);
      expect(score.met).toBe(false);
      expect(score.meanCorrectMs).toBe(1800);
    }

    let missed = emptyEvidence();
    missed = play(missed, attempt({ category: "search_radar", correct: false, elapsedMs: 200 }), 3);
    missed = recordAttempt(missed, attempt({ category: "search_radar", elapsedMs: 300 }));
    expect(evaluateMap(missed).litIds).not.toContain("classify-pulsed");
    expect(evaluateMap(missed).nodes.find((node) => node.id === "open-ear")?.state).toBe("open");
  });

  it("does not light Low-SNR or a locked constellation early", () => {
    let evidence = emptyEvidence();
    evidence = play(evidence, attempt({ category: "search_radar" }), 4);
    evidence = play(evidence, attempt({ category: "comms_fhss", elapsedMs: 350 }), 3);
    evidence = play(evidence, attempt({ category: "comms_dsss", elapsedMs: 450 }), 4);
    evidence = play(evidence, attempt({ category: "gnss", difficulty: "lead", elapsedMs: 500 }), 4);
    const snapshot = evaluateMap(evidence);
    expect(snapshot.litIds).toEqual(
      expect.arrayContaining(["open-ear", "classify-pulsed", "classify-fhss", "classify-wideband", "low-snr"]),
    );
    expect(snapshot.nodes.find((node) => node.id === "tdoa-lines")?.state).toBe("locked");
    expect(snapshot.nodes.find((node) => node.id === "gnss-term")?.state).toBe("locked");
    expect(snapshot.nodes.find((node) => node.id === "spot-label")?.state).toBe("locked");
    expect(snapshot.nodes.find((node) => node.id === "vgpo-label")?.fraction).toBe(0);

    const leadOnly = play(
      emptyEvidence(),
      attempt({ category: "search_radar", difficulty: "lead", elapsedMs: 400 }),
      4,
    );
    expect(evaluateMap(leadOnly).litIds).not.toContain("low-snr");
  });

  it("reports newly lit nodes without mutating the previous evidence", () => {
    const start = play(emptyEvidence(), attempt({ category: "navigation_radar" }), 2);
    const before = JSON.stringify(start);
    const result = applyAttempt(start, attempt({ category: "navigation_radar", elapsedMs: 250 }));
    expect(JSON.stringify(start)).toBe(before);
    expect(result.newlyLit).toEqual(["open-ear"]);
    expect(result.evidence).not.toBe(start);
    const next = applyAttempt(result.evidence, attempt({ category: "search_radar", elapsedMs: 250 }));
    expect(next.newlyLit).toEqual(["classify-pulsed"]);
  });
});

describe("evidence storage", () => {
  it("round-trips and rejects corrupt payloads", () => {
    const store = memoryStore();
    const evidence = play(emptyEvidence(), attempt({ category: "satcom", elapsedMs: 800 }), 2);
    saveEvidence(store, evidence);
    expect(loadEvidence(store).byCategory.satcom.attempts).toBe(2);
    expect(loadEvidence(store).byCategory.satcom.correct).toBe(2);

    const broken = memoryStore("{");
    expect(loadEvidence(broken).byCategory.satcom.attempts).toBe(0);
    const foreign = memoryStore(JSON.stringify({ schema: "nope" }));
    expect(loadEvidence(foreign).schema).toBe("an-alq.skill-evidence.v1");
    expect(loadEvidence(null).byDifficulty.lead.attempts).toBe(0);
  });
});

describe("participation ring slot", () => {
  it("stays empty until a later module supplies an intensity", () => {
    expect(participationRingOpacity({ intensity: null })).toBe(0);
    expect(participationRingOpacity({ intensity: Number.NaN })).toBe(0);
    expect(participationRingOpacity({ intensity: -0.2 })).toBe(0);
    expect(participationRingOpacity({ intensity: 0.4 })).toBeCloseTo(0.4);
    expect(participationRingOpacity({ intensity: 2 })).toBe(1);
  });
});
