import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emitterById } from "@an-alq/emitters";
import { explainRound, type RoundFeedback } from "./engine/feedback.js";
import { generateRound, roundSeed } from "./engine/generator.js";
import { hashSeed } from "./engine/prng.js";
import {
  accuracy,
  applySession,
  emptySession,
  gradeAnswer,
  type Grade,
  type SessionStats,
} from "./engine/scoring.js";
import type { AttemptEvent } from "./engine/skill-map.js";
import { CLASSIFY_WINDOW_MS, type Difficulty, type TrainingRound } from "./engine/types.js";

const ACQUIRE_MS = 800;

export type Phase = "live" | "feedback";

export interface ClockSample {
  acquire: boolean;
  remainingMs: number;
}

export interface Trainer {
  sessionSeed: number;
  index: number;
  difficulty: Difficulty;
  round: TrainingRound;
  stats: SessionStats;
  accuracy: number;
  phase: Phase;
  paused: boolean;
  grade: Grade | null;
  answerId: string | null;
  feedback: RoundFeedback | null;
  litNodes: readonly string[];
  subscribe: (listener: (sample: ClockSample) => void) => () => void;
  setDifficulty: (difficulty: Difficulty) => void;
  togglePaused: () => void;
  answer: (id: string) => void;
  next: () => void;
  newSession: () => void;
}

export interface TrainerOptions {
  onGraded?: (event: AttemptEvent) => readonly string[];
}

export function useTrainer(options: TrainerOptions = {}): Trainer {
  const [sessionSeed, setSessionSeed] = useState(() => freshSeed());
  const [index, setIndex] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>("recruit");
  const [stats, setStats] = useState<SessionStats>(emptySession);
  const [paused, setPaused] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [answerId, setAnswerId] = useState<string | null>(null);
  const [litNodes, setLitNodes] = useState<readonly string[]>([]);
  const onGraded = useRef(options.onGraded);
  onGraded.current = options.onGraded;

  const round = useMemo(
    () => generateRound({ seed: roundSeed(sessionSeed, index, difficulty), difficulty }),
    [sessionSeed, index, difficulty],
  );

  const elapsedRef = useRef(0);
  const runningSince = useRef<number | null>(null);
  const locked = useRef(false);
  const statsRef = useRef(stats);
  const roundRef = useRef(round);
  const listeners = useRef(new Set<(sample: ClockSample) => void>());
  statsRef.current = stats;
  roundRef.current = round;

  const readElapsed = useCallback(() => {
    const since = runningSince.current;
    return elapsedRef.current + (since === null ? 0 : performance.now() - since);
  }, []);

  const freeze = useCallback(() => {
    if (runningSince.current === null) return;
    elapsedRef.current += performance.now() - runningSince.current;
    runningSince.current = null;
  }, []);

  const publish = useCallback((elapsed: number) => {
    const acquire = elapsed < ACQUIRE_MS;
    const remainingMs = acquire
      ? CLASSIFY_WINDOW_MS
      : Math.max(0, CLASSIFY_WINDOW_MS - (elapsed - ACQUIRE_MS));
    const sample = { acquire, remainingMs };
    for (const listener of listeners.current) listener(sample);
  }, []);

  const answer = useCallback(
    (id: string | null) => {
      if (locked.current) return;
      const current = roundRef.current;
      const timelineNow = readElapsed();
      const classify = Math.max(0, timelineNow - ACQUIRE_MS);
      if (id === null && classify < CLASSIFY_WINDOW_MS) return;
      locked.current = true;
      freeze();
      const nextGrade = gradeAnswer({
        primaryId: current.primaryId,
        answerId: id,
        elapsedMs: id === null ? CLASSIFY_WINDOW_MS + 1 : Math.min(CLASSIFY_WINDOW_MS, classify),
        streak: statsRef.current.streak,
      });
      const archetype = emitterById(current.primaryId);
      if (archetype) {
        setStats((currentStats) =>
          applySession(currentStats, { category: archetype.category, grade: nextGrade }),
        );
        const names =
          onGraded.current?.({
            category: archetype.category,
            difficulty: current.difficulty,
            correct: nextGrade.correct,
            elapsedMs: nextGrade.elapsedMs,
          }) ?? [];
        setLitNodes(names);
      }
      setGrade(nextGrade);
      setAnswerId(id);
    },
    [freeze, readElapsed],
  );

  const subscribe = useCallback((listener: (sample: ClockSample) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const togglePaused = useCallback(() => setPaused((value) => !value), []);
  const next = useCallback(() => setIndex((value) => value + 1), []);

  useEffect(() => {
    locked.current = false;
    elapsedRef.current = 0;
    runningSince.current = null;
    setGrade(null);
    setAnswerId(null);
    setLitNodes([]);
  }, [round]);

  useEffect(() => {
    if (paused || grade) {
      freeze();
      return;
    }
    if (runningSince.current === null) runningSince.current = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = readElapsed();
      publish(elapsed);
      if (elapsed >= ACQUIRE_MS + CLASSIFY_WINDOW_MS) {
        answer(null);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, grade, round, answer, freeze, publish, readElapsed]);

  useEffect(() => {
    if (!grade || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setIndex((value) => value + 1), 6800);
    return () => window.clearTimeout(timer);
  }, [grade, paused, round]);

  const phase: Phase = grade ? "feedback" : "live";
  const feedback = grade ? explainRound(round, grade, answerId) : null;

  return {
    sessionSeed,
    index,
    difficulty,
    round,
    stats,
    accuracy: accuracy(stats),
    phase,
    paused,
    grade,
    answerId,
    feedback,
    litNodes,
    subscribe,
    setDifficulty,
    togglePaused,
    answer,
    next,
    newSession: () => {
      setStats(emptySession());
      setIndex(0);
      setPaused(false);
      setSessionSeed(freshSeed());
    },
  };
}

function freshSeed(): number {
  return hashSeed(`session:${Date.now()}:${Math.random()}`) || 1;
}
