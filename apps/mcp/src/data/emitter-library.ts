// SPDX-License-Identifier: MIT
export {
  CATALOG_BANDS,
  CATEGORY_LABELS,
  EMITTER_CATEGORIES,
  LIBRARY_SCHEMA,
  MODULATION_LABELS,
  MODULATIONS,
  RESPONSE_IDS,
  SCAN_LABELS,
  SIGNATURE_LABELS,
  SIGNATURES,
  emitterById,
  emitterLibrary,
  emitterLibrarySchema,
  emittersById,
  type EmitterArchetype,
  type EmitterCategory,
  type EmitterLibraryDocument,
  type Modulation,
  type SignatureKind,
} from "@an-alq/emitters";

import { capabilities } from "./capabilities.js";

const RADAR_TECHNIQUE_GLOSSARY = {
  "spot jamming": "spot_jamming",
  "barrage jamming": "barrage_jamming",
  "swept jamming": "swept_jamming",
  "range gate pull-off (RGPO)": "rgpo",
  "velocity gate pull-off (VGPO)": "vgpo",
  "angle deception": "angle_deception",
} as const;

/** Band names in the public capabilities catalog, first-seen order. */
export function capabilityBandNames(): readonly string[] {
  const names = new Set<string>();
  for (const division of capabilities.divisions) {
    for (const entry of division.bands ?? []) names.add(entry.name);
  }
  return [...names];
}

/** Radar technique labels on the capabilities page, mapped to training ids. */
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
