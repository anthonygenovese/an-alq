import {
  EMITTER_CATEGORIES,
  ILLUSTRATIVE,
  TRAINING_DISCLAIMER,
  resolveGlossaryEntry,
  type EmitterCategory,
} from "@an-alq/emitters";
import { z } from "zod/v3";
import { emptyTierContext, type TierContext } from "./tier-evidence.js";
import { DIFFICULTIES, type Difficulty } from "./types.js";

/**
 * EW skill map. Nodes record what a player has demonstrated in the trainer.
 * A later module may wrap the profile mark with a participation ring.
 * That ring is how you participate. This map is what you learned.
 * barrage-label is a glossary definition after T1 mastery.
 * Nothing here transmits, jams, spoofs, or geolocates.
 */

export const SKILL_MAP_SCHEMA = "an-alq.skill-map.v1" as const;
export const SKILL_EVIDENCE_SCHEMA = "an-alq.skill-evidence.v1" as const;
export const SKILL_EVIDENCE_KEY = "an-alq.skill-evidence.v1";
export const SKILL_ACK_SCHEMA = "an-alq.skill-acknowledgment.v1" as const;
export const SKILL_ACK_STORAGE_NAME = "an-alq.skill-acknowledgment.v1";

const BARRAGE_DEFINITION_IDS = ["spot_jamming", "barrage_jamming", "rgpo", "vgpo"] as const;

const attemptRecordSchema = z
  .object({
    attempts: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    correctElapsedMs: z.number().nonnegative(),
  })
  .strict();

const thresholdSchema = {
  minAttempts: z.number().int().positive(),
  minAccuracy: z.number().min(0).max(1),
  maxMeanCorrectMs: z.number().positive().nullable(),
};

const criterionSchema = z.discriminatedUnion("source", [
  z
    .object({
      source: z.literal("any"),
      ...thresholdSchema,
    })
    .strict(),
  z
    .object({
      source: z.literal("category"),
      categories: z.array(z.enum(EMITTER_CATEGORIES)).min(1),
      ...thresholdSchema,
    })
    .strict(),
  z
    .object({
      source: z.literal("difficulty"),
      difficulties: z.array(z.enum(DIFFICULTIES)).min(1),
      ...thresholdSchema,
    })
    .strict(),
  z
    .object({
      source: z.literal("unavailable"),
    })
    .strict(),
  z
    .object({
      source: z.literal("glossary"),
      term: z.literal("barrage_jamming"),
      ask: z.literal("definition"),
    })
    .strict(),
  z
    .object({
      source: z.literal("grid"),
      nodeId: z.literal("converging-fix"),
      ...thresholdSchema,
    })
    .strict(),
]);

const domainSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(3).max(48),
    tier: z.enum(["T1", "T2", "T3", "T4", "T5"]),
    status: z.enum(["playable", "locked"]),
    summary: z.string().min(12).max(240),
    startDeg: z.number().min(0).max(360),
    endDeg: z.number().min(0).max(360),
  })
  .strict();

const nodeSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    domainId: z.string().min(1),
    label: z.string().min(2).max(40),
    mark: z.string().min(2).max(14),
    detail: z.string().min(12).max(280),
    tier: z.enum(["T1", "T2", "T3", "T4", "T5"]),
    shape: z.enum(["dot", "diamond"]),
    ring: z.number().int().min(0).max(2),
    angleDeg: z.number().min(0).max(360),
    requires: z.array(z.string()).max(4),
    criterion: criterionSchema,
    glossaryTerms: z.array(z.string()).max(2),
  })
  .strict();

