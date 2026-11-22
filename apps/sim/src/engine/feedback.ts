import {
  CATEGORY_LABELS,
  MODULATION_LABELS,
  SIGNATURE_LABELS,
  emitterById,
  resolveGlossaryEntry,
  type EmitterArchetype,
  type GlossaryEntry,
} from "@an-alq/emitters";
import type { Grade } from "./scoring.js";
import type { TrainingRound } from "./types.js";

export interface RoundFeedback {
  correct: boolean;
  reason: Grade["reason"];
  headline: string;
  explanation: string;
  contrast: string | null;
  glossary: Array<{ id: string; term: string; definition: string }>;
  responseNote: string;
}

export function explainRound(
  round: TrainingRound,
  grade: Grade,
  answerId: string | null,
): RoundFeedback {
  const primary = emitterById(round.primaryId);
  if (!primary) throw new Error("round primary is not in the library");
  const picked = answerId ? emitterById(answerId) : undefined;
  const glossary = glossaryFor(primary);
  const signature = SIGNATURE_LABELS[primary.signature];
  const explanation = [
    `${primary.name} is a fictional ${CATEGORY_LABELS[primary.category].toLowerCase()}.`,
    `The synthetic trace is a ${signature.toLowerCase()} in ${primary.frequency.band}.`,
    primary.summary,
  ].join(" ");
  const contrast =
    picked && picked.id !== primary.id
      ? `${picked.name} is a ${CATEGORY_LABELS[picked.category].toLowerCase()} (${MODULATION_LABELS[picked.modulation].toLowerCase()}, ${picked.frequency.band}). The planted trace was ${MODULATION_LABELS[primary.modulation].toLowerCase()} in ${primary.frequency.band}.`
      : null;
  return {
    correct: grade.correct,
    reason: grade.reason,
    headline: headlineFor(grade, primary),
    explanation,
    contrast,
    glossary: glossary.slice(0, 2).map((entry) => ({
      id: entry.id,
      term: entry.term,
      definition: entry.definition,
    })),
    responseNote: responseNote(primary),
  };
}

function headlineFor(grade: Grade, primary: EmitterArchetype): string {
  if (grade.correct) return `Correct · ${primary.name}`;
  if (grade.reason === "timeout") return `Time · ${primary.name}`;
  return `Incorrect · ${primary.name}`;
}

function glossaryFor(emitter: EmitterArchetype): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [];
  for (const term of emitter.glossaryTerms) {
    const entry = resolveGlossaryEntry(term);
    if (entry) entries.push(entry);
  }
  return entries;
}

function responseNote(emitter: EmitterArchetype): string {
  const id = emitter.hooks.recommendedResponse.id;
  if (id === "observe_only") {
    const esm = resolveGlossaryEntry("esm");
    const tail = esm ? ` ${esm.definition}` : "";
    return `Training label: observe only.${tail}`;
  }
  const entry = resolveGlossaryEntry(id);
  if (!entry) return "Training label only. Not a procedure.";
  return `Later tiers read the training label “${entry.term}”. ${entry.definition}`;
}
