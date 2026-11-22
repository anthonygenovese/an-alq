import { z } from "zod/v3";
import { GRID_NODE_ID } from "./grid-round.js";

export const TIER_EVIDENCE_SCHEMA = "an-alq.tier-evidence.v1" as const;
export const TIER_EVIDENCE_STORAGE_NAME = "an-alq.tier-evidence.v1";
export const TIER_ACK_SCHEMA = "an-alq.tier-acknowledgment.v1" as const;
export const TIER_ACK_STORAGE_NAME = "an-alq.tier-acknowledgment.v1";

const attemptSchema = z
  .object({
    attempts: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    correctElapsedMs: z.number().nonnegative(),
  })
  .strict();

const evidenceSchema = z
  .object({
    schema: z.literal(TIER_EVIDENCE_SCHEMA),
    byNode: z
      .object({
        [GRID_NODE_ID]: attemptSchema,
      })
      .strict(),
  })
  .strict();

const ackSchema = z
  .object({
    schema: z.literal(TIER_ACK_SCHEMA),
    convergingFix: z.boolean(),
  })
  .strict();

export interface TierAttemptRecord {
  attempts: number;
  correct: number;
  correctElapsedMs: number;
}

export interface TierEvidence {
  schema: typeof TIER_EVIDENCE_SCHEMA;
  byNode: { [GRID_NODE_ID]: TierAttemptRecord };
}

export interface TierContext {
  evidence: TierEvidence;
  acknowledged: boolean;
}

export interface TierStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function emptyRecord(): TierAttemptRecord {
  return { attempts: 0, correct: 0, correctElapsedMs: 0 };
}

export function emptyTierEvidence(): TierEvidence {
  return {
    schema: TIER_EVIDENCE_SCHEMA,
    byNode: { [GRID_NODE_ID]: emptyRecord() },
  };
}

export function emptyTierContext(): TierContext {
  return { evidence: emptyTierEvidence(), acknowledged: false };
}

export function recordGridAttempt(
  evidence: TierEvidence,
  correct: boolean,
  elapsedMs: number,
): TierEvidence {
  const current = evidence.byNode[GRID_NODE_ID];
  const next = { ...current, attempts: current.attempts + 1 };
  if (correct) {
    next.correct += 1;
    next.correctElapsedMs += Math.max(0, elapsedMs);
  }
  return { schema: TIER_EVIDENCE_SCHEMA, byNode: { [GRID_NODE_ID]: next } };
}

export function loadTierEvidence(store: TierStore | null): TierEvidence {
  if (!store) return emptyTierEvidence();
  const raw = store.getItem(TIER_EVIDENCE_STORAGE_NAME);
  if (!raw) return emptyTierEvidence();
  try {
    const parsed = evidenceSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return emptyTierEvidence();
    const record = parsed.data.byNode[GRID_NODE_ID];
    if (record.correct > record.attempts) return emptyTierEvidence();
    return parsed.data;
  } catch {
    return emptyTierEvidence();
  }
}

export function saveTierEvidence(store: TierStore, evidence: TierEvidence): void {
  store.setItem(TIER_EVIDENCE_STORAGE_NAME, JSON.stringify(evidence));
}

export function loadTierAcknowledgment(store: TierStore | null): boolean {
  if (!store) return false;
  const raw = store.getItem(TIER_ACK_STORAGE_NAME);
  if (!raw) return false;
  try {
    const parsed = ackSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return false;
    return parsed.data.convergingFix;
  } catch {
    return false;
  }
}

export function saveTierAcknowledgment(store: TierStore, acknowledged: boolean): void {
  store.setItem(
    TIER_ACK_STORAGE_NAME,
    JSON.stringify({ schema: TIER_ACK_SCHEMA, convergingFix: acknowledged }),
  );
}