export const skillMapSchema = z
  .object({
    schema: z.literal(SKILL_MAP_SCHEMA),
    role: z.literal("training"),
    fictional: z.literal(true),
    operational: z.literal(false),
    figures_are: z.literal(ILLUSTRATIVE),
    disclaimer: z.string().min(1),
    participation: z
      .object({
        slot: z.literal("participation-glow-ring"),
        computedBy: z.literal("later-module"),
        shows: z.literal("how-you-participate"),
        mapShows: z.literal("what-you-learned"),
      })
      .strict(),
    evidenceChannels: z
      .object({
        T1: z.array(z.enum(["category", "difficulty"])).min(1),
        T2: z.array(z.string()).min(1),
        T3: z.array(z.string()).min(1),
        T4: z.array(z.string()).min(1),
        T5: z.array(z.string()).min(1),
      })
      .strict(),
    rings: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]),
    tickRing: z.number().positive(),
    domains: z.array(domainSchema).length(6),
    nodes: z.array(nodeSchema).min(12).max(40),
  })
  .strict()
  .superRefine((document, ctx) => {
    const domainIds = new Set<string>();
    for (const domain of document.domains) {
      if (domainIds.has(domain.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate domain ${domain.id}` });
      }
      domainIds.add(domain.id);
    }
    const nodes = new Map(document.nodes.map((node) => [node.id, node]));
    if (nodes.size !== document.nodes.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate node id" });
    }
    for (const node of document.nodes) {
      const domain = document.domains.find((item) => item.id === node.domainId);
      if (!domain) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown domain ${node.domainId}` });
        continue;
      }
      if (!angleInSector(node.angleDeg, domain.startDeg, domain.endDeg)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${node.id} sits outside its sector`,
        });
      }
      if (node.criterion.source === "glossary" && node.id !== "barrage-label") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "glossary criterion is only the barrage definition",
        });
      }
      if (node.criterion.source === "grid" && node.id !== "converging-fix") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "grid criterion is only the fictional converging cell",
        });
      }
      if (
        domain.status === "locked" &&
        node.criterion.source !== "unavailable" &&
        !(node.id === "barrage-label" && node.criterion.source === "glossary") &&
        !(node.id === "converging-fix" && node.criterion.source === "grid")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${node.id} is in a locked domain and needs an unavailable criterion`,
        });
      }
      if (domain.status === "playable" && node.criterion.source === "unavailable") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${node.id} is playable and needs a criterion`,
        });
      }
      for (const term of node.glossaryTerms) {
        if (!resolveGlossaryEntry(term)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown glossary id ${term}` });
        }
      }
      for (const requirement of node.requires) {
        if (!nodes.has(requirement)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${node.id} requires missing ${requirement}`,
          });
        }
      }
    }
    if (hasCycle(document.nodes)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "skill graph has a cycle" });
    }
  });

export type SkillMapDocument = z.infer<typeof skillMapSchema>;
export type SkillNode = SkillMapDocument["nodes"][number];
export type SkillDomain = SkillMapDocument["domains"][number];
export type SkillCriterion = SkillNode["criterion"];

const gate = (minAttempts: number, minAccuracy: number, maxMeanCorrectMs: number | null) => ({
  minAttempts,
  minAccuracy,
  maxMeanCorrectMs,
});

const unavailable = { source: "unavailable" as const };

const rawMap = {
  schema: SKILL_MAP_SCHEMA,
  role: "training" as const,
  fictional: true as const,
  operational: false as const,
  figures_are: ILLUSTRATIVE,
  disclaimer: TRAINING_DISCLAIMER,
  participation: {
    slot: "participation-glow-ring" as const,
    computedBy: "later-module" as const,
    shows: "how-you-participate" as const,
    mapShows: "what-you-learned" as const,
  },
  evidenceChannels: {
    T1: ["category", "difficulty"] as const,
    T2: ["geolocation"],
    T3: ["radar_response", "comms_disruption"],
    T4: ["deception"],
    T5: ["multi_threat"],
  },
  rings: [78, 132, 186] as const,
  tickRing: 228,
  domains: [
    {
      id: "sigint",
      name: "SIGINT classification",
      tier: "T1" as const,
      status: "playable" as const,
      summary:
        "Name fictional emitters from a synthetic waterfall. The only constellation the range can light.",
      startDeg: 332,
      endDeg: 28,
    },
    {
      id: "geolocation",
      name: "Geolocation",
      tier: "T2" as const,
      status: "locked" as const,
      summary:
        "One fictional grid cell. TDOA and AOA nodes stay locked. No coordinates and no fix.",
      startDeg: 32,
      endDeg: 88,
    },
    {
      id: "radar-response",
      name: "Radar response",
      tier: "T3" as const,
      status: "locked" as const,
      summary:
        "Barrage is a glossary definition. Spot, RGPO, and VGPO stay locked. No transmitter.",
      startDeg: 92,
      endDeg: 148,
    },
    {
      id: "comms-disruption",
      name: "Comms disruption",
      tier: "T3" as const,
      status: "locked" as const,
      summary:
        "Preview. FHSS and DSSS recognition for a later drill. Nothing is followed or interrupted.",
      startDeg: 152,
      endDeg: 208,
    },
    {
      id: "deception",
      name: "Electronic deception",
      tier: "T4" as const,
      status: "locked" as const,
      summary:
        "Preview. False-track pictures, the GNSS spoofing term, and denial versus deception. No signal is produced.",
      startDeg: 212,
      endDeg: 268,
    },
    {
      id: "multi-threat",
      name: "Multi-threat ops",
      tier: "T5" as const,
      status: "locked" as const,
      summary:
        "Preview. Time pressure and collateral-spectrum rules across several fictional traces.",
      startDeg: 272,
      endDeg: 328,
    },
  ],
  nodes: [
    node(
      "open-ear",
      "sigint",
      "Open ear",
      "OPEN EAR",
      "Stay with the trace long enough to name three emitters.",
      "T1",
      "diamond",
      0,
      0,
      [],
      { source: "any", ...gate(3, 0.5, null) },
      ["esm"],
    ),
    node(
      "classify-pulsed",
      "sigint",
      "Classify pulsed radar",
      "PULSED",
      "Search, fire-control, tracking, and navigation categories, inside the speed gate.",
      "T1",
      "dot",
      1,
      344,
      ["open-ear"],
      {
        source: "category",
        categories: ["search_radar", "fire_control_radar", "tracking_radar", "navigation_radar"],
        ...gate(4, 0.75, 1400),
      },
      ["prf"],
    ),
    node(
      "classify-fhss",
      "sigint",
      "Classify FHSS",
      "FHSS",
      "Name the fictional frequency-hopping handsets before the window closes.",
      "T1",
      "dot",
      1,
      0,
      ["open-ear"],
      { source: "category", categories: ["comms_fhss"], ...gate(3, 0.6, 1400) },
      ["fhss"],
    ),
    node(
      "classify-wideband",
      "sigint",
      "Classify wideband",
      "WIDEBAND",
      "DSSS, LTE, SATCOM, data-link, and GNSS blocks. Shapes only.",
      "T1",
      "dot",
      1,
      16,
      ["open-ear"],
      {
        source: "category",
        categories: ["comms_dsss", "comms_lte", "satcom", "data_link", "gnss"],
        ...gate(4, 0.6, 1500),
      },
      ["dsss"],
    ),
    node(
      "classify-chirp",
      "sigint",
      "Classify chirps",
      "CHIRP",
      "Early-warning and weather categories, after pulsed radar is mastered.",
      "T1",
      "dot",
      2,
      340,
      ["classify-pulsed"],
      {
        source: "category",
        categories: ["early_warning_radar", "weather_radar"],
        ...gate(3, 0.6, 1500),
      },
      ["chirp"],
    ),
    node(
      "classify-continuous",
      "sigint",
      "Classify CW and FMCW",
      "CW",
      "HF tones and the altimeter cartoon, after Open ear.",
      "T1",
      "dot",
      2,
      20,
      ["open-ear"],
      { source: "category", categories: ["hf_comms", "radar_altimeter"], ...gate(3, 0.6, 1500) },
      ["fmcw"],
    ),
    node(
      "low-snr",
      "sigint",
      "Low-SNR ID",
      "LOW SNR",
      "Lead difficulty. Dim traces, still named inside the speed gate.",
      "T1",
      "diamond",
      2,
      0,
      ["classify-pulsed", "classify-fhss", "classify-wideband"],
      { source: "difficulty", difficulties: ["lead"], ...gate(4, 0.6, 1600) },
      ["snr"],
    ),
    node(
      "tdoa-lines",
      "geolocation",
      "TDOA lines",
      "TDOA",
      "Preview. A later map draws time-difference lines. This node does not.",
      "T2",
      "dot",
      1,
      48,
      [],
      unavailable,
      ["tdoa"],
    ),
    node(
      "aoa-bearings",
      "geolocation",
      "AOA bearings",
      "AOA",
      "Preview. Bearing lines are a later tier. No bearing is calculated.",
      "T2",
      "dot",
      1,
      72,
      [],
      unavailable,
      ["aoa"],
    ),
    node(
      "converging-fix",
      "geolocation",
      "Converging fix",
      "FIX",
      "Pick the shared cell on a fictional grid. Illustrative. Not a location.",
      "T2",
      "diamond",
      2,
      60,
      ["low-snr", "classify-chirp", "classify-continuous"],
      { source: "grid", nodeId: "converging-fix", ...gate(3, 0.6, null) },
      ["tdoa"],
    ),
    node(
      "spot-label",
      "radar-response",
      "Spot",
      "SPOT",
      "Preview training label. No jammer and no waveform.",
      "T3",
      "dot",
      1,
      104,
      [],
      unavailable,
      ["spot_jamming"],
    ),
    node(
      "barrage-label",
      "radar-response",
      "Barrage",
      "BARRAGE",
      "Match the glossary definition of the barrage training label. Illustrative. No jammer and no waveform.",
      "T3",
      "dot",
      1,
      136,
      ["low-snr", "classify-chirp", "classify-continuous"],
      { source: "glossary", term: "barrage_jamming", ask: "definition" },
      ["barrage_jamming"],
    ),
    node(
      "rgpo-label",
      "radar-response",
      "RGPO",
      "RGPO",
      "Preview. The glossary defines the term. Nothing is pulled.",
      "T3",
      "dot",
      2,
      104,
      ["spot-label"],
      unavailable,
      ["rgpo"],
    ),
    node(
      "vgpo-label",
      "radar-response",
      "VGPO",
      "VGPO",
      "Preview. The glossary defines the term. Nothing is pulled.",
      "T3",
      "diamond",
      2,
      136,
      ["barrage-label"],
      unavailable,
      ["vgpo"],
    ),
    node(
      "comms-fhss",
      "comms-disruption",
      "FHSS",
      "FHSS",
      "Preview. Recognize the hop cartoon. Nothing is followed.",
      "T3",
      "dot",
      1,
      168,
      [],
      unavailable,
      ["fhss"],
    ),
    node(
      "comms-dsss",
      "comms-disruption",
      "DSSS",
      "DSSS",
      "Preview. Recognize the wide block. Nothing is interrupted.",
      "T3",
      "dot",
      1,
      192,
      [],
      unavailable,
      ["dsss"],
    ),
    node(
      "comms-select",
      "comms-disruption",
      "Selectivity",
      "SELECT",
      "Preview label for a later drill. No link is touched.",
      "T3",
      "diamond",
      2,
      180,
      ["comms-fhss", "comms-dsss"],
      unavailable,
      ["comint"],
    ),
    node(
      "false-track",
      "deception",
      "False tracks",
      "FALSE TRK",
      "Preview pictures of extra tracks. None are generated here.",
      "T4",
      "dot",
      1,
      228,
      [],
      unavailable,
      ["false_target"],
    ),
    node(
      "gnss-term",
      "deception",
      "GNSS spoofing",
      "GNSS",
      "Preview of the glossary term. No navigation signal is produced.",
      "T4",
      "dot",
      1,
      252,
      [],
      unavailable,
      ["gnss_spoofing"],
    ),
    node(
      "denial-choice",
      "deception",
      "Denial or deception",
      "DENIAL",
      "Preview decision. The chart does not choose an attack.",
      "T4",
      "diamond",
      2,
      240,
      ["false-track", "gnss-term"],
      unavailable,
      ["deceptive_jamming"],
    ),
    node(
      "collateral-rule",
      "multi-threat",
      "Collateral",
      "COLLAT.",
      "Preview. Protected categories stay observe-only in later scenarios.",
      "T5",
      "dot",
      1,
      288,
      [],
      unavailable,
      ["esm"],
    ),
    node(
      "time-pressure",
      "multi-threat",
      "Time pressure",
      "TEMPO",
      "Preview. Several clocks at once. Not playable yet.",
      "T5",
      "dot",
      1,
      312,
      [],
      unavailable,
      ["snr"],
    ),
    node(
      "several-traces",
      "multi-threat",
      "Several traces",
      "MULTI",
      "Preview capstone. The range still shows one unknown at a time.",
      "T5",
      "diamond",
      2,
      300,
      ["collateral-rule", "time-pressure"],
      unavailable,
      ["elint"],
    ),
  ],
};

function node(
  id: string,
  domainId: string,
  label: string,
  mark: string,
  detail: string,
  tier: SkillNode["tier"],
  shape: SkillNode["shape"],
  ring: number,
  angleDeg: number,
  requires: string[],
  criterion: SkillCriterion,
  glossaryTerms: string[],
) {
  return {
    id,
    domainId,
    label,
    mark,
    detail,
    tier,
    shape,
    ring,
    angleDeg,
    requires,
    criterion,
    glossaryTerms,
  };
}

const parsedMap = skillMapSchema.safeParse(rawMap);
if (!parsedMap.success) {
  const detail = parsedMap.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Skill map failed validation: ${detail}`);
}

