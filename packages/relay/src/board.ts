import { preferCategory } from "./classify.js";
import { isExpired, type DecayConfig } from "./decay.js";
import { distanceMeters } from "./geo.js";
import { jaccard, shingles, textSimilar, type SimilarityConfig } from "./fingerprint.js";
import { RotatingSalt } from "./privacy.js";
import { activityScore } from "./decay.js";
import { pulseFromActivity, type PulseConfig } from "./pulse.js";
import type { Candidate, Category, GeoPoint, LiveSignal } from "./types.js";

export interface BoardConfig {
  timeWindowMs: number;
  proximityMeters: number;
  similarity: SimilarityConfig;
  decay: DecayConfig;
  pulse: PulseConfig;
  saltRotationMs: number;
  relayStatWindowMs: number;
}

interface Live {
  id: string;
  normalizedText: string;
  shingles: string[];
  summary: string;
  category: Category;
  nixleKey: string | null;
  nixleUrl: string | null;
  agency: string | null;
  jurisdiction: string | null;
  location: GeoPoint | null;
  firstSeen: number;
  lastSeen: number;
  times: number[];
  seen: Set<string>;
  /** Per-signal nullifiers. Dropped with the signal when it decays. */
  nullifiers: Map<string, "zk" | "fallback">;
}

export interface IngestResult {
  accepted: boolean;
  signalId: string;
  ephemeralKey: string | null;
}

const MAX_TIMES = 48;

/**
 * In-memory signals. Decay removes them. There is no disk store.
 * Seen-keys are salted hashes held only long enough to ignore a repeat.
 */
export class SignalBoard {
  #signals: Live[] = [];
  #seq = 1;
  #salt: RotatingSalt;
  #generation: number;

  constructor(
    private readonly config: BoardConfig,
    random?: () => Buffer,
  ) {
    this.#salt = new RotatingSalt(config.saltRotationMs, random, 0);
    this.#generation = this.#salt.generation;
  }

  get size(): number {
    return this.#signals.length;
  }

  ingest(candidate: Candidate, now: number): IngestResult {
    this.#rollSalt(now);
    const key = this.#key(candidate, now);
    const match = this.#best(candidate);
    if (match) {
      if (key && match.seen.has(key)) {
        return { accepted: false, signalId: match.id, ephemeralKey: key };
      }
      if (key) match.seen.add(key);
      this.#absorb(match, candidate);
      return { accepted: true, signalId: match.id, ephemeralKey: key };
    }
    const created = this.#create(candidate, key);
    return { accepted: true, signalId: created.id, ephemeralKey: key };
  }

