/**
 * Read surface for the web shell. Engine files stay unchanged.
 * Lit nodes come from evaluateMap and the on-device evidence hook.
 */
export { TRAINER_TIERS } from "./engine/tiers.js";
export type { TrainerTierId } from "./engine/tiers.js";
export { evaluateMap, skillMap, skillNodeById } from "./engine/skill-map.js";
export type { NodeState, SkillSnapshot } from "./engine/skill-map.js";
export { useSkillEvidence } from "./useSkillEvidence.js";
