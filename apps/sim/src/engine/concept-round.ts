import { resolveGlossaryEntry } from "@an-alq/emitters";
import { z } from "zod/v3";
import { mulberry32, shuffle } from "./prng.js";

/** Definition and board-label rounds. No procedure and no measurement. */
export const CONCEPT_NODE_IDS = ["tdoa-lines", "comms-fhss", "collateral-rule"] as const;
export type ConceptNodeId = (typeof CONCEPT_NODE_IDS)[number];
export const CONCEPT_ROUND_SCHEMA = "an-alq.concept-round.v1" as const;

const choiceSchema = z
  .object({
    id: z.string().min(1).max(40),
    text: z.string().min(12).max(500),
  })
  .strict();

export const conceptRoundSchema = z
  .object({
    schema: z.literal(CONCEPT_ROUND_SCHEMA),
    tier: z.enum(["T2", "T3", "T5"]),
    nodeId: z.enum(CONCEPT_NODE_IDS),
    seed: z.number().int().nonnegative(),
    figures_are: z.literal("illustrative"),
    fictional: z.literal(true),
    operational: z.literal(false),
    ask: z.literal("definition"),
    prompt: z.string().min(12).max(240),
    choices: z.array(choiceSchema).min(3).max(3),
    answerId: z.string().min(1).max(40),
  })
  .strict();

export type ConceptRound = z.infer<typeof conceptRoundSchema>;

const BOARD = [
  { id: "protected", text: "Observe only. A fictional board label. Not a target." },
  { id: "clear", text: "A fictional board label. Not an instruction." },
  { id: "uncertain", text: "A fictional board label. Not an instruction." },
] as const;

function glossaryChoice(id: string): { id: string; text: string } {
  const entry = resolveGlossaryEntry(id);
  if (!entry) throw new Error(`missing glossary entry ${id}`);
  return { id, text: entry.definition };
}

function spec(nodeId: ConceptNodeId): {
  tier: "T2" | "T3" | "T5";
  prompt: string;
  answerId: string;
  choiceIds: readonly string[];
  board: boolean;
} {
  if (nodeId === "tdoa-lines") {
    return {
      tier: "T2",
      prompt: "Which paragraph is the definition of TDOA? It does not compute a fix.",
      answerId: "tdoa",
      choiceIds: ["tdoa", "aoa", "esm"],
      board: false,
    };
  }
  if (nodeId === "comms-fhss") {
    return {
      tier: "T3",
      prompt: "Which paragraph is the definition of FHSS? Nothing is followed.",
      answerId: "fhss",
      choiceIds: ["fhss", "dsss", "esm"],
      board: false,
    };
  }
  return {
    tier: "T5",
    prompt: "Which fictional board label means observe only? This is not an instruction.",
    answerId: "protected",
    choiceIds: BOARD.map((item) => item.id),
    board: true,
  };
}

export function generateConceptRound(nodeId: ConceptNodeId, seed: number): ConceptRound {
  const plan = spec(nodeId);
  const rng = mulberry32(seed >>> 0);
  const ids = shuffle(rng, plan.choiceIds);
  const choices = ids.map((id) => {
    if (plan.board) {
      const item = BOARD.find((entry) => entry.id === id);
      if (!item) throw new Error(`missing board label ${id}`);
      return { id: item.id, text: item.text };
    }
    return glossaryChoice(id);
  });
  const round: ConceptRound = {
    schema: CONCEPT_ROUND_SCHEMA,
    tier: plan.tier,
    nodeId,
    seed: seed >>> 0,
    figures_are: "illustrative",
    fictional: true,
    operational: false,
    ask: "definition",
    prompt: plan.prompt,
    choices,
    answerId: plan.answerId,
  };
  const parsed = conceptRoundSchema.safeParse(round);
  if (!parsed.success) throw new Error("Concept round failed validation");
  return parsed.data;
}

export function scoreConceptPick(
  round: ConceptRound,
  pick: string | null,
  elapsedMs: number,
): { correct: boolean; elapsedMs: number } {
  const elapsed = Math.max(0, elapsedMs);
  if (!pick) return { correct: false, elapsedMs: elapsed };
  return { correct: pick === round.answerId, elapsedMs: elapsed };
}

export function isConceptNodeId(id: string): id is ConceptNodeId {
  return (CONCEPT_NODE_IDS as readonly string[]).includes(id);
}
