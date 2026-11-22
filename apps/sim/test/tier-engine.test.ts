import { describe, expect, it } from "vitest";
import { generateRound } from "../src/engine/generator.js";
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

  it("registers one T2 grid node and leaves the other tiers locked", () => {
    expect(tierRegistration("T2")).toEqual({
      tier: "T2",
      playable: ["converging-fix"],
      locked: ["tdoa-lines", "aoa-bearings"],
    });
    expect(roundKind("converging-fix")).toBe("grid");
    expect(gridRound(4)).toEqual(generateGridRound(4));
    expect(tierRegistration("T3")).toEqual({
      tier: "T3",
      playable: ["barrage-label"],
      locked: [
        "spot-label",
        "rgpo-label",
        "vgpo-label",
        "comms-fhss",
        "comms-dsss",
        "comms-select",
      ],
    });
    expect(tierRegistration("T4").playable).toEqual([]);
    expect(tierRegistration("T5").playable).toEqual([]);
    for (const id of [
      "tdoa-lines",
      "aoa-bearings",
      "spot-label",
      "rgpo-label",
      "vgpo-label",
      "comms-fhss",
      "comms-dsss",
      "comms-select",
      "false-track",
      "gnss-term",
      "denial-choice",
      "collateral-rule",
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
