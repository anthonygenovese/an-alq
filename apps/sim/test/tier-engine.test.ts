// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { resolveGlossaryEntry } from "@an-alq/emitters";
import { generateRound } from "../src/engine/generator.js";
import {
  generateConceptRound,
  conceptRoundSchema,
  scoreConceptPick,
} from "../src/engine/concept-round.js";
import { generateGridRound, gridRoundSchema, scoreGridPick } from "../src/engine/grid-round.js";
import { gradeAnswer } from "../src/engine/scoring.js";
import { skillNodeById } from "../src/engine/skill-map.js";
import {
  classifyRound,
  gridRound,
  roundKind,
  scoreClassify,
  tierRegistration,
} from "../src/engine/tier-engine.js";
import {
  emptyTierEvidence,
  loadTierAcknowledgment,
  loadTierEvidence,
  recordGridAttempt,
  saveTierAcknowledgment,
  saveTierEvidence,
  TIER_ACK_STORAGE_NAME,
  TIER_EVIDENCE_STORAGE_NAME,
  type TierStore,
} from "../src/engine/tier-evidence.js";

describe("tier registration", () => {
  it("keeps T1 on the classify engine", () => {
    const options = { seed: 3, difficulty: "recruit" as const };
    expect(classifyRound(options)).toEqual(generateRound(options));
    const input = {
      primaryId: "lantern-search",
      answerId: "lantern-search",
      elapsedMs: 400,
      streak: 0,
    };
    expect(scoreClassify(input)).toEqual(gradeAnswer(input));
    expect(tierRegistration("T1").locked).toEqual([]);
    expect(roundKind("open-ear")).toBe("classify");
    expect(roundKind("classify-pulsed")).toBe("classify");
  });

  it("registers conceptual nodes and leaves the unsafe ones locked", () => {
    expect(tierRegistration("T2")).toEqual({
      tier: "T2",
      playable: ["tdoa-lines", "converging-fix"],
      locked: ["aoa-bearings"],
    });
    expect(roundKind("converging-fix")).toBe("grid");
    expect(roundKind("tdoa-lines")).toBe("concept");
    expect(gridRound(4)).toEqual(generateGridRound(4));
    expect(tierRegistration("T3")).toEqual({
      tier: "T3",
      playable: ["barrage-label", "comms-fhss"],
      locked: ["spot-label", "rgpo-label", "vgpo-label", "comms-dsss", "comms-select"],
    });
    expect(roundKind("comms-fhss")).toBe("concept");
    expect(tierRegistration("T4").playable).toEqual([]);
    expect(tierRegistration("T5")).toEqual({
      tier: "T5",
      playable: ["collateral-rule"],
      locked: ["time-pressure", "several-traces"],
    });
    expect(roundKind("collateral-rule")).toBe("concept");
    for (const id of [
      "aoa-bearings",
      "spot-label",
      "rgpo-label",
      "vgpo-label",
      "comms-dsss",
      "comms-select",
      "false-track",
      "gnss-term",
      "denial-choice",
      "time-pressure",
      "several-traces",
    ]) {
      expect(roundKind(id)).toBe("locked");
      expect(skillNodeById.get(id)?.criterion).toEqual({ source: "unavailable" });
    }
  });
});

describe("fictional grid", () => {
  it("is deterministic and the shared cell is the answer", () => {
    const round = generateGridRound(11);
    expect(generateGridRound(11)).toEqual(round);
    const [lampA, lampB] = round.lines;
    expect(lampA?.id).toBe("lamp-a");
    expect(lampB?.id).toBe("lamp-b");
    const shared = (lampA?.cells ?? []).filter((cell) =>
      (lampB?.cells ?? []).some((other) => other.col === cell.col && other.row === cell.row),
    );
    expect(shared).toEqual([round.answer]);
    expect(scoreGridPick(round, round.answer, 250).correct).toBe(true);
    expect(
      scoreGridPick(round, { col: (round.answer.col + 1) % 4, row: round.answer.row }, 10).correct,
    ).toBe(false);
    const blob = JSON.stringify(round).toLowerCase();
    expect(blob).not.toMatch(/\b(lat|lon|latitude|longitude|mhz|power)\b/);
  });

  it("rejects location fields", () => {
    const round = generateGridRound(2);
    expect(gridRoundSchema.safeParse({ ...round, lat: 1 }).success).toBe(false);
    expect(gridRoundSchema.safeParse({ ...round, lon: 1 }).success).toBe(false);
    expect(gridRoundSchema.safeParse({ ...round, coordinates: { lat: 0, lon: 0 } }).success).toBe(
      false,
    );
    expect(gridRoundSchema.safeParse({ ...round, power: 12 }).success).toBe(false);
  });
});

describe("concept rounds", () => {
  it("asks for a definition and never names an archetype", () => {
    for (const seed of [1, 2, 7, 11]) {
      for (const nodeId of ["tdoa-lines", "comms-fhss", "collateral-rule"] as const) {
        const round = generateConceptRound(nodeId, seed);
        expect(generateConceptRound(nodeId, seed)).toEqual(round);
        expect(round.ask).toBe("definition");
        expect(round.operational).toBe(false);
        const blob = JSON.stringify(round).toLowerCase();
        expect(blob).not.toMatch(/\b(lat|lon|latitude|longitude|mhz|power|waveform|ribbon)\b/);
        expect(blob).not.toContain("how to");
        expect(scoreConceptPick(round, round.answerId, 200).correct).toBe(true);
        expect(scoreConceptPick(round, "nope", 200).correct).toBe(false);
        expect(conceptRoundSchema.safeParse({ ...round, power: 1 }).success).toBe(false);
      }
    }
    const tdoa = generateConceptRound("tdoa-lines", 3);
    expect(tdoa.choices.find((choice) => choice.id === "tdoa")?.text).toBe(
      resolveGlossaryEntry("tdoa")?.definition,
    );
    const fhss = generateConceptRound("comms-fhss", 5);
    expect(fhss.choices.find((choice) => choice.id === "fhss")?.text).toBe(
      resolveGlossaryEntry("fhss")?.definition,
    );
    const board = generateConceptRound("collateral-rule", 9);
    expect(board.answerId).toBe("protected");
    expect(board.choices.map((choice) => choice.id).sort()).toEqual([
      "clear",
      "protected",
      "uncertain",
    ]);
  });
});

describe("tier evidence", () => {
  it("drops a document that fails the strict schema", () => {
    const store = keyedStore();
    const evidence = recordGridAttempt(emptyTierEvidence(), true, 400);
    saveTierEvidence(store, evidence);
    expect(loadTierEvidence(store)).toEqual(evidence);
    saveTierAcknowledgment(store, true);
    expect(loadTierAcknowledgment(store)).toBe(true);

    store.setItem(
      TIER_EVIDENCE_STORAGE_NAME,
      JSON.stringify({ ...evidence, lat: 0, coordinates: { lat: 1, lon: 2 } }),
    );
    expect(loadTierEvidence(store)).toEqual(emptyTierEvidence());
    store.setItem(
      TIER_ACK_STORAGE_NAME,
      JSON.stringify({ schema: "an-alq.tier-acknowledgment.v1", convergingFix: true, power: 1 }),
    );
    expect(loadTierAcknowledgment(store)).toBe(false);
    store.setItem(TIER_EVIDENCE_STORAGE_NAME, "{");
    expect(loadTierEvidence(store)).toEqual(emptyTierEvidence());
  });
});

function keyedStore(): TierStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
