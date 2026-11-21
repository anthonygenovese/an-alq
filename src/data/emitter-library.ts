import { z } from "zod/v3";
import { CAPABILITIES_URL, ILLUSTRATIVE, TRAINING_DISCLAIMER } from "../config.js";
import { capabilities } from "./capabilities.js";
import { resolveGlossaryEntry } from "./glossary.js";

/**
 * Fictional emitter archetypes for the Range Trainer.
 * Names are invented. Numbers are textbook-style and labeled illustrative.
 * They are not measurements, modes, or parameters of any real system.
 * Nothing in this module transmits, receives, jams, spoofs, or geolocates.
 */

export const LIBRARY_SCHEMA = "an-alq.emitter-library.v1" as const;

const RADAR_TECHNIQUE_GLOSSARY = {
  "spot jamming": "spot_jamming",
  "barrage jamming": "barrage_jamming",
  "swept jamming": "swept_jamming",
  "range gate pull-off (RGPO)": "rgpo",
  "velocity gate pull-off (VGPO)": "vgpo",
  "angle deception": "angle_deception",
} as const;

export function capabilityBandNames(): readonly string[] {
  const names = new Set<string>();
  for (const division of capabilities.divisions) {
    for (const entry of division.bands ?? []) names.add(entry.name);
  }
  return [...names];
}

export function responseIdsFromCapabilities(): readonly string[] {
  const radar = capabilities.divisions.find((division) => division.id === "radar_jamming");
  const techniques = radar?.techniques ?? [];
  const ids = techniques.map((technique) => {
    if (!Object.prototype.hasOwnProperty.call(RADAR_TECHNIQUE_GLOSSARY, technique)) {
      throw new Error(`Unmapped public radar technique: ${technique}`);
    }
    return RADAR_TECHNIQUE_GLOSSARY[technique as keyof typeof RADAR_TECHNIQUE_GLOSSARY];
  });
  return [...ids, "observe_only"];
}

const RESPONSE_IDS = responseIdsFromCapabilities();

export const EMITTER_CATEGORIES = [
  "search_radar",
  "fire_control_radar",
  "tracking_radar",
  "early_warning_radar",
  "navigation_radar",
  "weather_radar",
  "radar_altimeter",
  "comms_fhss",
  "comms_dsss",
  "comms_lte",
  "satcom",
  "gnss",
  "data_link",
  "hf_comms",
] as const;

export const MODULATIONS = [
  "unmodulated_pulse",
  "linear_fm_pulse",
  "fmcw",
  "cw",
  "fhss",
  "dsss",
  "ofdm",
  "qpsk",
] as const;

export const SIGNATURES = ["pulsed", "chirp_pulse", "fmcw", "fhss", "wideband", "cw"] as const;

export const SCAN_TYPES = [
  "circular",
  "sector",
  "conical",
  "track_while_scan",
  "electronic",
  "fixed",
  "none",
] as const;

export const THREAT_LEVELS = ["benign", "low", "medium", "high", "critical"] as const;

export const GEO_QUALITIES = ["suitable", "marginal", "poor"] as const;

export const DECEPTION_SUSCEPTIBILITY = ["low", "moderate", "high", "not_applicable"] as const;

export const COLLATERAL = ["protected", "clear", "uncertain"] as const;

const illustrativeSpan = z
  .object({
    min: z.number().finite().nonnegative(),
    max: z.number().finite().nonnegative(),
    label: z.literal(ILLUSTRATIVE),
  })
  .strict()
  .refine((span) => span.max >= span.min, "max must be >= min");

const emitterSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(3).max(48),
    category: z.enum(EMITTER_CATEGORIES),
    summary: z.string().min(20).max(280),
    frequency: z
      .object({
        minMhz: z.number().finite().positive(),
        maxMhz: z.number().finite().positive(),
        band: z.string().min(1),
        label: z.literal(ILLUSTRATIVE),
      })
      .strict(),
    modulation: z.enum(MODULATIONS),
    signature: z.enum(SIGNATURES),
    priUs: illustrativeSpan.nullable(),
    prfHz: illustrativeSpan.nullable(),
    pulseWidthUs: illustrativeSpan.nullable(),
    scanType: z.enum(SCAN_TYPES),
    bandwidthMhz: illustrativeSpan,
    hop: z
      .object({
        rateHz: z.number().finite().positive(),
        channels: z.number().int().positive(),
        dwellMs: z.number().finite().positive(),
        spanMhz: z.number().finite().positive(),
        label: z.literal(ILLUSTRATIVE),
      })
      .strict()
      .nullable(),
    threatLevel: z.enum(THREAT_LEVELS),
    chirpUp: z.boolean(),
    figures: z.literal(ILLUSTRATIVE),
    fictional: z.literal(true),
    glossaryTerms: z.array(z.string().min(1)).min(1).max(4),
    hooks: z
      .object({
        geolocation: z
          .object({
            tdoa: z.enum(GEO_QUALITIES),
            aoa: z.enum(GEO_QUALITIES),
            coordinates: z.null(),
            note: z.literal("No coordinates. Hook for a later synthetic map tier."),
          })
          .strict(),
        recommendedResponse: z
          .object({
            id: z.string(),
            role: z.literal("training-label"),
            procedure: z.literal(false),
          })
          .strict(),
        deceptionSusceptibility: z.enum(DECEPTION_SUSCEPTIBILITY),
        collateral: z.enum(COLLATERAL),
      })
      .strict(),
  })
  .strict();

