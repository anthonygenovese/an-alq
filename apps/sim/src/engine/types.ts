import type { SignatureKind } from "@an-alq/emitters";

export const CLASSIFY_WINDOW_MS = 2000;
export const DISPLAY_BINS = 512;

export const DIFFICULTIES = ["recruit", "operator", "lead"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface RoundEmitter {
  libraryId: string;
  role: "primary" | "distractor";
  centerMhz: number;
  bandwidthMhz: number;
  priUs: number | null;
  prfHz: number | null;
  pulseWidthUs: number | null;
  snrDb: number;
  overlap: boolean;
  signature: SignatureKind;
  chirpUp: boolean;
  hopChannels: number | null;
  hopSpanMhz: number | null;
  visual: {
    periodRows: number;
    onRows: number;
    hopRows: number | null;
  };
}

export interface Observation {
  band: string;
  centerMhz: number | null;
  modulation: string;
  priUs: number | null;
  bandwidthMhz: number | null;
  scan: string | null;
  confidence: "high" | "medium" | "low";
  notes: string;
}

export interface TrainingRound {
  schema: "an-alq.training-round.v1";
  tier: "T1";
  seed: number;
  difficulty: Difficulty;
  figures_are: "illustrative";
  fictional: true;
  operational: false;
  classifyWindowMs: typeof CLASSIFY_WINDOW_MS;
  display: {
    startMhz: number;
    stopMhz: number;
    bins: typeof DISPLAY_BINS;
  };
  noiseFloor: number;
  emitters: RoundEmitter[];
  primaryId: string;
  choices: string[];
  observation: Observation;
  disclaimer: string;
}

export interface SignatureDraw {
  kind: SignatureKind;
  centerBin: number;
  widthBins: number;
  amplitude: number;
  periodRows: number;
  onRows: number;
  hopChannels: number | null;
  hopRows: number | null;
  chirpUp: boolean;
}
