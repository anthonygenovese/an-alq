// SPDX-License-Identifier: MIT
import { TRAINING_DISCLAIMER, emitterLibrary, type EmitterArchetype } from "@an-alq/emitters";
import { z } from "zod/v3";
import { between, hashSeed, mulberry32, pick, shuffle } from "./prng.js";
import { visualTiming } from "./signature.js";
import {
  CLASSIFY_WINDOW_MS,
  DIFFICULTIES,
  DISPLAY_BINS,
  type Difficulty,
  type Observation,
  type RoundEmitter,
  type TrainingRound,
} from "./types.js";

export interface GenerateRoundOptions {
  seed: number;
  difficulty: Difficulty;
}

interface DifficultyProfile {
  snrDb: readonly [number, number];
  noiseFloor: number;
  extra: readonly [number, number];
  choices: number;
  sameCategoryFirst: boolean;
  overlapChance: number;
  minSpanMhz: number;
  maxSpanMhz: number;
  readout: "precise" | "rounded" | "coarse";
}

const PROFILES: Record<Difficulty, DifficultyProfile> = {
  recruit: {
    snrDb: [16, 22],
    noiseFloor: 0.07,
    extra: [0, 0],
    choices: 4,
    sameCategoryFirst: false,
    overlapChance: 0,
    minSpanMhz: 80,
    maxSpanMhz: 280,
    readout: "precise",
  },
  operator: {
    snrDb: [10, 15],
    noiseFloor: 0.13,
    extra: [1, 2],
    choices: 6,
    sameCategoryFirst: true,
    overlapChance: 0.45,
    minSpanMhz: 160,
    maxSpanMhz: 700,
    readout: "rounded",
  },
  lead: {
    snrDb: [6, 10],
    noiseFloor: 0.2,
    extra: [2, 3],
    choices: 8,
    sameCategoryFirst: true,
    overlapChance: 0.75,
    minSpanMhz: 320,
    maxSpanMhz: 1600,
    readout: "coarse",
  },
};

const roundEmitterSchema = z
  .object({
    libraryId: z.string().min(1),
    role: z.enum(["primary", "distractor"]),
    centerMhz: z.number().finite().positive(),
    bandwidthMhz: z.number().finite().positive(),
    priUs: z.number().finite().positive().nullable(),
    prfHz: z.number().finite().positive().nullable(),
    pulseWidthUs: z.number().finite().positive().nullable(),
    snrDb: z.number().finite(),
    overlap: z.boolean(),
    signature: z.enum(["pulsed", "chirp_pulse", "fmcw", "fhss", "wideband", "cw"]),
    chirpUp: z.boolean(),
    hopChannels: z.number().int().positive().nullable(),
    hopSpanMhz: z.number().finite().positive().nullable(),
    visual: z
      .object({
        periodRows: z.number().int().positive(),
        onRows: z.number().int().positive(),
        hopRows: z.number().int().positive().nullable(),
      })
      .strict(),
  })
  .strict();

export const trainingRoundSchema = z
  .object({
    schema: z.literal("an-alq.training-round.v1"),
    tier: z.literal("T1"),
    seed: z.number().int().nonnegative(),
    difficulty: z.enum(DIFFICULTIES),
    figures_are: z.literal("illustrative"),
    fictional: z.literal(true),
    operational: z.literal(false),
    classifyWindowMs: z.literal(CLASSIFY_WINDOW_MS),
    display: z
      .object({
        startMhz: z.number().finite().nonnegative(),
        stopMhz: z.number().finite().positive(),
        bins: z.literal(DISPLAY_BINS),
      })
      .strict(),
    noiseFloor: z.number().min(0).max(1),
    emitters: z.array(roundEmitterSchema).min(1).max(6),
    primaryId: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2),
    observation: z
      .object({
        band: z.string().min(1),
        centerMhz: z.number().finite().nullable(),
        modulation: z.string().min(1),
        priUs: z.number().finite().nullable(),
        bandwidthMhz: z.number().finite().nullable(),
        scan: z.string().nullable(),
        confidence: z.enum(["high", "medium", "low"]),
        notes: z.string().min(1),
      })
      .strict(),
    disclaimer: z.string().min(1),
  })
  .strict()
  .superRefine((round, ctx) => {
    if (round.display.stopMhz <= round.display.startMhz) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "display span is empty" });
    }
    const primaries = round.emitters.filter((emitter) => emitter.role === "primary");
    if (primaries.length !== 1 || primaries[0]?.libraryId !== round.primaryId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "round needs one primary" });
    }
    if (!round.choices.includes(round.primaryId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "primary missing from choices" });
    }
    if (new Set(round.choices).size !== round.choices.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate choices" });
    }
    for (const emitter of round.emitters) {
      if (emitter.centerMhz < round.display.startMhz || emitter.centerMhz > round.display.stopMhz) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "emitter sits outside the display" });
      }
    }
  });