  prune(now: number): void {
    this.#rollSalt(now);
    this.#signals = this.#signals.filter(
      (signal) =>
        !isExpired({ times: signal.times, lastSeen: signal.lastSeen, now }, this.config.decay),
    );
  }

  rotate(now: number): void {
    this.#salt.rotate(now);
    this.#forgetHashes();
  }

  /** Drops every signal. Decay already does this over time; reset does it at once. */
  clear(): void {
    this.#signals = [];
    this.#seq = 1;
  }

  signals(now: number): LiveSignal[] {
    this.prune(now);
    return this.#signals
      .slice()
      .sort((a, b) => a.firstSeen - b.firstSeen || a.id.localeCompare(b.id))
      .map((signal) => this.#publish(signal, now));
  }

  relayCountInWindow(now: number, windowMs = this.config.relayStatWindowMs): number {
    this.prune(now);
    let count = 0;
    for (const signal of this.#signals) {
      for (const time of signal.times) {
        if (time <= now && now - time <= windowMs) count += 1;
      }
    }
    return count;
  }

  #rollSalt(now: number): void {
    const rotated = this.#salt.rotateIfDue(now);
    if (!rotated && this.#salt.generation === this.#generation) return;
    this.#forgetHashes();
  }

  #forgetHashes(): void {
    this.#generation = this.#salt.generation;
    for (const signal of this.#signals) signal.seen.clear();
  }

  #key(candidate: Candidate, now: number): string | null {
    const identity = candidate.nixleKey ?? candidate.normalizedText;
    if (candidate.accountMaterial) {
      return this.#salt.hash(`${candidate.accountMaterial}|${identity}`, now);
    }
    if (candidate.postMaterial) return this.#salt.hash(`post|${candidate.postMaterial}`, now);
    return null;
  }

  #best(candidate: Candidate): Live | null {
    const matches = this.#signals.filter((signal) => this.#canMerge(signal, candidate));
    if (matches.length === 0) return null;
    matches.sort((left, right) => {
      const leftExact = left.nixleKey !== null && left.nixleKey === candidate.nixleKey ? 1 : 0;
      const rightExact = right.nixleKey !== null && right.nixleKey === candidate.nixleKey ? 1 : 0;
      if (leftExact !== rightExact) return rightExact - leftExact;
      const leftScore = jaccard(left.shingles, shingles(candidate.normalizedText));
      const rightScore = jaccard(right.shingles, shingles(candidate.normalizedText));
      if (leftScore !== rightScore) return rightScore - leftScore;
      const leftDelta = Math.abs(candidate.createdAt - left.firstSeen);
      const rightDelta = Math.abs(candidate.createdAt - right.firstSeen);
      if (leftDelta !== rightDelta) return leftDelta - rightDelta;
      return left.id.localeCompare(right.id);
    });
    return matches[0] ?? null;
  }

  #canMerge(signal: Live, candidate: Candidate): boolean {
    const start = Math.min(signal.firstSeen, candidate.createdAt);
    const end = Math.max(signal.lastSeen, candidate.createdAt);
    if (end - start > this.config.timeWindowMs) return false;
    if (signal.nixleKey && candidate.nixleKey && signal.nixleKey !== candidate.nixleKey)
      return false;
    const sameNixle = signal.nixleKey !== null && signal.nixleKey === candidate.nixleKey;
    const similar =
      sameNixle ||
      textSimilar(signal.normalizedText, candidate.normalizedText, this.config.similarity);
    if (!similar) return false;
    if (signal.location && candidate.location) {
      return distanceMeters(signal.location, candidate.location) <= this.config.proximityMeters;
    }
    if (sameNixle) return true;
    if (signal.jurisdiction && candidate.jurisdiction)
      return signal.jurisdiction === candidate.jurisdiction;
    return false;
  }

  #absorb(signal: Live, candidate: Candidate): void {
    signal.times.push(candidate.createdAt);
    if (signal.times.length > MAX_TIMES) signal.times.splice(0, signal.times.length - MAX_TIMES);
    signal.firstSeen = Math.min(signal.firstSeen, candidate.createdAt);
    signal.lastSeen = Math.max(signal.lastSeen, candidate.createdAt);
    signal.category = preferCategory(signal.category, candidate.category);
    if (!signal.nixleKey && candidate.nixleKey) signal.nixleKey = candidate.nixleKey;
    if (!signal.nixleUrl && candidate.nixleUrl) signal.nixleUrl = candidate.nixleUrl;
    if (!signal.agency && candidate.agency) signal.agency = candidate.agency;
    if (!signal.jurisdiction && candidate.jurisdiction)
      signal.jurisdiction = candidate.jurisdiction;
    if (candidate.summary.length > signal.summary.length) signal.summary = candidate.summary;
    else if (
      candidate.summary.length === signal.summary.length &&
      candidate.summary < signal.summary
    ) {
      signal.summary = candidate.summary;
    }
    if (
      candidate.location &&
      (!signal.location ||
        (signal.location.precision === "centroid" &&
          candidate.location.precision === "intersection"))
    ) {
      signal.location = candidate.location;
    }
  }

  #create(candidate: Candidate, key: string | null): Live {
    const seen = new Set<string>();
    if (key) seen.add(key);
    const signal: Live = {
      id: `sig_${this.#seq}`,
      normalizedText: candidate.normalizedText,
      shingles: shingles(candidate.normalizedText),
      summary: candidate.summary,
      category: candidate.category,
      nixleKey: candidate.nixleKey,
      nixleUrl: candidate.nixleUrl,
      agency: candidate.agency,
      jurisdiction: candidate.jurisdiction,
      location: candidate.location,
      firstSeen: candidate.createdAt,
      lastSeen: candidate.createdAt,
      times: [candidate.createdAt],
      seen,
      nullifiers: new Map(),
    };
    this.#seq += 1;
    this.#signals.push(signal);
    return signal;
  }

  #publish(signal: Live, now: number): LiveSignal {
    const score = activityScore(signal.times, now, this.config.decay.halfLifeMs);
    return {
      id: signal.id,
      category: signal.category,
      summary: signal.summary,
      agency: signal.agency,
      jurisdiction: signal.jurisdiction,
      firstSeen: new Date(signal.firstSeen).toISOString(),
      lastSeen: new Date(signal.lastSeen).toISOString(),
      nixleUrl: signal.nixleUrl,
      nixleKey: signal.nixleKey,
      location: signal.location,
      pulse: pulseFromActivity(score, this.config.pulse),
      receptions: signal.nullifiers.size,
      receptionMark: receptionMark(signal.nullifiers),
    };
  }

  findAlert(alertKey: string): { id: string; firstSeen: number } | null {
    const signal = this.#signals.find((item) => item.nixleKey === alertKey);
    if (!signal) return null;
    return { id: signal.id, firstSeen: signal.firstSeen };
  }

  hasNullifier(signalId: string, nullifier: string): boolean {
    return this.#signals.find((item) => item.id === signalId)?.nullifiers.has(nullifier) ?? false;
  }

  addNullifier(signalId: string, nullifier: string, assurance: "zk" | "fallback"): boolean {
    const signal = this.#signals.find((item) => item.id === signalId);
    if (!signal || signal.nullifiers.has(nullifier)) return false;
    signal.nullifiers.set(nullifier, assurance);
    return true;
  }

  /** Test seam. Nullifiers live only on live signals. */
  nullifierCount(): number {
    let count = 0;
    for (const signal of this.#signals) count += signal.nullifiers.size;
    return count;
  }
}

function receptionMark(nullifiers: Map<string, "zk" | "fallback">): LiveSignal["receptionMark"] {
  let zk = false;
  let fallback = false;
  for (const assurance of nullifiers.values()) {
    if (assurance === "zk") zk = true;
    else fallback = true;
  }
  if (zk && fallback) return "mixed";
  if (zk) return "zk";
  if (fallback) return "fallback";
  return "none";
}
