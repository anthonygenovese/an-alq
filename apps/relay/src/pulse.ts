// SPDX-License-Identifier: MIT
import type { Pulse } from "./types.js";

export interface PulseConfig {
  minPeriodMs: number;
  maxPeriodMs: number;
  saturation: number;
}

export const DEFAULT_PULSE: PulseConfig = {
  minPeriodMs: 480,
  maxPeriodMs: 2_600,
  saturation: 6,
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function easeOutCubic(value: number): number {
  const t = clamp01(value);
  return 1 - (1 - t) ** 3;
}

/**
 * More recent activity shortens the period and raises opacity.
 * Both ends are clamped. Ease-out makes the first relays move the rate more
 * than relays past saturation.
 */
export function pulseFromActivity(score: number, config: PulseConfig = DEFAULT_PULSE): Pulse {
  const saturation = config.saturation <= 0 ? 1 : config.saturation;
  const t = easeOutCubic(Math.min(Math.max(score, 0), saturation) / saturation);
  const periodMs = config.maxPeriodMs + (config.minPeriodMs - config.maxPeriodMs) * t;
  const opacity = 0.28 + 0.72 * t;
  return {
    periodMs: Math.round(periodMs),
    opacity: Math.round(opacity * 1000) / 1000,
  };
}

export function pulseFromRelayCount(count: number, config: PulseConfig = DEFAULT_PULSE): Pulse {
  return pulseFromActivity(Math.max(0, count), config);
}

/** Exponential approach. Does not overshoot. Used to ease displayed rates. */
export function approach(current: number, target: number, dtMs: number, tauMs: number): number {
  if (!Number.isFinite(target)) return current;
  if (!Number.isFinite(current)) return target;
  if (tauMs <= 0 || dtMs <= 0) return target;
  const k = 1 - Math.exp(-dtMs / tauMs);
  return current + (target - current) * k;
}