export function roundSeed(sessionSeed: number, index: number, difficulty: Difficulty): number {
  return hashSeed(`${sessionSeed >>> 0}:${index}:${difficulty}`);
}

export function generateRound(options: GenerateRoundOptions): TrainingRound {
  const seed = options.seed >>> 0;
  const profile = PROFILES[options.difficulty];
  const rng = mulberry32(seed);
  const catalog = emitterLibrary.emitters;
  const primary = pick(rng, catalog);
  const center = between(rng, primary.frequency.minMhz, primary.frequency.maxMhz);
  const bandwidth = between(rng, primary.bandwidthMhz.min, primary.bandwidthMhz.max);
  const snr = between(rng, profile.snrDb[0], profile.snrDb[1]);
  const extraCount =
    profile.extra[0] + Math.floor(rng() * (profile.extra[1] - profile.extra[0] + 1));

  const nearest = catalog
    .filter((emitter) => emitter.id !== primary.id)
    .map((emitter) => ({ emitter, gap: rangeGap(primary, emitter) }))
    .sort((a, b) => a.gap - b.gap || a.emitter.id.localeCompare(b.emitter.id))
    .slice(0, 10);

  const same = nearest.filter((item) => item.emitter.category === primary.category);
  const rest = nearest.filter((item) => item.emitter.category !== primary.category);
  const ordered = profile.sameCategoryFirst ? [...same, ...rest] : [...rest, ...same];

  const placed: Array<{ archetype: EmitterArchetype; centerMhz: number; overlap: boolean }> = [];
  const wantOverlap = profile.overlapChance > 0 && rng() < profile.overlapChance;
  for (const item of ordered) {
    if (placed.length >= extraCount) break;
    const overlap = wantOverlap && placed.length === 0 && rangesOverlap(primary, item.emitter);
    const centerMhz = placeCenter(rng, item.emitter, center, bandwidth, overlap);
    const probe = [...placed.map((entry) => entry.centerMhz), center, centerMhz];
    const span = coverSpan(probe, bandwidth, profile.minSpanMhz);
    if (span.stop - span.start > profile.maxSpanMhz) continue;
    placed.push({ archetype: item.emitter, centerMhz, overlap });
  }

  const display = coverSpan(
    [center, ...placed.map((entry) => entry.centerMhz)],
    Math.max(bandwidth, 2),
    profile.minSpanMhz,
  );

  const primaryEmitter = instantiate(primary, {
    role: "primary",
    centerMhz: center,
    bandwidthMhz: bandwidth,
    snrDb: snr,
    overlap: false,
    rng,
  });
  const distractors = placed.map((entry) =>
    instantiate(entry.archetype, {
      role: "distractor",
      centerMhz: entry.centerMhz,
      bandwidthMhz: between(
        rng,
        entry.archetype.bandwidthMhz.min,
        entry.archetype.bandwidthMhz.max,
      ),
      snrDb: Math.max(4, snr - between(rng, 1, 4)),
      overlap: entry.overlap,
      rng,
    }),
  );

  const choiceIds = [primary.id];
  const choicePool = catalog
    .filter((emitter) => emitter.id !== primary.id)
    .sort((a, b) => compareChoices(a, b, primary, profile.sameCategoryFirst));
  for (const emitter of choicePool) {
    if (choiceIds.length >= profile.choices) break;
    choiceIds.push(emitter.id);
  }

  const overlapped = distractors.some((emitter) => emitter.overlap);
  const round: TrainingRound = {
    schema: "an-alq.training-round.v1",
    tier: "T1",
    seed,
    difficulty: options.difficulty,
    figures_are: "illustrative",
    fictional: true,
    operational: false,
    classifyWindowMs: CLASSIFY_WINDOW_MS,
    display: {
      startMhz: display.start,
      stopMhz: display.stop,
      bins: DISPLAY_BINS,
    },
    noiseFloor: profile.noiseFloor,
    emitters: [primaryEmitter, ...distractors],
    primaryId: primary.id,
    choices: shuffle(rng, choiceIds),
    observation: observe(primary, primaryEmitter, profile.readout, overlapped),
    disclaimer: TRAINING_DISCLAIMER,
  };

  const parsed = trainingRoundSchema.safeParse(round);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`Generated round failed validation: ${detail}`);
  }
  for (const emitter of parsed.data.emitters) {
    const archetype = catalog.find((item) => item.id === emitter.libraryId);
    if (!archetype) throw new Error("round referenced an unknown archetype");
    if (
      emitter.centerMhz < archetype.frequency.minMhz ||
      emitter.centerMhz > archetype.frequency.maxMhz
    ) {
      throw new Error("round placed an emitter outside its catalog range");
    }
  }
  return parsed.data;
}

