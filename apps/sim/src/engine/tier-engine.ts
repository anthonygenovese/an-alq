import type { TrainerTierId } from "./tiers.js";
import { generateRound, type GenerateRoundOptions } from "./generator.js";
import { generateGridRound } from "./grid-round.js";
import { gradeAnswer, type Grade, type GradeInput } from "./scoring.js";
import { skillMap, type SkillNode } from "./skill-map.js";

/**
 * Registration for tier rounds. T1 still calls generateRound and gradeAnswer.
 * Locked nodes have no generator.
 */
export type RoundKind = "classify" | "grid" | "glossary" | "locked";

export function classifyRound(options: GenerateRoundOptions) {
  return generateRound(options);
}

export function scoreClassify(input: GradeInput): Grade {
  return gradeAnswer(input);
}

export function gridRound(seed: number) {
  return generateGridRound(seed);
}

export interface TierRegistration {
  tier: TrainerTierId;
  playable: readonly string[];
  locked: readonly string[];
}

export function tierRegistration(tier: TrainerTierId): TierRegistration {
  const nodes = skillMap.nodes.filter((node) => node.tier === tier);
  return {
    tier,
    playable: nodes
      .filter((node) => node.criterion.source !== "unavailable")
      .map((node) => node.id),
    locked: nodes.filter((node) => node.criterion.source === "unavailable").map((node) => node.id),
  };
}

export function roundKind(nodeId: string): RoundKind {
  const node = skillMap.nodes.find((item) => item.id === nodeId);
  if (!node || node.criterion.source === "unavailable") return "locked";
  if (node.criterion.source === "glossary") return "glossary";
  if (node.criterion.source === "grid") return "grid";
  return "classify";
}

export function assertLockedHasNoGenerator(node: SkillNode): boolean {
  return node.criterion.source === "unavailable" && roundKind(node.id) === "locked";
}
