import { EMITTER_CATEGORIES, type EmitterCategory } from "@an-alq/emitters";
import { CLASSIFY_WINDOW_MS } from "./types.js";

export interface GradeInput {
  primaryId: string;
  answerId: string | null;
  elapsedMs: number;
  streak: number;
  windowMs?: number;
}

export interface Grade {
  correct: boolean;
  reason: "correct" | "incorrect" | "timeout";
  points: number;
  streak: number;
  elapsedMs: number;
}

export interface Stats {
  attempted: number;
  correct: number;
  incorrect: number;
  timeouts: number;
  streak: number;
  bestStreak: number;
  points: number;
}

export const EMPTY_STATS: Stats = {
  attempted: 0,
  correct: 0,
  incorrect: 0,
  timeouts: 0,
  streak: 0,
  bestStreak: 0,
  points: 0,
};

export function gradeAnswer(input: GradeInput): Grade {
  const windowMs = input.windowMs ?? CLASSIFY_WINDOW_MS;
  const elapsedMs = Math.max(0, input.elapsedMs);
  const answered = input.answerId !== null && input.answerId.length > 0;
  if (!answered || elapsedMs > windowMs) {
    return { correct: false, reason: "timeout", points: 0, streak: 0, elapsedMs };
  }
  if (input.answerId !== input.primaryId) {
    return { correct: false, reason: "incorrect", points: 0, streak: 0, elapsedMs };
  }
  const streak = input.streak + 1;
  const timeBonus = Math.round(Math.max(0, windowMs - elapsedMs) / 20);
  const streakBonus = Math.min(50, (streak - 1) * 10);
  return {
    correct: true,
    reason: "correct",
    points: 100 + timeBonus + streakBonus,
    streak,
    elapsedMs,
  };
}

export function applyGrade(stats: Stats, grade: Grade): Stats {
  return {
    attempted: stats.attempted + 1,
    correct: stats.correct + (grade.correct ? 1 : 0),
    incorrect: stats.incorrect + (grade.reason === "incorrect" ? 1 : 0),
    timeouts: stats.timeouts + (grade.reason === "timeout" ? 1 : 0),
    streak: grade.streak,
    bestStreak: Math.max(stats.bestStreak, grade.streak),
    points: stats.points + grade.points,
  };
}

export function accuracy(stats: Stats): number {
  if (stats.attempted === 0) return 0;
  return stats.correct / stats.attempted;
}

const SPARK_LIMIT = 16;

export interface CategoryTrack {
  category: EmitterCategory;
  attempts: number;
  correct: number;
  reactionSumMs: number;
  reactionCount: number;
  recent: Array<0 | 1>;
}

export interface SessionStats extends Stats {
  reactionSumMs: number;
  reactionCount: number;
  categories: CategoryTrack[];
}

export function emptySession(): SessionStats {
  return {
    ...EMPTY_STATS,
    reactionSumMs: 0,
    reactionCount: 0,
    categories: EMITTER_CATEGORIES.map((category) => ({
      category,
      attempts: 0,
      correct: 0,
      reactionSumMs: 0,
      reactionCount: 0,
      recent: [],
    })),
  };
}

export function meanReactionMs(
  stats: Pick<SessionStats, "reactionCount" | "reactionSumMs">,
): number | null {
  if (stats.reactionCount === 0) return null;
  return stats.reactionSumMs / stats.reactionCount;
}

export function applySession(
  stats: SessionStats,
  input: { category: EmitterCategory; grade: Grade },
): SessionStats {
  const base = applyGrade(stats, input.grade);
  const reacted = input.grade.reason !== "timeout";
  const elapsed = reacted ? input.grade.elapsedMs : 0;
  return {
    ...base,
    reactionSumMs: stats.reactionSumMs + elapsed,
    reactionCount: stats.reactionCount + (reacted ? 1 : 0),
    categories: stats.categories.map((track) => {
      if (track.category !== input.category) return track;
      const recent =
        track.recent.length >= SPARK_LIMIT ? track.recent.slice(1) : track.recent.slice();
      recent.push(input.grade.correct ? 1 : 0);
      return {
        ...track,
        attempts: track.attempts + 1,
        correct: track.correct + (input.grade.correct ? 1 : 0),
        reactionSumMs: track.reactionSumMs + elapsed,
        reactionCount: track.reactionCount + (reacted ? 1 : 0),
        recent,
      };
    }),
  };
}
