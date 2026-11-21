import { SignalBoard, type BoardConfig } from "./board.js";
import { DEMO_DECAY, DEFAULT_DECAY } from "./decay.js";
import { FIXTURES, type FixturePost } from "./demo/fixtures.js";
import { OfflineStubGeocoder } from "./geo.js";
import { parsePost } from "./parse.js";
import { ContributionLedger, DEFAULT_GLOW, type GlowConfig } from "./participation.js";
import { DEFAULT_PULSE } from "./pulse.js";
import { DEFAULT_SIMILARITY } from "./fingerprint.js";
import { sourceStatus } from "./source.js";
import { DISCLAIMER, type Geocoder, type LiveSnapshot, type RawPost } from "./types.js";

export const DEMO_EPOCH = Date.UTC(2026, 0, 15, 15, 0, 0);

export const LIVE_BOARD: BoardConfig = {
  timeWindowMs: 30 * 60_000,
  proximityMeters: 20_000,
  similarity: DEFAULT_SIMILARITY,
  decay: DEFAULT_DECAY,
  pulse: DEFAULT_PULSE,
  saltRotationMs: 15 * 60_000,
  relayStatWindowMs: 30 * 60_000,
};

export const DEMO_BOARD: BoardConfig = {
  ...LIVE_BOARD,
  decay: DEMO_DECAY,
  saltRotationMs: 24 * 60 * 60_000,
};

export const DEMO_GLOW: GlowConfig = {
  ...DEFAULT_GLOW,
  halfLifeMs: DEMO_DECAY.halfLifeMs,
  minActivity: DEMO_DECAY.minActivity,
  baseLingerMs: 120_000,
};

export function acceptRelay(
  board: SignalBoard,
  ledger: ContributionLedger,
  post: RawPost,
  geocoder: Geocoder,
  now: number,
): boolean {
  const candidate = parsePost(post, geocoder);
  if (!candidate) return false;
  const result = board.ingest(candidate, now);
  if (result.accepted && result.ephemeralKey)
    ledger.record(result.ephemeralKey, candidate.createdAt);
  return result.accepted;
}

export class DemoClock {
  #speed = 1;
  #demoAnchor = 0;
  #realAnchor: number;

  constructor(realNow: number) {
    this.#realAnchor = realNow;
  }

  now(realNow: number): number {
    return this.#demoAnchor + (realNow - this.#realAnchor) * this.#speed;
  }

  get speed(): number {
    return this.#speed;
  }

  setSpeed(speed: number, realNow: number): void {
    this.#demoAnchor = this.now(realNow);
    this.#realAnchor = realNow;
    this.#speed = speed;
  }

  reset(realNow: number): void {
    this.#demoAnchor = 0;
    this.#realAnchor = realNow;
    this.#speed = 1;
  }
}

export const SPEED_STEPS = [1, 2, 4, 8, 16, 32, 60] as const;

export function isSpeedStep(value: number): boolean {
  return (SPEED_STEPS as readonly number[]).includes(value);
}

export class DemoSimulator {
  #cursor = 0;
  readonly board: SignalBoard;
  readonly ledger: ContributionLedger;
  readonly geocoder: Geocoder;
  #fixtures: readonly FixturePost[];

  constructor(geocoder: Geocoder = new OfflineStubGeocoder()) {
    this.geocoder = geocoder;
    this.board = new SignalBoard(DEMO_BOARD);
    this.ledger = new ContributionLedger(DEMO_GLOW);
    this.#fixtures = [...FIXTURES].sort(
      (a, b) => a.atMs - b.atMs || a.token.localeCompare(b.token),
    );
  }

  reset(): void {
    this.#cursor = 0;
    this.board.clear();
    this.ledger.clear();
  }

  advanceTo(demoElapsedMs: number): void {
    const now = DEMO_EPOCH + demoElapsedMs;
    while (this.#cursor < this.#fixtures.length) {
      const fixture = this.#fixtures[this.#cursor];
      if (!fixture || fixture.atMs > demoElapsedMs) break;
      this.#cursor += 1;
      acceptRelay(
        this.board,
        this.ledger,
        {
          text: fixture.text,
          createdAt: DEMO_EPOCH + fixture.atMs,
          urls: fixture.urls ?? [],
          accountMaterial: fixture.token,
          postMaterial: `${fixture.token}:${fixture.atMs}`,
        },
        this.geocoder,
        now,
      );
    }
    this.board.prune(now);
    this.ledger.prune(now);
  }

  snapshot(demoElapsedMs: number, speed: number): LiveSnapshot {
    const now = DEMO_EPOCH + demoElapsedMs;
    this.board.prune(now);
    this.ledger.prune(now);
    return {
      mode: "demo",
      demo: true,
      now: new Date(now).toISOString(),
      speed,
      disclaimer: DISCLAIMER,
      signals: this.board.signals(now),
      stats: {
        liveSignals: this.board.size,
        relaysInWindow: this.board.relayCountInWindow(now),
        windowMs: DEMO_BOARD.relayStatWindowMs,
      },
      contribution: { nodes: this.ledger.nodes(now) },
      sources: sourceStatus({ xEnabled: true }),
    };
  }
}
