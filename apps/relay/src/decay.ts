export interface DecayConfig {
  halfLifeMs: number;
  minActivity: number;
  inactivityTtlMs: number;
}

export const DEFAULT_DECAY: DecayConfig = {
  halfLifeMs: 10 * 60_000,
  minActivity: 0.2,
  inactivityTtlMs: 45 * 60_000,
};

/** Faster curve so a demo can show fade without waiting out the live policy. */
export const DEMO_DECAY: DecayConfig = {
  halfLifeMs: 45_000,
  minActivity: 0.22,
  inactivityTtlMs: 180_000,
};

/** Exponential activity. A single fresh relay scores 1. Each half-life halves it. */
export function activityScore(times: readonly number[], now: number, halfLifeMs: number): number {
  if (halfLifeMs <= 0) return 0;
  const lambda = Math.LN2 / halfLifeMs;
  let sum = 0;
  for (const time of times) {
    if (!Number.isFinite(time) || time > now) continue;
    sum += Math.exp(-lambda * (now - time));
  }
  return sum;
}

export function isExpired(
  input: { times: readonly number[]; lastSeen: number; now: number },
  config: DecayConfig,
): boolean {
  if (input.now - input.lastSeen >= config.inactivityTtlMs) return true;
  return activityScore(input.times, input.now, config.halfLifeMs) < config.minActivity;
}
