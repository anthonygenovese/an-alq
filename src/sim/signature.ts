import type { SignatureKind } from "../data/emitter-library.js";
import type { RoundEmitter, SignatureDraw, TrainingRound } from "./types.js";
import { mulberry32 } from "./prng.js";

export interface SampleRowInput {
  bins: number;
  noiseFloor: number;
  seed: number;
  rowIndex: number;
  draws: readonly SignatureDraw[];
}

/**
 * Time is compressed so a pulse train or hop is visible at waterfall scroll
 * speed. The numeric PRI on the readout stays the illustrative catalog value.
 */
export function visualTiming(
  signature: SignatureKind,
  prfHz: number | null,
  hopDwellMs: number | null,
): { periodRows: number; onRows: number; hopRows: number | null } {
  if (signature === "chirp_pulse") {
    return { periodRows: 18, onRows: 8, hopRows: null };
  }
  if (signature === "fmcw") {
    return { periodRows: 22, onRows: 22, hopRows: null };
  }
  if (signature === "fhss") {
    const dwell = hopDwellMs ?? 20;
    const hopRows = clamp(Math.round(3 + dwell / 18), 3, 10);
    return { periodRows: hopRows, onRows: hopRows, hopRows };
  }
  if (signature === "pulsed") {
    const prf = prfHz ?? 1000;
    const log = Math.log10(Math.min(20_000, Math.max(50, prf)));
    const t = clamp((log - 2) / 2.3, 0, 1);
    const periodRows = Math.round(16 - t * 12);
    const onRows = Math.max(1, Math.round(periodRows * (0.16 + t * 0.55)));
    return { periodRows, onRows, hopRows: null };
  }
  return { periodRows: 1, onRows: 1, hopRows: null };
}

export function drawsFromRound(round: TrainingRound): SignatureDraw[] {
  const span = round.display.stopMhz - round.display.startMhz;
  return round.emitters.map((emitter) =>
    toDraw(emitter, round.display.startMhz, span, round.display.bins),
  );
}

export function sampleRow(input: SampleRowInput, out?: Float32Array): Float32Array {
  const row = out && out.length === input.bins ? out : new Float32Array(input.bins);
  const rng = mulberry32((input.seed ^ Math.imul(input.rowIndex + 1, 0x9e3779b1)) >>> 0);
  const noise = input.noiseFloor;
  for (let i = 0; i < input.bins; i += 1) {
    const u = rng();
    row[i] = noise * u * u;
  }
  for (const draw of input.draws) {
    paintDraw(row, draw, input.rowIndex);
  }
  return row;
}

function toDraw(
  emitter: RoundEmitter,
  startMhz: number,
  spanMhz: number,
  bins: number,
): SignatureDraw {
  const centerBin = ((emitter.centerMhz - startMhz) / spanMhz) * (bins - 1);
  const occupiedMhz =
    emitter.signature === "fhss"
      ? (emitter.hopSpanMhz ?? emitter.bandwidthMhz)
      : emitter.bandwidthMhz;
  const trueBins = (occupiedMhz / spanMhz) * (bins - 1);
  const minBins =
    emitter.signature === "wideband" || emitter.signature === "fmcw" || emitter.signature === "fhss"
      ? 10
      : 3;
  return {
    kind: emitter.signature,
    centerBin,
    widthBins: Math.max(minBins, trueBins),
    amplitude: amplitudeFromSnr(emitter.snrDb),
    periodRows: emitter.visual.periodRows,
    onRows: emitter.visual.onRows,
    hopChannels: emitter.hopChannels,
    hopRows: emitter.visual.hopRows,
    chirpUp: emitter.chirpUp,
  };
}

function amplitudeFromSnr(snrDb: number): number {
  return clamp(0.22 + (snrDb / 26) * 0.72, 0.18, 1);
}

function paintDraw(row: Float32Array, draw: SignatureDraw, rowIndex: number): void {
  const gate = gateValue(draw, rowIndex);
  if (gate <= 0) return;
  const amp = draw.amplitude * gate;
  if (draw.kind === "fhss") {
    paintHop(row, draw, rowIndex, amp);
    return;
  }
  if (draw.kind === "wideband") {
    paintBlock(row, draw, amp);
    return;
  }
  const sweeping = draw.kind === "chirp_pulse" || draw.kind === "fmcw";
  const center = sweeping ? sweepCenter(draw, rowIndex) : draw.centerBin;
  const sigma = draw.kind === "cw" || draw.kind === "pulsed" ? 0.85 : 1.15;
  const half = Math.max(2, draw.widthBins / 2);
  const left = Math.max(0, Math.floor(center - half - 3));
  const right = Math.min(row.length - 1, Math.ceil(center + half + 3));
  for (let i = left; i <= right; i += 1) {
    const d = (i - center) / sigma;
    const current = row[i] ?? 0;
    row[i] = current + amp * Math.exp(-d * d);
  }
}

function paintBlock(row: Float32Array, draw: SignatureDraw, amp: number): void {
  const half = Math.max(1, draw.widthBins / 2);
  const left = Math.max(0, Math.floor(draw.centerBin - half));
  const right = Math.min(row.length - 1, Math.ceil(draw.centerBin + half));
  for (let i = left; i <= right; i += 1) {
    const d = Math.abs(i - draw.centerBin) / half;
    const edge = d > 0.82 ? (1 - d) / 0.18 : 1;
    const current = row[i] ?? 0;
    row[i] = current + amp * 0.72 * Math.max(0, edge);
  }
}

function paintHop(row: Float32Array, draw: SignatureDraw, rowIndex: number, amp: number): void {
  const channels = Math.max(2, draw.hopChannels ?? 8);
  const hopRows = Math.max(1, draw.hopRows ?? 4);
  const channel = Math.floor(rowIndex / hopRows) % channels;
  const leftEdge = draw.centerBin - draw.widthBins / 2;
  const center = leftEdge + ((channel + 0.5) * draw.widthBins) / channels;
  const left = Math.max(0, Math.floor(center - 3));
  const right = Math.min(row.length - 1, Math.ceil(center + 3));
  for (let i = left; i <= right; i += 1) {
    const d = (i - center) / 0.8;
    const current = row[i] ?? 0;
    row[i] = current + amp * Math.exp(-d * d);
  }
}

function sweepCenter(draw: SignatureDraw, rowIndex: number): number {
  const period = Math.max(1, draw.periodRows);
  const phase = (rowIndex % period) / period;
  const directed = draw.chirpUp ? phase : 1 - phase;
  return draw.centerBin + (directed - 0.5) * draw.widthBins * 0.85;
}

function gateValue(draw: SignatureDraw, rowIndex: number): number {
  if (
    draw.kind === "cw" ||
    draw.kind === "wideband" ||
    draw.kind === "fhss" ||
    draw.kind === "fmcw"
  ) {
    return 1;
  }
  const period = Math.max(1, draw.periodRows);
  const on = Math.max(1, Math.min(draw.onRows, period));
  return rowIndex % period < on ? 1 : 0.07;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
