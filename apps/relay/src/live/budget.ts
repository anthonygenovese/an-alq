export const DEFAULT_UNIT_USD = 0.005;
export const MIN_RESULTS = 10;
export const MAX_RESULTS = 100;

export function clampRunMax(value: number): number {
  if (!Number.isFinite(value)) return MIN_RESULTS;
  return Math.min(MAX_RESULTS, Math.max(MIN_RESULTS, Math.round(value)));
}

/** How many posts this run may read without crossing the cap. 0 means stop. */
export function postsAffordable(
  spentPosts: number,
  capUsd: number,
  unitUsd: number,
  runMax: number,
): number {
  if (!(capUsd > 0) || !(unitUsd > 0)) return 0;
  const room = Math.floor((capUsd - spentPosts * unitUsd) / unitUsd + 1e-9);
  if (room < MIN_RESULTS) return 0;
  return Math.min(clampRunMax(runMax), room);
}

export function budgetKey(now: number): string {
  const date = new Date(now);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `an-alq:relay:budget:${date.getUTCFullYear()}-${month}`;
}

export function secondsUntilNextUtcMonth(now: number): number {
  const date = new Date(now);
  const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  return Math.max(60, Math.ceil((end - now) / 1000));
}