export const skillMap: SkillMapDocument = parsedMap.data;

export const skillNodeById: ReadonlyMap<string, SkillNode> = new Map(
  skillMap.nodes.map((node) => [node.id, node]),
);

export interface AttemptRecord {
  attempts: number;
  correct: number;
  correctElapsedMs: number;
}

export interface SkillEvidence {
  schema: typeof SKILL_EVIDENCE_SCHEMA;
  byCategory: Record<EmitterCategory, AttemptRecord>;
  byDifficulty: Record<Difficulty, AttemptRecord>;
}

export interface AttemptEvent {
  category: EmitterCategory;
  difficulty: Difficulty;
  correct: boolean;
  elapsedMs: number;
}

export interface CriterionScore {
  met: boolean;
  fraction: number;
  attempts: number;
  accuracy: number;
  meanCorrectMs: number | null;
}

export type NodeState = "locked" | "sealed" | "open" | "lit";

export interface NodeStatus {
  id: string;
  state: NodeState;
  fraction: number;
  attempts: number;
  accuracy: number;
  meanCorrectMs: number | null;
}

export interface SkillSnapshot {
  nodes: NodeStatus[];
  litIds: string[];
  litCount: number;
}

export interface ParticipationGlow {
  /** Null until a later module measures how you participate. */
  intensity: number | null;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Browser-only gates for barrage-label. Booleans. No technique fields. Never sent. */
export interface SkillGates {
  schema: typeof SKILL_ACK_SCHEMA;
  barrageLabel: boolean;
  barrageDefinition: boolean;
}

export interface BarrageDefinitionChoice {
  id: (typeof BARRAGE_DEFINITION_IDS)[number];
  definition: string;
}

export interface BarrageDefinitionQuestion {
  prompt: string;
  choices: readonly BarrageDefinitionChoice[];
  answerId: "barrage_jamming";
}

const gatesSchema = z
  .object({
    schema: z.literal(SKILL_ACK_SCHEMA),
    barrageLabel: z.boolean(),
    barrageDefinition: z.boolean(),
  })
  .strict();

export function emptyGates(): SkillGates {
  return { schema: SKILL_ACK_SCHEMA, barrageLabel: false, barrageDefinition: false };
}

/**
 * Definition recognition for barrage-label.
 * Choices are glossary paragraphs. No archetype is named, so Ribbon-4 is not a prompt.
 */
export function barrageDefinitionQuestion(): BarrageDefinitionQuestion {
  const choices = BARRAGE_DEFINITION_IDS.map((id) => {
    const entry = resolveGlossaryEntry(id);
    if (!entry) throw new Error(`missing glossary entry ${id}`);
    return { id, definition: entry.definition };
  });
  return {
    prompt:
      "Which paragraph is the definition of the barrage training label? Illustrative. Not a procedure.",
    choices,
    answerId: "barrage_jamming",
  };
}

export function withBarrageAcknowledgment(gates: SkillGates, acknowledged: boolean): SkillGates {
  if (!acknowledged) return { ...gates, barrageLabel: false, barrageDefinition: false };
  if (gates.barrageLabel) return gates;
  return { ...gates, barrageLabel: true };
}

/** A definition choice counts only after the acknowledgment flag is set. */
export function withBarrageDefinition(gates: SkillGates, choiceId: string): SkillGates {
  if (!gates.barrageLabel) return gates;
  if (choiceId !== barrageDefinitionQuestion().answerId) return gates;
  if (gates.barrageDefinition) return gates;
  return { ...gates, barrageDefinition: true };
}

const evidenceSchema = z
  .object({
    schema: z.literal(SKILL_EVIDENCE_SCHEMA),
    byCategory: z.record(z.string(), attemptRecordSchema),
    byDifficulty: z.record(z.string(), attemptRecordSchema),
  })
  .strict();

export function emptyEvidence(): SkillEvidence {
  const byCategory = {} as Record<EmitterCategory, AttemptRecord>;
  for (const category of EMITTER_CATEGORIES) byCategory[category] = emptyRecord();
  const byDifficulty = {} as Record<Difficulty, AttemptRecord>;
  for (const difficulty of DIFFICULTIES) byDifficulty[difficulty] = emptyRecord();
  return { schema: SKILL_EVIDENCE_SCHEMA, byCategory, byDifficulty };
}

export function recordAttempt(evidence: SkillEvidence, event: AttemptEvent): SkillEvidence {
  const next = cloneEvidence(evidence);
  addAttempt(next.byCategory[event.category], event);
  addAttempt(next.byDifficulty[event.difficulty], event);
  return next;
}

export function applyAttempt(
  evidence: SkillEvidence,
  event: AttemptEvent,
  gates: SkillGates = emptyGates(),
  tier: TierContext = emptyTierContext(),
): { evidence: SkillEvidence; newlyLit: string[] } {
  const before = new Set(evaluateMap(evidence, gates, tier).litIds);
  const next = recordAttempt(evidence, event);
  const after = evaluateMap(next, gates, tier).litIds;
  return {
    evidence: next,
    newlyLit: after.filter((id) => !before.has(id)),
  };
}

export function scoreCriterion(
  evidence: SkillEvidence,
  criterion: SkillCriterion,
  gates: SkillGates = emptyGates(),
  tier: TierContext = emptyTierContext(),
): CriterionScore {
  if (criterion.source === "unavailable") {
    return { met: false, fraction: 0, attempts: 0, accuracy: 0, meanCorrectMs: null };
  }
  if (criterion.source === "glossary") {
    const met = gates.barrageLabel === true && gates.barrageDefinition === true;
    return { met, fraction: met ? 1 : 0, attempts: 0, accuracy: 0, meanCorrectMs: null };
  }
  if (criterion.source === "grid") {
    const score = scoreRecord(tier.evidence.byNode["converging-fix"], criterion);
    if (!tier.acknowledged) return { ...score, met: false };
    return score;
  }
  return scoreRecord(pooledRecord(evidence, criterion), criterion);
}

function scoreRecord(
  record: AttemptRecord,
  criterion: { minAttempts: number; minAccuracy: number; maxMeanCorrectMs: number | null },
): CriterionScore {
  const accuracy = record.attempts === 0 ? 0 : record.correct / record.attempts;
  const meanCorrectMs = record.correct === 0 ? null : record.correctElapsedMs / record.correct;
  const attemptsMet = record.attempts >= criterion.minAttempts;
  const accuracyMet = accuracy + 1e-9 >= criterion.minAccuracy;
  const speedMet =
    criterion.maxMeanCorrectMs === null ||
    (meanCorrectMs !== null && meanCorrectMs <= criterion.maxMeanCorrectMs);
  const attemptFraction = record.attempts / criterion.minAttempts;
  const accuracyFraction = criterion.minAccuracy === 0 ? 1 : accuracy / criterion.minAccuracy;
  const speedFraction =
    criterion.maxMeanCorrectMs === null
      ? 1
      : meanCorrectMs === null
        ? 0
        : Math.min(1, criterion.maxMeanCorrectMs / meanCorrectMs);
  return {
    met: attemptsMet && accuracyMet && speedMet,
    fraction: Math.max(0, Math.min(1, attemptFraction, accuracyFraction, speedFraction)),
    attempts: record.attempts,
    accuracy,
    meanCorrectMs,
  };
}

export function evaluateMap(
  evidence: SkillEvidence,
  gates: SkillGates = emptyGates(),
  tier: TierContext = emptyTierContext(),
): SkillSnapshot {
  const lit = new Set<string>();
  for (let pass = 0; pass < skillMap.nodes.length + 1; pass += 1) {
    let added = false;
    for (const node of skillMap.nodes) {
      if (!canLight(node, lit, evidence, gates, tier)) continue;
      if (lit.has(node.id)) continue;
      lit.add(node.id);
      added = true;
    }
    if (!added) break;
  }
  const nodes = skillMap.nodes.map((node) => statusFor(node, lit, evidence, gates, tier));
  const litIds = nodes.filter((node) => node.state === "lit").map((node) => node.id);
  return { nodes, litIds, litCount: litIds.length };
}

export function participationRingOpacity(glow: ParticipationGlow): number {
  if (glow.intensity === null || !Number.isFinite(glow.intensity)) return 0;
  return Math.min(1, Math.max(0, glow.intensity));
}

export function nodePosition(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.sin(rad) * radius,
    y: -Math.cos(rad) * radius,
  };
}