export function profileFor(difficulty: Difficulty): DifficultyProfile {
  return PROFILES[difficulty];
}

function instantiate(
  archetype: EmitterArchetype,
  input: {
    role: RoundEmitter["role"];
    centerMhz: number;
    bandwidthMhz: number;
    snrDb: number;
    overlap: boolean;
    rng: () => number;
  },
): RoundEmitter {
  const priUs = archetype.priUs
    ? between(input.rng, archetype.priUs.min, archetype.priUs.max)
    : null;
  const pulseWidthUs = archetype.pulseWidthUs
    ? between(input.rng, archetype.pulseWidthUs.min, archetype.pulseWidthUs.max)
    : null;
  const prfHz = priUs ? 1_000_000 / priUs : null;
  const visual = visualTiming(archetype.signature, prfHz, archetype.hop?.dwellMs ?? null);
  return {
    libraryId: archetype.id,
    role: input.role,
    centerMhz: input.centerMhz,
    bandwidthMhz: input.bandwidthMhz,
    priUs,
    prfHz,
    pulseWidthUs,
    snrDb: input.snrDb,
    overlap: input.overlap,
    signature: archetype.signature,
    chirpUp: archetype.chirpUp,
    hopChannels: archetype.hop?.channels ?? null,
    hopSpanMhz: archetype.hop?.spanMhz ?? null,
    visual,
  };
}

