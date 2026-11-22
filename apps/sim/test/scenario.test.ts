import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { emitterById } from "@an-alq/emitters";
import { explainRound } from "../src/engine/feedback.js";
import { generateRound, trainingRoundSchema } from "../src/engine/generator.js";
import { loadScenarioFile, scenarioSchema, type LoadedScenario } from "../src/engine/scenario.js";
import { gradeAnswer } from "../src/engine/scoring.js";
import { drawsFromRound, sampleRow } from "../src/engine/signature.js";
import {
  applyAttempt,
  emptyEvidence,
  evaluateMap,
  recordAttempt,
  type SkillSnapshot,
} from "../src/engine/skill-map.js";

const scenarioPath = fileURLToPath(new URL("../scenarios/recruit-seed-3.json", import.meta.url));

function nodeState(snapshot: SkillSnapshot, id: string): string | undefined {
  return snapshot.nodes.find((node) => node.id === id)?.state;
}

describe("scenario file", () => {
  it("rejects unknown fields so extra parameters cannot ride along", () => {
    const raw: unknown = JSON.parse(readFileSync(scenarioPath, "utf8"));
    expect(raw && typeof raw === "object").toBe(true);
    if (!raw || typeof raw !== "object") return;
    expect(scenarioSchema.safeParse({ ...raw, power: 12 }).success).toBe(false);
    expect(scenarioSchema.safeParse({ ...raw, waveform: "tone" }).success).toBe(false);
    expect(scenarioSchema.safeParse({ ...raw, iq: [0, 1] }).success).toBe(false);
    expect(scenarioSchema.safeParse({ ...raw, coordinates: { lat: 0, lon: 0 } }).success).toBe(
      false,
    );
    expect(scenarioSchema.safeParse({ ...raw, tier: "T3" }).success).toBe(false);
    const answers = "answers" in raw ? raw.answers : null;
    const first = Array.isArray(answers) ? answers[0] : null;
    expect(first && typeof first === "object").toBe(true);
    if (!first || typeof first !== "object") return;
    expect(
      scenarioSchema.safeParse({
        ...raw,
        answers: [{ ...first, technique: "spot" }],
      }).success,
    ).toBe(false);
  });

  it("reloads seed 3 and replays the synthetic round", () => {
    const loaded = loadScenarioFile(scenarioPath);
    const again = loadScenarioFile(scenarioPath);
    expect(again).toEqual(loaded);
    expect(loaded.scenario).toMatchObject({
      schema: "an-alq.scenario.v1",
      tier: "T1",
      figures_are: "illustrative",
      fictional: true,
      operational: false,
      seed: 3,
      difficulty: "recruit",
    });
    expect(loaded.scenario.answers).toEqual([{ elapsedMs: 500, answerId: null }]);
    expect(loaded.round).toEqual(generateRound({ seed: 3, difficulty: "recruit" }));
    expect(trainingRoundSchema.safeParse(loaded.round).success).toBe(true);
    expect(loaded.round.tier).toBe("T1");
    expect(loaded.round.operational).toBe(false);
    expect(loaded.round.fictional).toBe(true);

    const grade = gradeScript(loaded);
    expect(grade).toEqual({
      correct: false,
      reason: "timeout",
      points: 0,
      streak: 0,
      elapsedMs: 500,
    });

    const feedback = explainRound(loaded.round, grade, null);
    expect(feedback.reason).toBe("timeout");
    expect(feedback.explanation.length).toBeGreaterThan(20);
    expect(feedback.glossary.length).toBeGreaterThan(0);
    expect(feedback.responseNote.length).toBeGreaterThan(0);

    const draws = drawsFromRound(loaded.round);
    expect(draws).toHaveLength(loaded.round.emitters.length);
    const rowInput = {
      bins: loaded.round.display.bins,
      noiseFloor: loaded.round.noiseFloor,
      seed: loaded.round.seed,
      rowIndex: 0,
      draws,
    };
    const first = sampleRow(rowInput);
    const second = sampleRow(rowInput);
    expect(Array.from(first)).toEqual(Array.from(second));
    expect(first).toHaveLength(512);
    expect(Array.from(first).every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
    expect(Math.max(...first)).toBeGreaterThan(loaded.round.noiseFloor);

    const archetype = emitterById(loaded.round.primaryId);
    expect(archetype).toBeDefined();
    if (!archetype) return;
    const event = {
      category: archetype.category,
      difficulty: loaded.round.difficulty,
      correct: grade.correct,
      elapsedMs: grade.elapsedMs,
    };
    const recorded = recordAttempt(emptyEvidence(), event);
    const applied = applyAttempt(emptyEvidence(), event);
    expect(applied.evidence).toEqual(recorded);
    expect(applied.newlyLit).toEqual([]);
    const snapshot = evaluateMap(applied.evidence);
    expect(snapshot.litCount).toBe(0);
    expect(nodeState(snapshot, "open-ear")).toBe("open");
    expect(nodeState(snapshot, "classify-pulsed")).toBe("sealed");
    expect(nodeState(snapshot, "spot-label")).toBe("locked");
    expect(nodeState(snapshot, "barrage-label")).toBe("locked");
    expect(nodeState(snapshot, "rgpo-label")).toBe("locked");
    expect(nodeState(snapshot, "vgpo-label")).toBe("locked");
  });
});

function gradeScript(loaded: LoadedScenario) {
  const answer = loaded.scenario.answers[0];
  if (!answer) throw new Error("scenario has no answer");
  return gradeAnswer({
    primaryId: loaded.round.primaryId,
    answerId: answer.answerId,
    elapsedMs: answer.elapsedMs,
    streak: 0,
  });
}