export function sectorCenter(startDeg: number, endDeg: number): number {
  const start = normalizeDeg(startDeg);
  const end = normalizeDeg(endDeg);
  if (start <= end) return (start + end) / 2;
  return normalizeDeg(start + (end + 360 - start) / 2);
}

export function loadEvidence(store: KeyValueStore | null): SkillEvidence {
  if (!store) return emptyEvidence();
  const raw = store.getItem(SKILL_EVIDENCE_KEY);
  if (!raw) return emptyEvidence();
  try {
    const parsed = evidenceSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return emptyEvidence();
    const evidence = emptyEvidence();
    for (const category of EMITTER_CATEGORIES) {
      const record = parsed.data.byCategory[category];
      if (record && record.correct <= record.attempts) evidence.byCategory[category] = record;
    }
    for (const difficulty of DIFFICULTIES) {
      const record = parsed.data.byDifficulty[difficulty];
      if (record && record.correct <= record.attempts) evidence.byDifficulty[difficulty] = record;
    }
    return evidence;
  } catch {
    return emptyEvidence();
  }
}

export function saveEvidence(store: KeyValueStore, evidence: SkillEvidence): void {
  store.setItem(SKILL_EVIDENCE_KEY, JSON.stringify(evidence));
}

export function loadGates(store: KeyValueStore | null): SkillGates {
  if (!store) return emptyGates();
  const raw = store.getItem(SKILL_ACK_STORAGE_NAME);
  if (!raw) return emptyGates();
  try {
    const parsed = gatesSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return emptyGates();
    return parsed.data;
  } catch {
    return emptyGates();
  }
}

