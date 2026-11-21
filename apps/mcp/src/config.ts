export { CAPABILITIES_URL, ILLUSTRATIVE, TRAINING_DISCLAIMER } from "@an-alq/emitters";

export const SERVER_NAME = "an-alq";
export const SERVER_VERSION = "0.1.0";
export const PUBLIC_SITE = "https://an-alq.com";

export const ILLUSTRATIVE_DISCLAIMER =
  "Every quantitative figure is illustrative, as published on an-alq.com. This server is a news, education, and marketing endpoint. It does not sense, jam, spoof, locate, or engage anything.";

export const SAMPLE_DISCLAIMER =
  "Sample content for pipeline testing. Not live news, intelligence, or tasking. See content/FORMAT.md.";

export const SERVER_INSTRUCTIONS = [
  "AN-ALQ public information server v0.1.",
  ILLUSTRATIVE_DISCLAIMER,
  "News drops and frontier picks are sample data until a record's sample field is false.",
  "Accept a 5-digit ZIP only when the caller offers one. Never ask for a name, email, phone, street address, or free-text personal note.",
  "The advanced research division is not open for briefing.",
  "The emitter library is a fictional training catalog for the Range Trainer. It is not a list of real systems.",
].join(" ");

export const RATE_LIMIT = {
  limit: 60,
  windowMs: 60_000,
} as const;

export const JSON_BODY_LIMIT = "32kb";
export const DEFAULT_PORT = 8787;
export const MAX_ARGUMENT_KEYS = 8;

export const CAPABILITIES_RESOURCE_URI = "an-alq://capabilities/summary";
export const EMITTER_LIBRARY_RESOURCE_URI = "an-alq://training/emitter-library";
export const ZIP_CHECK_IN_PROMPT = "zip_check_in";
