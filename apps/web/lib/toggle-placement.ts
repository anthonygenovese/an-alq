// SPDX-License-Identifier: MIT
export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

export type TogglePlacementScene = {
  viewport: { width: number; height: number };
  button: { width: number; height: number };
  inset: { top: number; right: number; bottom: number; left: number };
  /** Bottom of the header nav in viewport coordinates. The button must sit fully below it. */
  headerBottom: number;
  /** Current origin. Kept when that spot is still clear. */
  current: Point | null;
  /** CSS top-right slot. Used when every sampled spot is blocked. */
  fallback?: Point | null;
  obstacles: readonly Box[];
};

/**
 * Layout viewport, unless a shorter visual viewport is supplied.
 * Equal sizes return the layout size unchanged.
 */
export function resolvePlacementViewport(
  layout: { width: number; height: number },
  visual: { width: number; height: number } | null | undefined,
): { width: number; height: number } {
  if (
    !visual ||
    !Number.isFinite(visual.width) ||
    !Number.isFinite(visual.height) ||
    visual.width <= 0 ||
    visual.height <= 0
  ) {
    return { width: layout.width, height: layout.height };
  }
  return {
    width: Math.min(layout.width, visual.width),
    height: Math.min(layout.height, visual.height),
  };
}

export const TOGGLE_EDGE_MARGIN = 22;
export const TOGGLE_HEADER_GAP = 12;
export const TOGGLE_OBSTACLE_GAP = 8;
export const TOGGLE_SAMPLE_STEP = 48;

function separated(a: Box, b: Box, gap: number): boolean {
  return (
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

function bounds(scene: TogglePlacementScene): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const { viewport, button, inset, headerBottom } = scene;
  return {
    left: inset.left + TOGGLE_EDGE_MARGIN,
    top: Math.max(inset.top + TOGGLE_EDGE_MARGIN, headerBottom + TOGGLE_HEADER_GAP),
    right: viewport.width - inset.right - TOGGLE_EDGE_MARGIN - button.width,
    bottom: viewport.height - inset.bottom - TOGGLE_EDGE_MARGIN - button.height,
  };
}

export function toggleFits(scene: TogglePlacementScene, point: Point): boolean {
  const area = bounds(scene);
  return (
    point.x >= area.left - 0.5 &&
    point.y >= area.top - 0.5 &&
    point.x <= area.right + 0.5 &&
    point.y <= area.bottom + 0.5
  );
}

export function toggleBlocked(scene: TogglePlacementScene, point: Point): boolean {
  if (!toggleFits(scene, point)) return true;
  const rect = { x: point.x, y: point.y, width: scene.button.width, height: scene.button.height };
  return scene.obstacles.some((obstacle) => !separated(rect, obstacle, TOGGLE_OBSTACLE_GAP));
}

/** Right and left edge spots, from just under the header down to the safe bottom. */
export function toggleCandidates(scene: TogglePlacementScene): Point[] {
  const area = bounds(scene);
  if (area.right < area.left - 0.5 || area.bottom < area.top - 0.5) return [];
  const points: Point[] = [];
  const right = area.right;
  const left = area.left;
  const distinctLeft = Math.abs(left - right) > 0.5;
  for (let y = area.top; y <= area.bottom + 0.5; y += TOGGLE_SAMPLE_STEP) {
    points.push({ x: right, y });
    if (distinctLeft) points.push({ x: left, y });
  }
  const last = points[points.length - 1];
  if (!last || Math.abs(last.y - area.bottom) > 0.5) {
    points.push({ x: right, y: area.bottom });
    if (distinctLeft) points.push({ x: left, y: area.bottom });
  }
  return points;
}

function distance(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function nearer(candidate: Point, best: Point, origin: Point): boolean {
  const delta = distance(candidate, origin) - distance(best, origin);
  if (Math.abs(delta) > 0.5) return delta < 0;
  if (Math.abs(candidate.y - best.y) > 0.5) return candidate.y < best.y;
  return candidate.x > best.x;
}

/**
 * Keep the current spot when it is still clear. Otherwise take the nearest
 * clear edge candidate. When nothing is clear, use the default top-right slot.
 */
export function chooseTogglePlacement(scene: TogglePlacementScene): Point | null {
  if (scene.current && !toggleBlocked(scene, scene.current)) return scene.current;
  const open = toggleCandidates(scene).filter((point) => !toggleBlocked(scene, point));
  if (open.length === 0) return scene.fallback ?? scene.current;
  const area = bounds(scene);
  const origin = scene.current ?? scene.fallback ?? { x: area.right, y: area.top };
  let best = open[0];
  if (!best) return scene.fallback ?? scene.current;
  for (const point of open.slice(1)) {
    if (nearer(point, best, origin)) best = point;
  }
  return best;
}