export function saveGates(store: KeyValueStore, gates: SkillGates): void {
  store.setItem(SKILL_ACK_STORAGE_NAME, JSON.stringify(gates));
}

export function browserStore(): KeyValueStore | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function suggestedDifficulty(nodeId: string): Difficulty | null {
  if (nodeId === "low-snr") return "lead";
  return null;
}

function statusFor(
  node: SkillNode,
  lit: ReadonlySet<string>,
  evidence: SkillEvidence,
  gates: SkillGates,
  tier: TierContext,
): NodeStatus {
  const score = scoreCriterion(evidence, node.criterion, gates, tier);
  const domain = skillMap.domains.find((item) => item.id === node.domainId);
  let state: NodeState = "locked";
  if (domain?.status === "playable" || isBarrageGlossary(node) || isConvergingGrid(node)) {
    const ready = node.requires.every((id) => lit.has(id));
    if (!ready) state = "sealed";
    else if (lit.has(node.id)) state = "lit";
    else state = "open";
  }
  return {
    id: node.id,
    state,
    fraction: state === "locked" ? 0 : score.fraction,
    attempts: score.attempts,
    accuracy: score.accuracy,
    meanCorrectMs: score.meanCorrectMs,
  };
}

function canLight(
  node: SkillNode,
  lit: ReadonlySet<string>,
  evidence: SkillEvidence,
  gates: SkillGates,
  tier: TierContext,
): boolean {
  const domain = skillMap.domains.find((item) => item.id === node.domainId);
  if (domain?.status !== "playable" && !isBarrageGlossary(node) && !isConvergingGrid(node)) {
    return false;
  }
  if (!node.requires.every((id) => lit.has(id))) return false;
  return scoreCriterion(evidence, node.criterion, gates, tier).met;
}

