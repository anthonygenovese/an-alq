// SPDX-License-Identifier: MIT
// Pure geometry helpers for the hand-written SVG charts. No DOM, no React, so node --test can run them.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Domain = readonly [number, number];

export interface AxisDescriptor {
  start: number;
  step: number;
  count: number;
}

/** value[k] = start + k * step */
export function axisValues(axis: AxisDescriptor): number[] {
  const out: number[] = [];
  for (let k = 0; k < axis.count; k += 1) out.push(axis.start + k * axis.step);
  return out;
}

export function scale(value: number, domain: Domain, lo: number, hi: number): number {
  const span = domain[1] - domain[0];
  if (span === 0) return lo;
  return lo + ((value - domain[0]) / span) * (hi - lo);
}

export function toX(value: number, domain: Domain, box: Box): number {
  return scale(value, domain, box.x, box.x + box.w);
}

/** y grows downward in SVG: the domain maximum sits at the top of the box. */
export function toY(value: number, domain: Domain, box: Box): number {
  return scale(value, domain, box.y + box.h, box.y);
}

function fix(value: number): string {
  return (Math.round(value * 10) / 10).toString();
}

/**
 * SVG path for one series. Points outside the y domain are clipped to its edge (drawn at the
 * floor, not dropped). Non-finite points break the line. x values outside the x domain are skipped.
 */
export function polylinePath(
  xs: readonly number[],
  ys: readonly number[],
  xDomain: Domain,
  yDomain: Domain,
  box: Box,
): string {
  const lo = Math.min(yDomain[0], yDomain[1]);
  const hi = Math.max(yDomain[0], yDomain[1]);
  const xlo = Math.min(xDomain[0], xDomain[1]);
  const xhi = Math.max(xDomain[0], xDomain[1]);
  const n = Math.min(xs.length, ys.length);
  let d = "";
  let pen = false;
  for (let i = 0; i < n; i += 1) {
    const x = xs[i];
    const y = ys[i];
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) {
      pen = false;
      continue;
    }
    if (x < xlo || x > xhi) continue;
    const px = toX(x, xDomain, box);
    const py = toY(Math.min(hi, Math.max(lo, y)), yDomain, box);
    d += `${pen ? "L" : "M"}${fix(px)} ${fix(py)}`;
    pen = true;
  }
  return d;
}

/** Closed path from a series down (or up) to a baseline value, for the mask fill. */
export function areaPath(
  xs: readonly number[],
  ys: readonly number[],
  baseline: number,
  xDomain: Domain,
  yDomain: Domain,
  box: Box,
): string {
  const line = polylinePath(xs, ys, xDomain, yDomain, box);
  if (line === "") return "";
  const first = xs.find((x) => x >= xDomain[0] && x <= xDomain[1]);
  let last: number | undefined;
  for (let i = xs.length - 1; i >= 0; i -= 1) {
    const x = xs[i];
    if (x !== undefined && x >= xDomain[0] && x <= xDomain[1]) {
      last = x;
      break;
    }
  }
  if (first === undefined || last === undefined) return "";
  const yb = toY(Math.min(Math.max(baseline, yDomain[0]), yDomain[1]), yDomain, box);
  return `${line}L${fix(toX(last, xDomain, box))} ${fix(yb)}L${fix(toX(first, xDomain, box))} ${fix(yb)}Z`;
}

/** Evenly spaced tick values from `lo` to `hi` inclusive. */
export function ticks(lo: number, hi: number, every: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(lo / every - 1e-9) * every;
  for (let v = first; v <= hi + 1e-9; v += every) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** Index of the sample nearest to `x`. Axis must be ascending. */
export function nearestIndex(xs: readonly number[], x: number): number {
  if (xs.length === 0) return -1;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    const v = xs[mid];
    if (v !== undefined && v < x) lo = mid;
    else hi = mid;
  }
  const a = xs[lo];
  const b = xs[hi];
  if (a === undefined || b === undefined) return lo;
  return Math.abs(x - a) <= Math.abs(b - x) ? lo : hi;
}

/** Indices whose x lies inside [-half, +half]. For the client-side +-0.5 us crop. */
export function cropIndices(xs: readonly number[], half: number): [number, number] {
  let first = -1;
  let last = -1;
  for (let i = 0; i < xs.length; i += 1) {
    const x = xs[i];
    if (x === undefined) continue;
    if (Math.abs(x) <= half + 1e-9) {
      if (first < 0) first = i;
      last = i;
    }
  }
  return first < 0 ? [0, -1] : [first, last];
}

/** Map a pointer x (in SVG user units) back to a data x. */
export function fromX(px: number, domain: Domain, box: Box): number {
  return scale(px, [box.x, box.x + box.w], domain[0], domain[1]);
}
