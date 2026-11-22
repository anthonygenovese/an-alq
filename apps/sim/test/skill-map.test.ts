import { describe, expect, it } from "vitest";
import { EMITTER_CATEGORIES, emitterLibrary, resolveGlossaryEntry } from "@an-alq/emitters";
import {
  SKILL_ACK_STORAGE_NAME,
  SKILL_EVIDENCE_KEY,
  applyAttempt,
  barrageDefinitionQuestion,
  emptyEvidence,
  emptyGates,
  evaluateMap,
  loadEvidence,
  loadGates,
  participationRingOpacity,
  recordAttempt,
  saveEvidence,
  saveGates,
  scoreCriterion,
  sectorCenter,
  skillMap,
  skillMapSchema,
  skillNodeById,
  withBarrageAcknowledgment,
  withBarrageDefinition,
  type AttemptEvent,
  type KeyValueStore,
  type SkillEvidence,
  type SkillGates,
} from "../src/engine/skill-map.js";
import { emptyTierContext, recordGridAttempt } from "../src/engine/tier-evidence.js";

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
    expect(
      skillMap.domains.filter((domain) => domain.status === "playable").map((domain) => domain.id),
    ).toEqual(["sigint"]);
    expect(skillMap.participation.slot).toBe("participation-glow-ring");
    expect(skillMap.participation.shows).toBe("how-you-participate");
    expect(skillMap.participation.mapShows).toBe("what-you-learned");
    expect(skillMap.operational).toBe(false);
    for (const node of skillMap.nodes) {
      expect(skillNodeById.get(node.id)?.label).toBe(node.label);
      for (const category of node.criterion.source === "category"
        ? node.criterion.categories
        : []) {
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
      expect.arrayContaining([
        "open-ear",
        "classify-pulsed",
        "classify-fhss",
        "classify-wideband",
        "low-snr",
      ]),
    );
    expect(snapshot.nodes.find((node) => node.id === "tdoa-lines")?.state).toBe("locked");
    expect(snapshot.nodes.find((node) => node.id === "gnss-term")?.state).toBe("locked");
    expect(snapshot.nodes.find((node) => node.id === "spot-label")?.state).toBe("locked");
    expect(snapshot.nodes.find((node) => node.id === "rgpo-label")?.state).toBe("locked");
    expect(snapshot.nodes.find((node) => node.id === "vgpo-label")?.state).toBe("locked");
    expect(snapshot.nodes.find((node) => node.id === "vgpo-label")?.fraction).toBe(0);
    expect(snapshot.nodes.find((node) => node.id === "barrage-label")?.state).toBe("sealed");
    expect(snapshot.litIds).not.toContain("barrage-label");

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
    const next = applyAttempt(
      result.evidence,
      attempt({ category: "search_radar", elapsedMs: 250 }),
    );
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

describe("barrage definition node", () => {
  it("keeps a strict glossary criterion on barrage-label only", () => {
    const barrage = skillNodeById.get("barrage-label");
    expect(barrage?.criterion).toEqual({
      source: "glossary",
      term: "barrage_jamming",
      ask: "definition",
    });
    expect(barrage?.requires).toEqual(["low-snr", "classify-chirp", "classify-continuous"]);
    expect(skillMap.domains.find((domain) => domain.id === "radar-response")?.status).toBe(
      "locked",
    );
    for (const id of ["spot-label", "rgpo-label", "vgpo-label"]) {
      expect(skillNodeById.get(id)?.criterion).toEqual({ source: "unavailable" });
    }

    const withNumber = cloneMap();
    const numbered = withNumber.nodes.find((node) => node.id === "barrage-label");
    if (!numbered) throw new Error("missing barrage-label");
    numbered.criterion = {
      source: "glossary",
      term: "barrage_jamming",
      ask: "definition",
      minAttempts: 1,
    };
    expect(skillMapSchema.safeParse(withNumber).success).toBe(false);

    for (const id of ["spot-label", "rgpo-label", "vgpo-label"]) {
      const moved = cloneMap();
      const node = moved.nodes.find((item) => item.id === id);
      if (!node) throw new Error(`missing ${id}`);
      node.criterion = { source: "glossary", term: "barrage_jamming", ask: "definition" };
      const parsed = skillMapSchema.safeParse(moved);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const messages = parsed.error.issues.map((issue) => issue.message).join(" ");
        expect(messages).toContain("unavailable");
      }
    }
  });

  it("asks for the barrage definition and does not name an archetype", () => {
    const question = barrageDefinitionQuestion();
    expect(question.answerId).toBe("barrage_jamming");
    expect(question.prompt.toLowerCase()).toContain("definition");
    expect(question.choices.map((choice) => choice.id)).toEqual([
      "spot_jamming",
      "barrage_jamming",
      "rgpo",
      "vgpo",
    ]);
    for (const choice of question.choices) {
      expect(choice.definition).toBe(resolveGlossaryEntry(choice.id)?.definition);
      expect(Object.keys(choice).sort()).toEqual(["definition", "id"]);
    }
    const blob = JSON.stringify(question).toLowerCase();
    expect(blob).not.toContain("ribbon-4");
    expect(blob).not.toContain("ribbon");
    for (const emitter of emitterLibrary.emitters) {
      expect(blob).not.toContain(emitter.id);
      expect(blob).not.toContain(emitter.name.toLowerCase());
    }
  });

  it("lights barrage only after T1 mastery and acknowledgment", () => {
    const mastered = masterT1(emptyEvidence());
    const ready = evaluateMap(mastered, emptyGates());
    for (const id of [
      "open-ear",
      "classify-pulsed",
      "classify-fhss",
      "classify-wideband",
      "classify-chirp",
      "classify-continuous",
      "low-snr",
    ]) {
      expect(ready.litIds).toContain(id);
    }
    expect(ready.nodes.find((node) => node.id === "barrage-label")?.state).toBe("open");
    expect(nodeLocked(ready, "spot-label")).toBe(true);
    expect(nodeLocked(ready, "rgpo-label")).toBe(true);
    expect(nodeLocked(ready, "vgpo-label")).toBe(true);

    const acknowledged = withBarrageAcknowledgment(emptyGates(), true);
    expect(evaluateMap(mastered, acknowledged).litIds).not.toContain("barrage-label");

    const matchedEarly = withBarrageDefinition(emptyGates(), "barrage_jamming");
    expect(matchedEarly.barrageDefinition).toBe(false);
    const definitionWithoutAck = { ...emptyGates(), barrageDefinition: true };
    expect(
      evaluateMap(emptyEvidence(), definitionWithoutAck).nodes.find(
        (node) => node.id === "barrage-label",
      )?.state,
    ).toBe("sealed");
    expect(evaluateMap(mastered, definitionWithoutAck).litIds).not.toContain("barrage-label");

    const matched = withBarrageDefinition(acknowledged, "spot_jamming");
    expect(matched.barrageDefinition).toBe(false);
    const correct = withBarrageDefinition(acknowledged, "barrage_jamming");
    expect(correct).toEqual({
      schema: "an-alq.skill-acknowledgment.v1",
      barrageLabel: true,
      barrageDefinition: true,
    });

    const lit = evaluateMap(mastered, correct);
    expect(lit.nodes.find((node) => node.id === "barrage-label")?.state).toBe("lit");
    expect(lit.litIds).toContain("barrage-label");
    expect(nodeLocked(lit, "spot-label")).toBe(true);
    expect(nodeLocked(lit, "rgpo-label")).toBe(true);
    expect(nodeLocked(lit, "vgpo-label")).toBe(true);
    expect(lit.nodes.find((node) => node.id === "vgpo-label")?.fraction).toBe(0);

    const cleared = withBarrageAcknowledgment(correct, false);
    expect(cleared.barrageLabel).toBe(false);
    expect(cleared.barrageDefinition).toBe(false);
    expect(evaluateMap(mastered, cleared).litIds).not.toContain("barrage-label");
  });

  it("stores the acknowledgment beside skill evidence and rejects extra fields", () => {
    const store = keyedStore();
    const gates: SkillGates = {
      schema: "an-alq.skill-acknowledgment.v1",
      barrageLabel: true,
      barrageDefinition: false,
    };
    saveGates(store, gates);
    expect(loadGates(store)).toEqual(gates);
    expect(store.values.has(SKILL_EVIDENCE_KEY)).toBe(false);
    expect(store.values.has(SKILL_ACK_STORAGE_NAME)).toBe(true);

    store.setItem(
      SKILL_ACK_STORAGE_NAME,
      JSON.stringify({ ...gates, power: 12, waveform: "tone" }),
    );
    expect(loadGates(store)).toEqual(emptyGates());
    store.setItem(SKILL_ACK_STORAGE_NAME, "{");
    expect(loadGates(store)).toEqual(emptyGates());
    expect(loadGates(null)).toEqual(emptyGates());
  });
});

