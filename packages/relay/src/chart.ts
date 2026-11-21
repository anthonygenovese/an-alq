import type { ContributionNode } from "./types.js";

export interface ChartPoint {
  x: number;
  y: number;
  opacity: number;
  sector: number;
  ring: number;
}

export interface ChartLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
}

export interface ContributionChart {
  rings: readonly number[];
  tickRing: number;
  spokes: readonly { x1: number; y1: number; x2: number; y2: number; major: boolean }[];
  ticks: readonly { x1: number; y1: number; x2: number; y2: number; major: boolean }[];
  points: readonly ChartPoint[];
  lines: readonly ChartLine[];
  degrees: readonly { x: number; y: number; label: string }[];
}

const RING_RADII = [46, 78, 112] as const;
const TICK_RING = 132;

export function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.sin(rad) * radius,
    y: -Math.cos(rad) * radius,
  };
}

/**
 * Chart-wheel preview of anonymous contribution nodes.
 * The frame is circles plus straight ticks. Connections are straight chords.
 */
export function buildContributionChart(nodes: readonly ContributionNode[]): ContributionChart {
  const spokes = Array.from({ length: 12 }, (_, index) => {
    const angle = index * 30;
    const inner = polar(angle, 18);
    const outer = polar(angle, TICK_RING);
    return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, major: index % 3 === 0 };
  });
  const ticks = Array.from({ length: 72 }, (_, index) => {
    const major = index % 6 === 0;
    const angle = index * 5;
    const outer = polar(angle, TICK_RING);
    const inner = polar(angle, TICK_RING - (major ? 8 : 4));
    return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, major };
  });
  const points: ChartPoint[] = [];
  for (const node of nodes) {
    const radius = RING_RADII[node.ring];
    if (radius === undefined) continue;
    const at = polar(node.sector * 30, radius);
    points.push({ x: at.x, y: at.y, opacity: node.opacity, sector: node.sector, ring: node.ring });
  }
  const lines: ChartLine[] = [];
  const byRing = new Map<number, ChartPoint[]>();
  for (const point of points) {
    const list = byRing.get(point.ring) ?? [];
    list.push(point);
    byRing.set(point.ring, list);
  }
  for (const group of byRing.values()) {
    const ordered = [...group].sort((a, b) => a.sector - b.sector);
    if (ordered.length < 3) continue;
    const seen = new Set<string>();
    for (let index = 0; index < ordered.length; index += 1) {
      const from = ordered[index];
      const to = ordered[(index + 2) % ordered.length];
      if (!from || !to || from.sector === to.sector) continue;
      const low = Math.min(from.sector, to.sector);
      const high = Math.max(from.sector, to.sector);
      const key = `${from.ring}:${low}:${high}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push({
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        opacity: Math.min(0.55, Math.max(from.opacity, to.opacity) * 0.45),
      });
    }
  }
  const degrees = [0, 90, 180, 270].map((angle) => {
    const at = polar(angle, TICK_RING + 14);
    return { x: at.x, y: at.y, label: String(angle).padStart(3, "0") };
  });
  return { rings: RING_RADII, tickRing: TICK_RING, spokes, ticks, points, lines, degrees };
}