function isBarrageGlossary(node: SkillNode): boolean {
  return node.id === "barrage-label" && node.criterion.source === "glossary";
}

function isConvergingGrid(node: SkillNode): boolean {
  return node.id === "converging-fix" && node.criterion.source === "grid";
}

function pooledRecord(
  evidence: SkillEvidence,
  criterion: Exclude<
    SkillCriterion,
    { source: "unavailable" } | { source: "glossary" } | { source: "grid" }
  >,
): AttemptRecord {
  const records =
    criterion.source === "any"
      ? EMITTER_CATEGORIES.map((category) => evidence.byCategory[category])
      : criterion.source === "category"
        ? criterion.categories.map((category) => evidence.byCategory[category])
        : criterion.difficulties.map((difficulty) => evidence.byDifficulty[difficulty]);
  return records.reduce<AttemptRecord>(
    (sum, record) => ({
      attempts: sum.attempts + record.attempts,
      correct: sum.correct + record.correct,
      correctElapsedMs: sum.correctElapsedMs + record.correctElapsedMs,
    }),
    emptyRecord(),
  );
}

function addAttempt(record: AttemptRecord, event: AttemptEvent): void {
  record.attempts += 1;
  if (!event.correct) return;
  record.correct += 1;
  record.correctElapsedMs += Math.max(0, event.elapsedMs);
}

