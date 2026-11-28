// SPDX-License-Identifier: MIT
// Display helpers for the spectral-notch page. Wire values use ASCII "-"; display uses the true
// minus U+2212. A missing or non-finite value renders as an em dash, like apps/sim/src/format.ts.

export const MINUS = "\u2212";
export const DASH = "\u2014";

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Fixed decimals, no -0, true minus. `signed` adds "+" to positive values. */
export function formatNumber(value: number | null | undefined, dp: number, signed = false): string {
  if (!finite(value)) return DASH;
  const rounded = Number(value.toFixed(dp));
  const text = Math.abs(rounded).toFixed(dp);
  if (rounded === 0) return text;
  if (rounded < 0) return `${MINUS}${text}`;
  return signed ? `+${text}` : text;
}

export function formatDb(value: number | null | undefined, dp = 1, signed = false): string {
  const text = formatNumber(value, dp, signed);
  return text === DASH ? text : `${text} dB`;
}

/** A positive magnitude of a negative quantity, clamped at 0.0 ("peak loss 1.4 dB"). */
export function formatDbMagnitude(value: number | null | undefined, dp = 1): string {
  if (!finite(value)) return DASH;
  return `${Math.max(0, -value).toFixed(dp)} dB`;
}

/** Measured notch depth: the wire `inband_depth_db` is negative, or slightly positive from ripple. */
export function notchDepthMagnitude(inbandDepthDb: number): number {
  return Math.max(0, -inbandDepthDb);
}

export function formatUs(value: number | null | undefined, dp = 4): string {
  if (!finite(value)) return DASH;
  return `${value.toFixed(dp)} \u00b5s`;
}

export function formatMhz(value: number | null | undefined, dp = 1): string {
  if (!finite(value)) return DASH;
  return `${formatNumber(value, dp)} MHz`;
}

export function formatPct(value: number | null | undefined, dp = 1): string {
  if (!finite(value)) return DASH;
  return `${value.toFixed(dp)} %`;
}

export function formatRatio(
  value: number | null | undefined,
  baseline: number | null | undefined,
): string {
  if (!finite(value) || !finite(baseline) || baseline === 0) return DASH;
  return `\u00d7${(value / baseline).toFixed(2)}`;
}

export type DeltaTone = "better" | "worse" | "neutral";

/**
 * Delta chip against the baseline value. `lowerIsBetter` is true for PSL and ISLR (more negative
 * is better) and false for peak loss (closer to 0 is better). Threshold 0.05 dB, as in the spec.
 */
export function deltaChip(
  value: number,
  baseline: number,
  lowerIsBetter: boolean,
): { text: string; tone: DeltaTone; arrow: "\u25b2" | "\u25bc" | "" } {
  const delta = value - baseline;
  const text = formatNumber(delta, 1, true);
  const rounded = Number(delta.toFixed(1));
  const arrow = rounded > 0 ? "\u25b2" : rounded < 0 ? "\u25bc" : "";
  let tone: DeltaTone = "neutral";
  if (Math.abs(delta) > 0.05) {
    const better = lowerIsBetter ? delta < 0 : delta > 0;
    tone = better ? "better" : "worse";
  }
  return { text, tone, arrow };
}
