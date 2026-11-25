// SPDX-License-Identifier: MIT
import { ILLUSTRATIVE } from "@an-alq/emitters";
import { z } from "zod/v3";
import { generateRound, trainingRoundSchema } from "./generator.js";
import { DIFFICULTIES, type TrainingRound } from "./types.js";

/**
 * Synthetic T1 scenario. A scenario stores a seed, a difficulty, and scripted
 * answers. loadScenario rebuilds the round with generateRound. Disk reads live
 * in src/node so this module stays free of Node APIs.
 */

export const SCENARIO_SCHEMA_ID = "an-alq.scenario.v1" as const;

const answerSchema = z
  .object({
    elapsedMs: z.number().finite().nonnegative(),
    answerId: z.string().min(1).nullable(),
  })
  .strict();

export const scenarioSchema = z
  .object({
    schema: z.literal(SCENARIO_SCHEMA_ID),
    tier: z.literal("T1"),
    figures_are: z.literal(ILLUSTRATIVE),
    fictional: z.literal(true),
    operational: z.literal(false),
    seed: z.number().int().nonnegative(),
    difficulty: z.enum(DIFFICULTIES),
    answers: z.array(answerSchema).min(1).max(16),
  })
  .strict();

export type Scenario = z.infer<typeof scenarioSchema>;

export interface LoadedScenario {
  scenario: Scenario;
  round: TrainingRound;
}

export function parseScenario(value: unknown): Scenario {
  const parsed = scenarioSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Scenario failed validation: ${issueText(parsed.error)}`);
  }
  return parsed.data;
}

/** Rebuild a round from a parsed scenario value. */
export function loadScenario(value: unknown): LoadedScenario {
  const scenario = parseScenario(value);
  const round = generateRound({ seed: scenario.seed, difficulty: scenario.difficulty });
  const rebuilt = trainingRoundSchema.safeParse(round);
  if (!rebuilt.success) {
    throw new Error(`Rebuilt round failed validation: ${issueText(rebuilt.error)}`);
  }
  return { scenario, round: rebuilt.data };
}

function issueText(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "scenario"}: ${issue.message}`)
    .join("; ");
}