export const emitterLibrarySchema = z
  .object({
    schema: z.literal(LIBRARY_SCHEMA),
    product: z.literal("AN-ALQ"),
    role: z.literal("training"),
    operational: z.literal(false),
    transmits: z.literal(false),
    fictional: z.literal(true),
    figures_are: z.literal(ILLUSTRATIVE),
    disclaimer: z.string().min(1),
    source: z.literal(CAPABILITIES_URL),
    tiers: z.tuple([
      z.literal("T1"),
      z.literal("T2"),
      z.literal("T3"),
      z.literal("T4"),
      z.literal("T5"),
    ]),
    consumers: z
      .object({
        T1: z.array(z.string()).min(1),
        T2: z.array(z.string()).min(1),
        T3: z.array(z.string()).min(1),
        T4: z.array(z.string()).min(1),
        T5: z.array(z.string()).min(1),
      })
      .strict(),
    bands: z.array(z.string()).min(1),
    response_ids: z.array(z.string()).min(1),
    emitters: z.array(emitterSchema).min(25).max(40),
  })
  .strict()
  .superRefine((document, ctx) => {
    const bands = new Set(capabilityBandNames());
    const responses = new Set(RESPONSE_IDS);
    const seen = new Set<string>();
    for (const emitter of document.emitters) {
      if (seen.has(emitter.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate id ${emitter.id}` });
      }
      seen.add(emitter.id);
      if (!bands.has(emitter.frequency.band)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `band is not in the capabilities catalog: ${emitter.frequency.band}`,
          path: ["emitters", emitter.id, "frequency", "band"],
        });
      }
      if (emitter.frequency.maxMhz < emitter.frequency.minMhz) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "frequency max is below min",
          path: ["emitters", emitter.id],
        });
      }
      if (!responses.has(emitter.hooks.recommendedResponse.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "response id is not a catalog label",
          path: ["emitters", emitter.id, "hooks", "recommendedResponse"],
        });
      }
      for (const term of emitter.glossaryTerms) {
        if (!resolveGlossaryEntry(term)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `unknown glossary id ${term}`,
            path: ["emitters", emitter.id, "glossaryTerms"],
          });
        }
      }
      const pulsed = emitter.signature === "pulsed" || emitter.signature === "chirp_pulse";
      if (pulsed) {
        if (!emitter.priUs || !emitter.prfHz || !emitter.pulseWidthUs) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "pulsed signatures need PRI, PRF, and pulse width",
            path: ["emitters", emitter.id],
          });
        } else if (emitter.pulseWidthUs.max >= emitter.priUs.min) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "pulse width must sit inside the PRI",
            path: ["emitters", emitter.id],
          });
        }
      } else if (emitter.priUs || emitter.prfHz || emitter.pulseWidthUs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "continuous signatures do not carry a PRI",
          path: ["emitters", emitter.id],
        });
      }
      if (emitter.signature === "fhss") {
        if (!emitter.hop) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "FHSS needs hop parameters",
            path: ["emitters", emitter.id],
          });
        }
      } else if (emitter.hop) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "hop parameters belong on FHSS only",
          path: ["emitters", emitter.id],
        });
      }
      if (
        emitter.hooks.collateral === "protected" &&
        emitter.hooks.recommendedResponse.id !== "observe_only"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "protected archetypes are observe-only",
          path: ["emitters", emitter.id, "hooks"],
        });
      }
    }
  });

export type EmitterArchetype = z.infer<typeof emitterSchema>;
export type EmitterLibraryDocument = z.infer<typeof emitterLibrarySchema>;
export type EmitterCategory = (typeof EMITTER_CATEGORIES)[number];
export type SignatureKind = (typeof SIGNATURES)[number];
export type Modulation = (typeof MODULATIONS)[number];

const GEO_NOTE = "No coordinates. Hook for a later synthetic map tier." as const;

interface Seed {
  id: string;
  name: string;
  category: EmitterCategory;
  summary: string;
  band: string;
  mhz: [number, number];
  modulation: Modulation;
  signature: SignatureKind;
  priUs?: [number, number];
  pulseUs?: [number, number];
  bandwidthMhz: [number, number];
  scan: EmitterArchetype["scanType"];
  hop?: { rateHz: number; channels: number; dwellMs: number; spanMhz: number };
  threat: EmitterArchetype["threatLevel"];
  response: string;
  deception: EmitterArchetype["hooks"]["deceptionSusceptibility"];
  collateral: EmitterArchetype["hooks"]["collateral"];
  tdoa: EmitterArchetype["hooks"]["geolocation"]["tdoa"];
  aoa: EmitterArchetype["hooks"]["geolocation"]["aoa"];
  glossary: readonly string[];
  chirpUp?: boolean;
}

function span(min: number, max: number) {
  return { min, max, label: ILLUSTRATIVE };
}

function prfFromPri(pri: [number, number]) {
  return span(Math.round(1_000_000 / pri[1]), Math.round(1_000_000 / pri[0]));
}

function buildEmitter(seed: Seed): EmitterArchetype {
  const pulsed = seed.signature === "pulsed" || seed.signature === "chirp_pulse";
  return {
    id: seed.id,
    name: seed.name,
    category: seed.category,
    summary: seed.summary,
    frequency: {
      minMhz: seed.mhz[0],
      maxMhz: seed.mhz[1],
      band: seed.band,
      label: ILLUSTRATIVE,
    },
    modulation: seed.modulation,
    signature: seed.signature,
    priUs: pulsed && seed.priUs ? span(seed.priUs[0], seed.priUs[1]) : null,
    prfHz: pulsed && seed.priUs ? prfFromPri(seed.priUs) : null,
    pulseWidthUs: pulsed && seed.pulseUs ? span(seed.pulseUs[0], seed.pulseUs[1]) : null,
    scanType: seed.scan,
    bandwidthMhz: span(seed.bandwidthMhz[0], seed.bandwidthMhz[1]),
    hop: seed.hop ? { ...seed.hop, label: ILLUSTRATIVE } : null,
    threatLevel: seed.threat,
    chirpUp: seed.chirpUp ?? false,
    figures: ILLUSTRATIVE,
    fictional: true,
    glossaryTerms: [...seed.glossary],
    hooks: {
      geolocation: {
        tdoa: seed.tdoa,
        aoa: seed.aoa,
        coordinates: null,
        note: GEO_NOTE,
      },
      recommendedResponse: {
        id: seed.response,
        role: "training-label",
        procedure: false,
      },
      deceptionSusceptibility: seed.deception,
      collateral: seed.collateral,
    },
  };
}

const SEEDS: readonly Seed[] = [
  {
    id: "lantern-search",
    name: "Lantern Circular Search",
    category: "search_radar",
    summary:
      "Fictional medium-PRF search cartoon in S-band. A textbook circular scan with a short unmodulated pulse.",
    band: "S-band",
    mhz: [2700, 3100],
    modulation: "unmodulated_pulse",
    signature: "pulsed",
    priUs: [2500, 3300],
    pulseUs: [2, 4],
    bandwidthMhz: [2, 4],
    scan: "circular",
    threat: "medium",
    response: "barrage_jamming",
    deception: "moderate",
    collateral: "clear",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["elint", "esm", "barrage_jamming"],
  },
  {
    id: "harbor-watch",
    name: "Harbor Watch",
    category: "navigation_radar",
    summary:
      "Fictional civil navigation radar. Short X-band pulses on a circular scan. Protected training traffic.",
    band: "X-band",
    mhz: [9300, 9500],
    modulation: "unmodulated_pulse",
    signature: "pulsed",
    priUs: [500, 1000],
    pulseUs: [0.4, 0.8],
    bandwidthMhz: [8, 16],
    scan: "circular",
    threat: "low",
    response: "observe_only",
    deception: "low",
    collateral: "protected",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["elint", "esm"],
  },
  {
    id: "horizon-fan",
    name: "Horizon Fan",
    category: "early_warning_radar",
    summary:
      "Fictional long-range early-warning cartoon. Slow L-band chirps and a wide circular scan.",
    band: "L-band",
    mhz: [1200, 1400],
    modulation: "linear_fm_pulse",
    signature: "chirp_pulse",
    priUs: [4000, 6000],
    pulseUs: [20, 40],
    bandwidthMhz: [5, 10],
    scan: "circular",
    threat: "high",
    response: "barrage_jamming",
    deception: "low",
    collateral: "clear",
    tdoa: "suitable",
    aoa: "marginal",
    glossary: ["elint", "chirp", "barrage_jamming"],
    chirpUp: true,
  },
  {
    id: "mesa-sector",
    name: "Mesa Sector",
    category: "search_radar",
    summary: "Fictional sector-scan search radar. S-band linear-FM pulses, moderate repetition.",
    band: "S-band",
    mhz: [3200, 3600],
    modulation: "linear_fm_pulse",
    signature: "chirp_pulse",
    priUs: [2000, 2800],
    pulseUs: [10, 18],
    bandwidthMhz: [8, 15],
    scan: "sector",
    threat: "medium",
    response: "swept_jamming",
    deception: "moderate",
    collateral: "clear",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["elint", "chirp", "swept_jamming"],
    chirpUp: false,
  },
  {
    id: "paper-kite",
    name: "Paper Kite",
    category: "early_warning_radar",
    summary: "Fictional VHF early-warning cartoon. Very long PRI, narrow pulses, circular scan.",
    band: "VHF",
    mhz: [150, 180],
    modulation: "unmodulated_pulse",
    signature: "pulsed",
    priUs: [8000, 12000],
    pulseUs: [8, 16],
    bandwidthMhz: [1, 2],
    scan: "circular",
    threat: "medium",
    response: "spot_jamming",
    deception: "low",
    collateral: "clear",
    tdoa: "marginal",
    aoa: "suitable",
    glossary: ["elint", "pri"],
  },
  {
    id: "needle-fc",
    name: "Needle Fire Control",
    category: "fire_control_radar",
    summary: "Fictional high-PRF fire-control cartoon. Narrow X-band pulses and a conical scan.",
    band: "X-band",
    mhz: [8500, 9000],
    modulation: "unmodulated_pulse",
    signature: "pulsed",
    priUs: [80, 120],
    pulseUs: [0.2, 0.4],
    bandwidthMhz: [4, 8],
    scan: "conical",
    threat: "critical",
    response: "rgpo",
    deception: "high",
    collateral: "clear",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["elint", "rgpo", "prf"],
  },
  {
    id: "quill-fc",
    name: "Quill Fire Control",
    category: "fire_control_radar",
    summary: "Fictional Ku-band fire-control cartoon. Very short pulses and a conical scan.",
    band: "Ku-band",
    mhz: [15000, 16000],
    modulation: "unmodulated_pulse",
    signature: "pulsed",
    priUs: [50, 80],
    pulseUs: [0.1, 0.25],
    bandwidthMhz: [6, 12],
    scan: "conical",
    threat: "critical",
    response: "spot_jamming",
    deception: "high",
    collateral: "clear",
    tdoa: "marginal",
    aoa: "suitable",
    glossary: ["elint", "spot_jamming"],
  },
  {
    id: "gimbal-track",
    name: "Gimbal Track",
    category: "tracking_radar",
    summary: "Fictional C-band tracker. Medium PRI pulses and a track-while-scan pattern.",
    band: "C-band",
    mhz: [5400, 5900],
    modulation: "unmodulated_pulse",
    signature: "pulsed",
    priUs: [400, 700],
    pulseUs: [0.5, 1],
    bandwidthMhz: [3, 6],
    scan: "track_while_scan",
    threat: "high",
    response: "vgpo",
    deception: "high",
    collateral: "clear",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["elint", "vgpo"],
  },
  {
    id: "penlight",
    name: "Penlight Monopulse",
    category: "tracking_radar",
    summary:
      "Fictional X-band monopulse tracker. Chirped pulses on an electronic scan. Monopulse here is the textbook word, not a product.",
    band: "X-band",
    mhz: [9000, 9300],
    modulation: "linear_fm_pulse",
    signature: "chirp_pulse",
    priUs: [200, 350],
    pulseUs: [1, 2],
    bandwidthMhz: [10, 20],
    scan: "electronic",
    threat: "high",
    response: "rgpo",
    deception: "moderate",
    collateral: "clear",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["elint", "rgpo", "chirp"],
    chirpUp: true,
  },
  {
    id: "yoke-tracker",
    name: "Yoke Tracker",
    category: "tracking_radar",
    summary: "Fictional S-band tracker with a sector scan and a steady unmodulated pulse train.",
    band: "S-band",
    mhz: [2900, 3300],
    modulation: "unmodulated_pulse",
    signature: "pulsed",
    priUs: [800, 1200],
    pulseUs: [0.8, 1.5],
    bandwidthMhz: [2, 5],
    scan: "sector",
    threat: "high",
    response: "angle_deception",
    deception: "high",
    collateral: "clear",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["elint", "angle_deception", "aoa"],
  },
  {
    id: "gull-search",
    name: "Gull Search",
    category: "search_radar",
    summary: "Fictional X-band search cartoon. Wider chirped pulses and a sector scan.",
    band: "X-band",
    mhz: [8600, 9000],
    modulation: "linear_fm_pulse",
    signature: "chirp_pulse",
    priUs: [600, 900],
    pulseUs: [5, 10],
    bandwidthMhz: [15, 30],
    scan: "sector",
    threat: "medium",
    response: "barrage_jamming",
    deception: "moderate",
    collateral: "clear",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["elint", "chirp", "barrage_jamming"],
    chirpUp: false,
  },
  {
    id: "archive-search",
    name: "Archive Search",
    category: "search_radar",
    summary: "Fictional L-band search radar. Low PRF, narrow pulses, circular scan.",
    band: "L-band",
    mhz: [1250, 1350],
    modulation: "unmodulated_pulse",
    signature: "pulsed",
    priUs: [3000, 5000],
    pulseUs: [3, 6],
    bandwidthMhz: [1, 3],
    scan: "circular",
    threat: "medium",
    response: "spot_jamming",
    deception: "low",
    collateral: "clear",
    tdoa: "suitable",
    aoa: "marginal",
    glossary: ["elint", "spot_jamming", "pri"],
  },
  {
    id: "courtyard-fhss",
    name: "Courtyard FHSS",
    category: "comms_fhss",
    summary:
      "Fictional frequency-hopping handset in the 2.4 GHz textbook hop cartoon. Not a fielded radio.",
    band: "S-band",
    mhz: [2400, 2480],
    modulation: "fhss",
    signature: "fhss",
    bandwidthMhz: [0.4, 1],
    scan: "none",
    hop: { rateHz: 80, channels: 40, dwellMs: 12.5, spanMhz: 80 },
    threat: "low",
    response: "observe_only",
    deception: "low",
    collateral: "protected",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["fhss", "comint"],
  },
  {
    id: "relay-whistle",
    name: "Relay Whistle",
    category: "comms_fhss",
    summary: "Fictional UHF hopping net. Slow hops across a narrow training span.",
    band: "UHF",
    mhz: [450, 470],
    modulation: "fhss",
    signature: "fhss",
    bandwidthMhz: [0.025, 0.1],
    scan: "none",
    hop: { rateHz: 40, channels: 20, dwellMs: 25, spanMhz: 20 },
    threat: "medium",
    response: "observe_only",
    deception: "low",
    collateral: "uncertain",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["fhss", "comint"],
  },
  {
    id: "ridge-runner",
    name: "Ridge Runner",
    category: "comms_fhss",
    summary: "Fictional VHF hopping radio. Fewer channels and a slower hop than Courtyard FHSS.",
    band: "VHF",
    mhz: [148, 174],
    modulation: "fhss",
    signature: "fhss",
    bandwidthMhz: [0.0125, 0.025],
    scan: "none",
    hop: { rateHz: 20, channels: 16, dwellMs: 50, spanMhz: 26 },
    threat: "medium",
    response: "observe_only",
    deception: "low",
    collateral: "uncertain",
    tdoa: "marginal",
    aoa: "suitable",
    glossary: ["fhss", "comint"],
  },
  {
    id: "ledger-dsss",
    name: "Ledger DSSS",
    category: "comms_dsss",
    summary:
      "Fictional direct-sequence link. A raised wide block in L-band, well clear of the GNSS cartoons.",
    band: "L-band",
    mhz: [1750, 1850],
    modulation: "dsss",
    signature: "wideband",
    bandwidthMhz: [10, 20],
    scan: "none",
    threat: "medium",
    response: "observe_only",
    deception: "moderate",
    collateral: "uncertain",
    tdoa: "marginal",
    aoa: "suitable",
    glossary: ["dsss", "comint"],
  },
  {
    id: "campus-dsss",
    name: "Campus DSSS",
    category: "comms_dsss",
    summary:
      "Fictional campus direct-sequence radio in an S-band textbook spread. Protected civil cartoon.",
    band: "S-band",
    mhz: [2410, 2470],
    modulation: "dsss",
    signature: "wideband",
    bandwidthMhz: [12, 22],
    scan: "none",
    threat: "benign",
    response: "observe_only",
    deception: "low",
    collateral: "protected",
    tdoa: "poor",
    aoa: "marginal",
    glossary: ["dsss", "comint"],
  },
  {
    id: "metro-lte",
    name: "Metro LTE Block",
    category: "comms_lte",
    summary:
      "Fictional LTE-like OFDM block in UHF. A flat wide rectangle. Protected civil traffic.",
    band: "UHF",
    mhz: [730, 760],
    modulation: "ofdm",
    signature: "wideband",
    bandwidthMhz: [10, 20],
    scan: "none",
    threat: "benign",
    response: "observe_only",
    deception: "not_applicable",
    collateral: "protected",
    tdoa: "poor",
    aoa: "marginal",
    glossary: ["ofdm", "comint"],
  },
  {
    id: "tower-lte",
    name: "Tower LTE",
    category: "comms_lte",
    summary:
      "Fictional LTE-like OFDM block in L-band. Wider than a radar line and continuous. Protected.",
    band: "L-band",
    mhz: [1800, 1880],
    modulation: "ofdm",
    signature: "wideband",
    bandwidthMhz: [10, 20],
    scan: "none",
    threat: "benign",
    response: "observe_only",
    deception: "not_applicable",
    collateral: "protected",
    tdoa: "poor",
    aoa: "marginal",
    glossary: ["ofdm", "comint"],
  },
  {
    id: "paper-lantern",
    name: "Paper Lantern",
    category: "satcom",
    summary: "Fictional C-band satellite downlink cartoon. A steady QPSK block. Protected.",
    band: "C-band",
    mhz: [3700, 4000],
    modulation: "qpsk",
    signature: "wideband",
    bandwidthMhz: [20, 36],
    scan: "fixed",
    threat: "low",
    response: "observe_only",
    deception: "moderate",
    collateral: "protected",
    tdoa: "poor",
    aoa: "marginal",
    glossary: ["comint"],
  },
  {
    id: "skylight-ku",
    name: "Skylight Downlink",
    category: "satcom",
    summary: "Fictional Ku-band downlink cartoon. Broad continuous block, no pulse train.",
    band: "Ku-band",
    mhz: [11700, 12200],
    modulation: "qpsk",
    signature: "wideband",
    bandwidthMhz: [24, 36],
    scan: "fixed",
    threat: "benign",
    response: "observe_only",
    deception: "low",
    collateral: "protected",
    tdoa: "poor",
    aoa: "poor",
    glossary: ["comint"],
  },
  {
    id: "clay-uplink",
    name: "Clay Uplink",
    category: "satcom",
    summary: "Fictional Ku-band uplink cartoon sitting above Skylight. Protected civil block.",
    band: "Ku-band",
    mhz: [14000, 14500],
    modulation: "qpsk",
    signature: "wideband",
    bandwidthMhz: [18, 36],
    scan: "fixed",
    threat: "low",
    response: "observe_only",
    deception: "low",
    collateral: "protected",
    tdoa: "poor",
    aoa: "poor",
    glossary: ["comint"],
  },
  {
    id: "classroom-gnss",
    name: "Classroom GNSS Beacon",
    category: "gnss",
    summary:
      "Fictional training beacon near the public textbook L1 carrier neighborhood. A noise-like block, not a navigation waveform.",
    band: "L1/L2",
    mhz: [1570, 1580],
    modulation: "dsss",
    signature: "wideband",
    bandwidthMhz: [2, 4],
    scan: "none",
    threat: "benign",
    response: "observe_only",
    deception: "high",
    collateral: "protected",
    tdoa: "poor",
    aoa: "poor",
    glossary: ["gnss_spoofing", "dsss"],
  },
  {
    id: "drill-gnss",
    name: "Drill GNSS Beacon",
    category: "gnss",
    summary:
      "Fictional training beacon near the public textbook L2 carrier neighborhood. Illustrative placement only. Not a navigation waveform.",
    band: "L1/L2",
    mhz: [1222, 1232],
    modulation: "dsss",
    signature: "wideband",
    bandwidthMhz: [2, 4],
    scan: "none",
    threat: "benign",
    response: "observe_only",
    deception: "high",
    collateral: "protected",
    tdoa: "poor",
    aoa: "poor",
    glossary: ["gnss_spoofing", "dsss"],
  },
  {
    id: "ribbon-4",
    name: "Ribbon-4",
    category: "data_link",
    summary: "Fictional S-band data link. A direct-sequence block narrower than Campus DSSS.",
    band: "S-band",
    mhz: [2200, 2300],
    modulation: "dsss",
    signature: "wideband",
    bandwidthMhz: [4, 8],
    scan: "none",
    threat: "high",
    response: "barrage_jamming",
    deception: "moderate",
    collateral: "uncertain",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["dsss", "comint"],
  },
  {
    id: "packet-ribbon",
    name: "Packet Ribbon",
    category: "data_link",
    summary:
      "Fictional L-band data link with a QPSK block. Distinct from the GNSS beacons below it.",
    band: "L-band",
    mhz: [1450, 1520],
    modulation: "qpsk",
    signature: "wideband",
    bandwidthMhz: [6, 12],
    scan: "none",
    threat: "medium",
    response: "spot_jamming",
    deception: "moderate",
    collateral: "uncertain",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["comint", "dsss"],
  },
  {
    id: "cumulus-weather",
    name: "Cumulus Weather",
    category: "weather_radar",
    summary:
      "Fictional weather-surveillance cartoon. Slow S-band chirps on a circular scan. Protected.",
    band: "S-band",
    mhz: [2700, 2900],
    modulation: "linear_fm_pulse",
    signature: "chirp_pulse",
    priUs: [1500, 2500],
    pulseUs: [8, 16],
    bandwidthMhz: [2, 4],
    scan: "circular",
    threat: "benign",
    response: "observe_only",
    deception: "low",
    collateral: "protected",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["elint", "chirp"],
    chirpUp: true,
  },
  {
    id: "deck-altimeter",
    name: "Deck Altimeter",
    category: "radar_altimeter",
    summary:
      "Fictional C-band FMCW altimeter cartoon. A repeating sawtooth, not a pulse train. Protected.",
    band: "C-band",
    mhz: [4200, 4400],
    modulation: "fmcw",
    signature: "fmcw",
    bandwidthMhz: [30, 80],
    scan: "fixed",
    threat: "benign",
    response: "observe_only",
    deception: "low",
    collateral: "protected",
    tdoa: "poor",
    aoa: "poor",
    glossary: ["fmcw", "elint"],
    chirpUp: true,
  },
  {
    id: "corridor-beacon",
    name: "Corridor Beacon",
    category: "navigation_radar",
    summary:
      "Fictional pulse beacon in L-band. Deliberately not placed on a real SSR channel. Protected.",
    band: "L-band",
    mhz: [1120, 1180],
    modulation: "unmodulated_pulse",
    signature: "pulsed",
    priUs: [1500, 2500],
    pulseUs: [0.6, 1.2],
    bandwidthMhz: [2, 6],
    scan: "circular",
    threat: "low",
    response: "observe_only",
    deception: "low",
    collateral: "protected",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["elint", "esm"],
  },
  {
    id: "coast-net",
    name: "Coast Net",
    category: "hf_comms",
    summary: "Fictional HF continuous tone. A hairline on the waterfall. Protected civil cartoon.",
    band: "HF",
    mhz: [8, 12],
    modulation: "cw",
    signature: "cw",
    bandwidthMhz: [0.003, 0.01],
    scan: "none",
    threat: "benign",
    response: "observe_only",
    deception: "not_applicable",
    collateral: "protected",
    tdoa: "marginal",
    aoa: "marginal",
    glossary: ["comint", "esm"],
  },
  {
    id: "spar-illuminator",
    name: "Spar Illuminator",
    category: "fire_control_radar",
    summary: "Fictional X-band continuous-wave illuminator. A solid line with no pulse gaps.",
    band: "X-band",
    mhz: [10000, 10500],
    modulation: "cw",
    signature: "cw",
    bandwidthMhz: [0.2, 1],
    scan: "fixed",
    threat: "critical",
    response: "vgpo",
    deception: "high",
    collateral: "clear",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["elint", "vgpo"],
  },
  {
    id: "dune-fmcw",
    name: "Dune FMCW",
    category: "tracking_radar",
    summary:
      "Fictional short-range FMCW tracker. A wide X-band sawtooth, continuous rather than pulsed.",
    band: "X-band",
    mhz: [10500, 10800],
    modulation: "fmcw",
    signature: "fmcw",
    bandwidthMhz: [40, 120],
    scan: "electronic",
    threat: "medium",
    response: "spot_jamming",
    deception: "moderate",
    collateral: "clear",
    tdoa: "marginal",
    aoa: "suitable",
    glossary: ["fmcw", "spot_jamming"],
    chirpUp: false,
  },
  {
    id: "umbrella-satcom",
    name: "Umbrella Satcom",
    category: "satcom",
    summary: "Fictional L-band training satcom block, offset from the GNSS beacons. Protected.",
    band: "L-band",
    mhz: [1600, 1660],
    modulation: "qpsk",
    signature: "wideband",
    bandwidthMhz: [5, 10],
    scan: "fixed",
    threat: "low",
    response: "observe_only",
    deception: "moderate",
    collateral: "protected",
    tdoa: "poor",
    aoa: "marginal",
    glossary: ["comint"],
  },
  {
    id: "sweep-early",
    name: "Sweep Early",
    category: "early_warning_radar",
    summary: "Fictional UHF early-warning cartoon. Long chirped pulses and a slow circular scan.",
    band: "UHF",
    mhz: [420, 450],
    modulation: "linear_fm_pulse",
    signature: "chirp_pulse",
    priUs: [5000, 8000],
    pulseUs: [20, 40],
    bandwidthMhz: [2, 5],
    scan: "circular",
    threat: "high",
    response: "barrage_jamming",
    deception: "low",
    collateral: "clear",
    tdoa: "suitable",
    aoa: "suitable",
    glossary: ["elint", "chirp", "barrage_jamming"],
    chirpUp: true,
  },
];

const rawDocument = {
  schema: LIBRARY_SCHEMA,
  product: "AN-ALQ" as const,
  role: "training" as const,
  operational: false as const,
  transmits: false as const,
  fictional: true as const,
  figures_are: ILLUSTRATIVE,
  disclaimer: TRAINING_DISCLAIMER,
  source: CAPABILITIES_URL,
  tiers: ["T1", "T2", "T3", "T4", "T5"] as const,
  consumers: {
    T1: [
      "category",
      "frequency",
      "modulation",
      "signature",
      "priUs",
      "prfHz",
      "pulseWidthUs",
      "scanType",
      "bandwidthMhz",
      "hop",
    ],
    T2: ["hooks.geolocation"],
    T3: ["hooks.recommendedResponse"],
    T4: ["hooks.deceptionSusceptibility"],
    T5: ["hooks.collateral", "threatLevel"],
  },
  bands: capabilityBandNames(),
  response_ids: [...RESPONSE_IDS],
  emitters: SEEDS.map(buildEmitter),
};

const parsed = emitterLibrarySchema.safeParse(rawDocument);
if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Emitter library failed validation: ${detail}`);
}

export const emitterLibrary: EmitterLibraryDocument = parsed.data;

export const emittersById: ReadonlyMap<string, EmitterArchetype> = new Map(
  emitterLibrary.emitters.map((emitter) => [emitter.id, emitter]),
);

export function emitterById(id: string): EmitterArchetype | undefined {
  return emittersById.get(id);
}

export const CATEGORY_LABELS: Record<EmitterCategory, string> = {
  search_radar: "Search radar",
  fire_control_radar: "Fire-control radar",
  tracking_radar: "Tracking radar",
  early_warning_radar: "Early-warning radar",
  navigation_radar: "Navigation radar",
  weather_radar: "Weather radar",
  radar_altimeter: "Radar altimeter",
  comms_fhss: "FHSS communications",
  comms_dsss: "DSSS communications",
  comms_lte: "LTE communications",
  satcom: "SATCOM",
  gnss: "GNSS",
  data_link: "Data link",
  hf_comms: "HF communications",
};

export const MODULATION_LABELS: Record<Modulation, string> = {
  unmodulated_pulse: "Unmodulated pulse",
  linear_fm_pulse: "Linear FM pulse",
  fmcw: "FMCW",
  cw: "Continuous wave",
  fhss: "FHSS",
  dsss: "DSSS",
  ofdm: "OFDM",
  qpsk: "QPSK",
};

export const SCAN_LABELS: Record<EmitterArchetype["scanType"], string> = {
  circular: "Circular",
  sector: "Sector",
  conical: "Conical",
  track_while_scan: "Track-while-scan",
  electronic: "Electronic",
  fixed: "Fixed",
  none: "None",
};

export const SIGNATURE_LABELS: Record<SignatureKind, string> = {
  pulsed: "Pulsed line",
  chirp_pulse: "Chirped pulse",
  fmcw: "FMCW sawtooth",
  fhss: "Frequency hops",
  wideband: "Wideband block",
  cw: "Continuous tone",
};