function cloneEvidence(evidence: SkillEvidence): SkillEvidence {
  const next = emptyEvidence();
  for (const category of EMITTER_CATEGORIES)
    next.byCategory[category] = { ...evidence.byCategory[category] };
  for (const difficulty of DIFFICULTIES)
    next.byDifficulty[difficulty] = { ...evidence.byDifficulty[difficulty] };
  return next;
}

function emptyRecord(): AttemptRecord {
  return { attempts: 0, correct: 0, correctElapsedMs: 0 };
}

function angleInSector(angle: number, start: number, end: number): boolean {
  const value = normalizeDeg(angle);
  const from = normalizeDeg(start);
  const to = normalizeDeg(end);
  if (from <= to) return value >= from && value <= to;
  return value >= from || value <= to;
}

function normalizeDeg(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function hasCycle(nodes: readonly { id: string; requires: readonly string[] }[]): boolean {
  const color = new Map<string, 0 | 1 | 2>();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visit = (id: string): boolean => {
    const state = color.get(id) ?? 0;
    if (state === 1) return true;
    if (state === 2) return false;
    color.set(id, 1);
    for (const requirement of byId.get(id)?.requires ?? []) {
      if (visit(requirement)) return true;
    }
    color.set(id, 2);
    return false;
  };
  return nodes.some((node) => visit(node.id));
}