function observe(
  archetype: EmitterArchetype,
  emitter: RoundEmitter,
  readout: DifficultyProfile["readout"],
  overlapped: boolean,
): Observation {
  if (readout === "precise") {
    return {
      band: archetype.frequency.band,
      centerMhz: roundTo(emitter.centerMhz, emitter.centerMhz >= 100 ? 1 : 0.01),
      modulation: archetype.modulation,
      priUs: emitter.priUs === null ? null : roundTo(emitter.priUs, 1),
      bandwidthMhz: roundTo(emitter.bandwidthMhz, emitter.bandwidthMhz >= 1 ? 0.1 : 0.001),
      scan: archetype.scanType,
      confidence: "high",
      notes: "Synthetic measurement. Illustrative.",
    };
  }
  if (readout === "rounded") {
    const step = emitter.centerMhz >= 1000 ? 10 : 1;
    return {
      band: archetype.frequency.band,
      centerMhz: Math.round(emitter.centerMhz / step) * step,
      modulation: archetype.modulation,
      priUs: emitter.priUs === null ? null : Math.round(emitter.priUs / 50) * 50,
      bandwidthMhz:
        emitter.bandwidthMhz >= 1
          ? Math.round(emitter.bandwidthMhz)
          : roundTo(emitter.bandwidthMhz, 0.01),
      scan: archetype.scanType,
      confidence: "medium",
      notes: overlapped
        ? "Another synthetic emitter overlaps this trace. Figures are illustrative."
        : "Rounded synthetic measurement. Illustrative.",
    };
  }
  return {
    band: archetype.frequency.band,
    centerMhz: null,
    modulation: modulationFamily(archetype.modulation),
    priUs: null,
    bandwidthMhz: null,
    scan: null,
    confidence: "low",
    notes: overlapped
      ? "Coarse synthetic readout. Overlapping energy is on the waterfall."
      : "Coarse synthetic readout. Use the waterfall shape.",
  };
}

function modulationFamily(modulation: EmitterArchetype["modulation"]): string {
  if (modulation === "unmodulated_pulse" || modulation === "linear_fm_pulse") return "pulsed";
  if (modulation === "fhss" || modulation === "dsss" || modulation === "ofdm") return "spread";
  if (modulation === "fmcw" || modulation === "cw") return "continuous";
  return "digital block";
}

function compareChoices(
  a: EmitterArchetype,
  b: EmitterArchetype,
  primary: EmitterArchetype,
  sameFirst: boolean,
): number {
  const rank = (emitter: EmitterArchetype) => {
    const category = emitter.category === primary.category ? 0 : 1;
    const signature = emitter.signature === primary.signature ? 0 : 1;
    return sameFirst ? category * 2 + signature : (1 - category) * 2 + signature;
  };
  const delta = rank(a) - rank(b);
  if (delta !== 0) return delta;
  return a.id.localeCompare(b.id);
}

function placeCenter(
  rng: () => number,
  archetype: EmitterArchetype,
  primaryCenter: number,
  primaryBandwidth: number,
  overlap: boolean,
): number {
  let lo = archetype.frequency.minMhz;
  let hi = archetype.frequency.maxMhz;
  if (overlap) {
    const near = Math.max(primaryBandwidth, 5);
    const nearLo = Math.max(lo, primaryCenter - near);
    const nearHi = Math.min(hi, primaryCenter + near);
    if (nearHi > nearLo) {
      lo = nearLo;
      hi = nearHi;
    }
  }
  return between(rng, lo, hi);
}

function coverSpan(
  centers: readonly number[],
  paddingMhz: number,
  minSpanMhz: number,
): { start: number; stop: number } {
  let lo = Math.min(...centers) - paddingMhz;
  let hi = Math.max(...centers) + paddingMhz;
  if (hi - lo < minSpanMhz) {
    const mid = (lo + hi) / 2;
    lo = mid - minSpanMhz / 2;
    hi = mid + minSpanMhz / 2;
  }
  if (lo < 0) {
    hi -= lo;
    lo = 0;
  }
  return { start: lo, stop: hi };
}

function rangeGap(a: EmitterArchetype, b: EmitterArchetype): number {
  if (a.frequency.maxMhz >= b.frequency.minMhz && b.frequency.maxMhz >= a.frequency.minMhz)
    return 0;
  return Math.min(
    Math.abs(a.frequency.minMhz - b.frequency.maxMhz),
    Math.abs(b.frequency.minMhz - a.frequency.maxMhz),
  );
}

function rangesOverlap(a: EmitterArchetype, b: EmitterArchetype): boolean {
  return rangeGap(a, b) === 0;
}

function roundTo(value: number, step: number): number {
  const digits = step >= 1 ? 0 : Math.round(-Math.log10(step));
  const snapped = Math.round(value / step) * step;
  return Number(snapped.toFixed(Math.max(0, digits)));
}
