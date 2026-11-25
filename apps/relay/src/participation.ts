// SPDX-License-Identifier: MIT
import { activityScore } from "./decay.js";
import { clamp01, easeOutCubic, pulseFromActivity, type PulseConfig } from "./pulse.js";
import type { ContributionNode } from "./types.js";

export interface GlowConfig {
  halfLifeMs: number;
  minActivity: number;
  lingerMin: number;
  lingerMax: number;
  baseLingerMs: number;
  saturation: number;
  pulse: PulseConfig;
}

export const DEFAULT_GLOW: GlowConfig = {
  halfLifeMs: 10 * 60_000,
  minActivity: 0.2,
  lingerMin: 1,
  lingerMax: 1.45,
  baseLingerMs: 12 * 60_000,
  saturation: 6,
  pulse: { minPeriodMs: 480, maxPeriodMs: 2_600, saturation: 6 },
};

/**
 * Visual weight for the skill-map slot `participation-glow-ring`.
 * `intensity` is null when the contribution has decayed. It is not a score,
 * a rank, or a count. The training map reads this one field.
 */
export interface ParticipationGlow {
  intensity: number | null;
}

export interface ContributionSignal extends ParticipationGlow {
  periodMs: number;
  lingerMs: number;
  alive: boolean;
}

export function lingerMultiplier(score: number, config: GlowConfig = DEFAULT_GLOW): number {
  const saturation = config.saturation <= 0 ? 1 : config.saturation;
  const t = easeOutCubic(clamp01(score / saturation));
  const multiplier = config.lingerMin + (config.lingerMax - config.lingerMin) * t;
  return Math.min(config.lingerMax, Math.max(config.lingerMin, multiplier));
}

/**
 * Pure function a future avatar ring calls locally.
 * Pass timestamps kept in the browser. Do not send them to the server.
 */
export function contributionSignal(
  times: readonly number[],
  now: number,
  config: GlowConfig = DEFAULT_GLOW,
): ContributionSignal {
  const score = activityScore(times, now, config.halfLifeMs);
  const pulse = pulseFromActivity(score, { ...config.pulse, saturation: config.saturation });
  const alive = times.length > 0 && score >= config.minActivity;
  if (!alive) {
    return { intensity: null, periodMs: pulse.periodMs, lingerMs: 0, alive: false };
  }
  const intensity = Math.round(easeOutCubic(clamp01(score / config.saturation)) * 1000) / 1000;
  return {
    intensity,
    periodMs: pulse.periodMs,
    lingerMs: Math.round(config.baseLingerMs * lingerMultiplier(score, config)),
    alive: true,
  };
}

export function toParticipationGlow(signal: ContributionSignal): ParticipationGlow {
  return { intensity: signal.intensity };
}

interface Slot {
  key: string;
  times: number[];
  sector: number;
  ring: number;
}

/**
 * Anonymous contribution slots. The key is an ephemeral hash and is never
 * copied into `nodes()`. Slots are not tied to a signal id.
 */
export class ContributionLedger {
  #slots: Slot[] = [];
  #index = new Map<string, Slot>();
  #sectors: number;
  #rings: number;

  constructor(
    private readonly config: GlowConfig,
    sectors = 12,
    rings = 3,
  ) {
    this.#sectors = sectors;
    this.#rings = rings;
  }

  record(ephemeralKey: string, when: number): void {
    let slot = this.#index.get(ephemeralKey);
    if (!slot) {
      const n = this.#slots.length;
      slot = {
        key: ephemeralKey,
        times: [],
        sector: n % this.#sectors,
        ring: Math.floor(n / this.#sectors) % this.#rings,
      };
      this.#slots.push(slot);
      this.#index.set(ephemeralKey, slot);
    }
    slot.times.push(when);
    if (slot.times.length > 48) slot.times.splice(0, slot.times.length - 48);
  }

  clear(): void {
    this.#slots = [];
    this.#index.clear();
  }

  prune(now: number): void {
    const next: Slot[] = [];
    this.#index.clear();
    for (const slot of this.#slots) {
      if (!contributionSignal(slot.times, now, this.config).alive) continue;
      next.push(slot);
      this.#index.set(slot.key, slot);
    }
    this.#slots = next;
  }

  nodes(now: number): ContributionNode[] {
    this.prune(now);
    const merged = new Map<string, ContributionNode>();
    for (const slot of this.#slots) {
      const signal = contributionSignal(slot.times, now, this.config);
      if (signal.intensity === null) continue;
      const id = `${slot.ring}:${slot.sector}`;
      const current = merged.get(id);
      if (!current || signal.intensity > current.opacity) {
        merged.set(id, { sector: slot.sector, ring: slot.ring, opacity: signal.intensity });
      }
    }
    return [...merged.values()].sort((a, b) => a.ring - b.ring || a.sector - b.sector);
  }
}