function cloneMap() {
  return JSON.parse(JSON.stringify(skillMap)) as {
    nodes: { id: string; criterion: Record<string, unknown> }[];
  };
}

function nodeLocked(snapshot: { nodes: { id: string; state: string }[] }, id: string): boolean {
  return snapshot.nodes.find((node) => node.id === id)?.state === "locked";
}

function masterT1(evidence: SkillEvidence): SkillEvidence {
  let next = evidence;
  next = play(next, attempt({ category: "search_radar" }), 4);
  next = play(next, attempt({ category: "comms_fhss", elapsedMs: 350 }), 3);
  next = play(next, attempt({ category: "comms_dsss", elapsedMs: 450 }), 4);
  next = play(next, attempt({ category: "gnss", difficulty: "lead", elapsedMs: 500 }), 4);
  next = play(next, attempt({ category: "early_warning_radar", elapsedMs: 400 }), 3);
  next = play(next, attempt({ category: "hf_comms", elapsedMs: 400 }), 3);
  return next;
}

function keyedStore(): KeyValueStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("fictional grid node", () => {
  it("lights only after T1 mastery, acknowledgment, and grid attempts", () => {
    const mastered = masterT1(emptyEvidence());
    const quiet = emptyTierContext();
    const before = evaluateMap(mastered, emptyGates(), quiet);
    expect(before.nodes.find((node) => node.id === "converging-fix")?.state).toBe("open");
    expect(nodeLocked(before, "tdoa-lines")).toBe(true);
    expect(nodeLocked(before, "aoa-bearings")).toBe(true);
    expect(nodeLocked(before, "spot-label")).toBe(true);
    expect(nodeLocked(before, "rgpo-label")).toBe(true);
    expect(nodeLocked(before, "vgpo-label")).toBe(true);

    let evidence = recordGridAttempt(quiet.evidence, true, 300);
    evidence = recordGridAttempt(evidence, true, 300);
    evidence = recordGridAttempt(evidence, false, 300);
    const unacked = evaluateMap(mastered, emptyGates(), { evidence, acknowledged: false });
    expect(unacked.litIds).not.toContain("converging-fix");

    const early = evaluateMap(emptyEvidence(), emptyGates(), { evidence, acknowledged: true });
    expect(early.nodes.find((node) => node.id === "converging-fix")?.state).toBe("sealed");

    const lit = evaluateMap(mastered, emptyGates(), { evidence, acknowledged: true });
    expect(lit.nodes.find((node) => node.id === "converging-fix")?.state).toBe("lit");
    expect(nodeLocked(lit, "spot-label")).toBe(true);
    expect(nodeLocked(lit, "rgpo-label")).toBe(true);
    expect(nodeLocked(lit, "vgpo-label")).toBe(true);
    expect(nodeLocked(lit, "tdoa-lines")).toBe(true);
    expect(nodeLocked(lit, "aoa-bearings")).toBe(true);
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
