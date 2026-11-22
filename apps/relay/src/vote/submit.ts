import type { SignalBoard } from "../board.js";
import { isNullifier } from "./nullifier.js";
import { freshAt } from "./date.js";
import type { ProofVerifier, VoteProof } from "./verifier.js";

export const DEFAULT_FRESHNESS_MS = 60 * 60 * 1000;

export type Assurance = "zk" | "fallback";

export type VoteDecision =
  | { ok: true; assurance: Assurance; signalId: string }
  | {
      ok: false;
      reason: "rejected" | "stale" | "unknown_alert" | "duplicate" | "rate_limited" | "unverified";
    };

export interface FallbackVoteLimit {
  allow(alertKey: string, now: number): boolean;
}

export class WindowVoteLimit implements FallbackVoteLimit {
  #hits: { key: string; at: number }[] = [];

  constructor(
    private readonly perAlert: number,
    private readonly global: number,
    private readonly windowMs: number,
  ) {}

  allow(alertKey: string, now: number): boolean {
    this.#hits = this.#hits.filter((hit) => now - hit.at <= this.windowMs);
    const onAlert = this.#hits.filter((hit) => hit.key === alertKey).length;
    if (onAlert >= this.perAlert || this.#hits.length >= this.global) return false;
    this.#hits.push({ key: alertKey, at: now });
    return true;
  }
}

export interface VoteBody {
  alertKey: string;
  nullifier: string;
  provenDate?: string;
  proof?: VoteProof | null;
}

/** Strict vote body. Extra keys, addresses, and tokens are rejected. */
export function parseVoteBody(value: unknown): VoteBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const allowed = new Set(["alertKey", "nullifier", "provenDate", "proof"]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) return null;
  }
  if (typeof record.alertKey !== "string" || record.alertKey.length > 80) return null;
  if (typeof record.nullifier !== "string" || !isNullifier(record.nullifier)) return null;
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(record.alertKey)) return null;
  let provenDate: string | undefined;
  if (record.provenDate !== undefined && record.provenDate !== null) {
    if (typeof record.provenDate !== "string" || !Number.isFinite(Date.parse(record.provenDate)))
      return null;
    provenDate = new Date(Date.parse(record.provenDate)).toISOString();
  }
  const proof =
    record.proof === undefined || record.proof === null ? null : readProof(record.proof);
  if (proof === undefined) return null;
  return { alertKey: record.alertKey, nullifier: record.nullifier, provenDate, proof };
}

/**
 * ZK proof first. If the verifier is not deployed, a fallback receipt is
 * accepted only for an alert this process already holds, and only while that
 * alert's first-seen time is inside the freshness window.
 */
export function submitVote(
  board: SignalBoard,
  body: VoteBody,
  now: number,
  verifier: ProofVerifier,
  limiter: FallbackVoteLimit,
  freshnessMs = DEFAULT_FRESHNESS_MS,
): VoteDecision {
  const found = board.findAlert(body.alertKey);
  if (body.proof) {
    const verified = verifier.verify(body.proof);
    const proven = body.provenDate ?? body.proof.provenDate;
    if (
      verified.ok &&
      proven &&
      freshAt(proven, now, freshnessMs) &&
      body.proof.alertKey === body.alertKey
    ) {
      if (!found) return { ok: false, reason: "unknown_alert" };
      if (board.hasNullifier(found.id, body.nullifier)) return { ok: false, reason: "duplicate" };
      board.addNullifier(found.id, body.nullifier, "zk");
      return { ok: true, assurance: "zk", signalId: found.id };
    }
    if (verified.ok && proven && !freshAt(proven, now, freshnessMs))
      return { ok: false, reason: "stale" };
  }
  if (!found) return { ok: false, reason: "unknown_alert" };
  if (now - found.firstSeen > freshnessMs) return { ok: false, reason: "stale" };
  if (board.hasNullifier(found.id, body.nullifier)) return { ok: false, reason: "duplicate" };
  if (!limiter.allow(body.alertKey, now)) return { ok: false, reason: "rate_limited" };
  board.addNullifier(found.id, body.nullifier, "fallback");
  return { ok: true, assurance: "fallback", signalId: found.id };
}

function readProof(value: unknown): VoteProof | null | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const keys = ["alertKey", "nullifier", "provenDate", "dkimDomain", "selector", "bytes"];
  for (const key of Object.keys(record)) {
    if (!keys.includes(key)) return undefined;
  }
  for (const key of keys) {
    if (typeof record[key] !== "string") return undefined;
  }
  return {
    alertKey: record.alertKey as string,
    nullifier: record.nullifier as string,
    provenDate: record.provenDate as string,
    dkimDomain: record.dkimDomain as string,
    selector: record.selector as string,
    bytes: record.bytes as string,
  };
}
