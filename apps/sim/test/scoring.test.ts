import { describe, expect, it } from "vitest";
import { emitterById, resolveGlossaryEntry } from "@an-alq/emitters";
import { explainRound } from "../src/engine/feedback.js";
import { generateRound } from "../src/engine/generator.js";
import {
  accuracy,
  applyGrade,
  applySession,
  EMPTY_STATS,
  emptySession,
  gradeAnswer,
  meanReactionMs,
  type Stats,
} from "../src/engine/scoring.js";
import { TRAINER_TIERS } from "../src/engine/tiers.js";

describe("scoring", () => {
  it("awards a correct answer inside the window and resets on a miss", () => {
    const correct = gradeAnswer({
      primaryId: "lantern-search",
      answerId: "lantern-search",
      elapsedMs: 400,
      streak: 2,
    });
    expect(correct.reason).toBe("correct");
    expect(correct.streak).toBe(3);
    expect(correct.points).toBe(100 + Math.round((2000 - 400) / 20) + 20);

    const edge = gradeAnswer({
      primaryId: "lantern-search",
      answerId: "lantern-search",
      elapsedMs: 2000,
      streak: 0,
    });
    expect(edge.correct).toBe(true);
    expect(edge.points).toBe(100);

    const late = gradeAnswer({
      primaryId: "lantern-search",
      answerId: "lantern-search",
      elapsedMs: 2001,
      streak: 4,
    });
    expect(late.reason).toBe("timeout");
    expect(late.points).toBe(0);
    expect(late.streak).toBe(0);

    const wrong = gradeAnswer({
      primaryId: "lantern-search",
      answerId: "harbor-watch",
      elapsedMs: 100,
      streak: 5,
    });
    expect(wrong.reason).toBe("incorrect");
    expect(wrong.streak).toBe(0);

    const missed = gradeAnswer({
      primaryId: "lantern-search",
      answerId: null,
      elapsedMs: 2000,
      streak: 1,
    });
    expect(missed.reason).toBe("timeout");
  });

  it("caps the streak bonus and tracks accuracy without mutating the previous stats", () => {
    const hot = gradeAnswer({
      primaryId: "a",
      answerId: "a",
      elapsedMs: 0,
      streak: 9,
    });
    expect(hot.points).toBe(100 + 100 + 50);

    let stats: Stats = EMPTY_STATS;
    const before = { ...stats };
    stats = applyGrade(
      stats,
      gradeAnswer({ primaryId: "a", answerId: "a", elapsedMs: 0, streak: 0 }),
    );
    stats = applyGrade(
      stats,
      gradeAnswer({ primaryId: "a", answerId: "b", elapsedMs: 10, streak: stats.streak }),
    );
    stats = applyGrade(
      stats,
      gradeAnswer({ primaryId: "a", answerId: null, elapsedMs: 2000, streak: stats.streak }),
    );
    expect(before).toEqual(EMPTY_STATS);
    expect(stats.attempted).toBe(3);
    expect(stats.correct).toBe(1);
    expect(stats.incorrect).toBe(1);
    expect(stats.timeouts).toBe(1);
    expect(stats.streak).toBe(0);
    expect(stats.bestStreak).toBe(1);
    expect(accuracy(EMPTY_STATS)).toBe(0);
    expect(accuracy(stats)).toBeCloseTo(1 / 3);
  });
});

describe("session stats", () => {
  it("tracks mean reaction time and a fixed per-category sparkline", () => {
    const fast = gradeAnswer({ primaryId: "a", answerId: "a", elapsedMs: 420, streak: 0 });
    const miss = gradeAnswer({
      primaryId: "a",
      answerId: "b",
      elapsedMs: 800,
      streak: fast.streak,
    });
    const timeout = gradeAnswer({ primaryId: "a", answerId: null, elapsedMs: 2400, streak: 0 });
    let session = emptySession();
    const before = session.categories.length;
    session = applySession(session, { category: "search_radar", grade: fast });
    session = applySession(session, { category: "search_radar", grade: miss });
    session = applySession(session, { category: "comms_fhss", grade: timeout });
    expect(session.categories).toHaveLength(before);
    expect(meanReactionMs(session)).toBe(610);
    expect(meanReactionMs(emptySession())).toBeNull();
    const search = session.categories.find((track) => track.category === "search_radar");
    const hops = session.categories.find((track) => track.category === "comms_fhss");
    expect(search?.recent).toEqual([1, 0]);
    expect(search?.reactionCount).toBe(2);
    expect(hops?.attempts).toBe(1);
    expect(hops?.reactionCount).toBe(0);
    expect(hops?.recent).toEqual([0]);
    let filled = emptySession();
    for (let i = 0; i < 20; i += 1) {
      filled = applySession(filled, {
        category: "gnss",
        grade: gradeAnswer({
          primaryId: "a",
          answerId: i % 2 === 0 ? "a" : "b",
          elapsedMs: 100,
          streak: 0,
        }),
      });
    }
    expect(filled.categories.find((track) => track.category === "gnss")?.recent).toHaveLength(16);
  });
});

describe("round feedback", () => {
  it("quotes the glossary entry returned by explain_ew_term", () => {
    const round = generateRound({ seed: 3, difficulty: "recruit" });
    const wrongId = round.primaryId === "coast-net" ? "lantern-search" : "coast-net";
    const grade = gradeAnswer({
      primaryId: round.primaryId,
      answerId: wrongId,
      elapsedMs: 500,
      streak: 0,
    });
    const feedback = explainRound(round, grade, wrongId);
    const primary = emitterById(round.primaryId);
    expect(primary).toBeDefined();
    expect(feedback.explanation).toContain(primary?.name);
    expect(feedback.glossary.length).toBeGreaterThan(0);
    const cited = feedback.glossary[0];
    const explained = resolveGlossaryEntry(cited?.id ?? "");
    expect(explained?.definition.length).toBeGreaterThan(20);
    if (explained && cited) expect(cited.definition).toBe(explained.definition);
    expect(grade.correct).toBe(false);
    expect(feedback.contrast).toContain(wrongId === "coast-net" ? "Coast Net" : "Lantern");
  });
});

describe("tier roadmap", () => {
  it("keeps five tiers and only T1 playable", () => {
    expect(TRAINER_TIERS.map((tier) => tier.id)).toEqual(["T1", "T2", "T3", "T4", "T5"]);
    expect(
      TRAINER_TIERS.filter((tier) => tier.status === "playable").map((tier) => tier.id),
    ).toEqual(["T1"]);
  });
});
