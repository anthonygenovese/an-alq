import { CAPABILITIES_RESOURCE_URI, ILLUSTRATIVE_DISCLAIMER, SAMPLE_DISCLAIMER } from "./config.js";
import { capabilities, capabilitiesSummary, type CapabilitiesDocument, type CapabilitiesSummary } from "./data/capabilities.js";
import { emitterLibrary, type EmitterLibraryDocument } from "./data/emitter-library.js";
import { frontierMonth, frontierMonths, frontierPicks, newsDropForSlot, newsDrops } from "./data/content.js";
import { GLOSSARY_IDS, resolveGlossaryEntry, type GlossaryEntry } from "./data/glossary.js";
import { postalRegionFromZip } from "./data/postal.js";
import type { FrontierArgs, NewsDropArgs } from "./schemas.js";

const RETENTION = {
  zip_logged: false,
  zip_stored: false,
  user_profile: "none",
} as const;

export function getCapabilities(): CapabilitiesDocument {
  return capabilities;
}

export function getCapabilitiesSummary(): CapabilitiesSummary {
  return capabilitiesSummary();
}

export function getEmitterLibrary(): EmitterLibraryDocument {
  return emitterLibrary;
}

export function getNewsDrop(args: NewsDropArgs) {
  const drop = newsDropForSlot(args.slot);
  const base = {
    schema: "an-alq.news-drop.v1" as const,
    role: "informational" as const,
    disclaimer: newsDrops.disclaimer,
    sample_notice: SAMPLE_DISCLAIMER,
    file_sample: newsDrops.sample,
    file_label: newsDrops.label,
    updated: newsDrops.updated,
    retention: RETENTION,
  };
  if (!drop) {
    return {
      ...base,
      found: false as const,
      slot: args.slot,
      message: "No drop is filed for this slot.",
    };
  }
  return {
    ...base,
    found: true as const,
    drop,
    localization: args.zip
      ? {
          sample: true as const,
          label: "example" as const,
          zip: args.zip,
          postal_region: postalRegionFromZip(args.zip),
          note: "Sample note derived from the first digit of the ZIP you just submitted. The ZIP is not logged or stored. It is not used to locate a person, platform, or emitter.",
        }
      : null,
  };
}

export function getFrontierPicks(args: FrontierArgs) {
  const month = frontierMonth(args.month);
  const base = {
    schema: "an-alq.frontier-picks.v1" as const,
    role: "informational" as const,
    disclaimer: frontierPicks.disclaimer,
    sample_notice: SAMPLE_DISCLAIMER,
    file_sample: frontierPicks.sample,
    file_label: frontierPicks.label,
    updated: frontierPicks.updated,
    month: args.month,
    available_months: frontierMonths(),
  };
  if (!month) {
    return {
      ...base,
      found: false as const,
      message: "No frontier picks are filed for this month. The content store does not invent one.",
    };
  }
  return {
    ...base,
    found: true as const,
    entry: month,
  };
}

export interface GlossaryHit {
  schema: "an-alq.glossary-entry.v1";
  role: "informational";
  disclaimer: string;
  entry: GlossaryEntry;
}

export type ExplainTermResult =
  | { ok: true; body: GlossaryHit }
  | { ok: false; message: string };

export function explainTerm(term: string): ExplainTermResult {
  const entry = resolveGlossaryEntry(term);
  if (!entry) {
    return {
      ok: false,
      message: `Unknown glossary id. Valid ids: ${GLOSSARY_IDS.join(", ")}.`,
    };
  }
  return {
    ok: true,
    body: {
      schema: "an-alq.glossary-entry.v1",
      role: "informational",
      disclaimer:
        "Educational definition only. This server does not sense, jam, spoof, locate, or engage anything.",
      entry,
    },
  };
}

export function zipCheckInMessages(zip: string) {
  return {
    description: "ZIP-only check-in. No name, email, phone, or street address.",
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Check in for a sample AN-ALQ news drop using only this 5-digit ZIP: ${zip}.`,
            `Call get_news_drop with slot "morning" and zip "${zip}".`,
            "Do not ask for a name, email, phone, street address, or any other personal field.",
            ILLUSTRATIVE_DISCLAIMER,
            SAMPLE_DISCLAIMER,
            `The capabilities summary resource is ${CAPABILITIES_RESOURCE_URI}.`,
          ].join(" "),
        },
      },
    ],
  };
}
