// SPDX-License-Identifier: MIT
import { z } from "zod/v3";
import { CONCEPT_NODE_IDS, type ConceptNodeId } from "./concept-round.js";
import { GRID_NODE_ID } from "./grid-round.js";

export const TIER_EVIDENCE_SCHEMA = "an-alq.tier-evidence.v1" as const;
export const TIER_EVIDENCE_STORAGE_NAME = "an-alq.tier-evidence.v1";
export const TIER_ACK_SCHEMA = "an-alq.tier-acknowledgment.v1" as const;
export const TIER_ACK_STORAGE_NAME = "an-alq.tier-acknowledgment.v1";

export const TIER_NODE_IDS = [GRID_NODE_ID, ...CONCEPT_NODE_IDS] as const;
export type TierNodeId = (typeof TIER_NODE_IDS)[number];

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
        "tdoa-lines": attemptSchema.optional(),
        "comms-fhss": attemptSchema.optional(),
        "collateral-rule": attemptSchema.optional(),
      })
      .strict(),
  })
  .strict();

const ackSchema = z
  .object({
    schema: z.literal(TIER_ACK_SCHEMA),
    convergingFix: z.boolean(),
    tdoaLines: z.boolean().optional(),
    commsFhss: z.boolean().optional(),
    collateralRule: z.boolean().optional(),
  })
  .strict();

export interface TierAttemptRecord {
  attempts: number;
  correct: number;
  correctElapsedMs: number;
}

export interface TierEvidence {
  schema: typeof TIER_EVIDENCE_SCHEMA;
  byNode: Record<TierNodeId, TierAttemptRecord>;
}

export interface TierAcks {
  "converging-fix": boolean;
  "tdoa-lines": boolean;
  "comms-fhss": boolean;
  "collateral-rule": boolean;
}

export interface TierContext {
  evidence: TierEvidence;
  acknowledged: boolean;
  acks?: TierAcks;
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
    byNode: {
      "converging-fix": emptyRecord(),
      "tdoa-lines": emptyRecord(),
      "comms-fhss": emptyRecord(),
      "collateral-rule": emptyRecord(),
    },
  };
}

export function emptyTierAcks(): TierAcks {
  return {
    "converging-fix": false,
    "tdoa-lines": false,
    "comms-fhss": false,
    "collateral-rule": false,
  };
}

export function emptyTierContext(): TierContext {
  return { evidence: emptyTierEvidence(), acknowledged: false, acks: emptyTierAcks() };
}

export function isTierNodeId(id: string): id is TierNodeId {
  return (TIER_NODE_IDS as readonly string[]).includes(id);
}

export function recordTierAttempt(
  evidence: TierEvidence,
  nodeId: TierNodeId,
  correct: boolean,
  elapsedMs: number,
): TierEvidence {
  const current = evidence.byNode[nodeId];
  const next = { ...current, attempts: current.attempts + 1 };
  if (correct) {
    next.correct += 1;
    next.correctElapsedMs += Math.max(0, elapsedMs);
  }
  return { schema: TIER_EVIDENCE_SCHEMA, byNode: { ...evidence.byNode, [nodeId]: next } };
}

export function recordGridAttempt(
  evidence: TierEvidence,
  correct: boolean,
  elapsedMs: number,
): TierEvidence {
  return recordTierAttempt(evidence, GRID_NODE_ID, correct, elapsedMs);
}

function filled(parsed: z.infer<typeof evidenceSchema>): TierEvidence | null {
  const next = emptyTierEvidence();
  for (const id of TIER_NODE_IDS) {
    const record = parsed.byNode[id];
    if (!record) continue;
    if (record.correct > record.attempts) return null;
    next.byNode[id] = record;
  }
  return next;
}

export function loadTierEvidence(store: TierStore | null): TierEvidence {
  if (!store) return emptyTierEvidence();
  const raw = store.getItem(TIER_EVIDENCE_STORAGE_NAME);
  if (!raw) return emptyTierEvidence();
  try {
    const parsed = evidenceSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return emptyTierEvidence();
    return filled(parsed.data) ?? emptyTierEvidence();
  } catch {
    return emptyTierEvidence();
  }
}

export function saveTierEvidence(store: TierStore, evidence: TierEvidence): void {
  store.setItem(TIER_EVIDENCE_STORAGE_NAME, JSON.stringify(evidence));
}

export function loadTierAcks(store: TierStore | null): TierAcks {
  const empty = emptyTierAcks();
  if (!store) return empty;
  const raw = store.getItem(TIER_ACK_STORAGE_NAME);
  if (!raw) return empty;
  try {
    const parsed = ackSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return empty;
    return {
      "converging-fix": parsed.data.convergingFix,
      "tdoa-lines": parsed.data.tdoaLines ?? false,
      "comms-fhss": parsed.data.commsFhss ?? false,
      "collateral-rule": parsed.data.collateralRule ?? false,
    };
  } catch {
    return empty;
  }
}

export function loadTierAcknowledgment(store: TierStore | null): boolean {
  return loadTierAcks(store)["converging-fix"];
}

export function saveTierAcks(store: TierStore, acks: TierAcks): void {
  store.setItem(
    TIER_ACK_STORAGE_NAME,
    JSON.stringify({
      schema: TIER_ACK_SCHEMA,
      convergingFix: acks["converging-fix"],
      tdoaLines: acks["tdoa-lines"],
      commsFhss: acks["comms-fhss"],
      collateralRule: acks["collateral-rule"],
    }),
  );
}

export function saveTierAcknowledgment(store: TierStore, acknowledged: boolean): void {
  const current = loadTierAcks(store);
  saveTierAcks(store, { ...current, "converging-fix": acknowledged });
}

export type { ConceptNodeId };
