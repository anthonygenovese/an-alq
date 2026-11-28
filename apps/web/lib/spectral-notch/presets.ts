// SPDX-License-Identifier: MIT
// The seven static v1 presets (spec section 5.1). Payloads are committed JSON, imported at build
// time. Only `default` is in the first chunk; the others are lazy chunks loaded on demand.
// `presets/*.json` are byte copies of prototypes/spectral-notch-lfm/examples/*.v1.json
// (test/notch.test.ts checks that).
import defaultPreset from "./presets/default.v1.json";

export const PRESETS = [
  { id: "default", label: "Default notch" },
  { id: "no-notch", label: "No notch" },
  { id: "narrow-deep", label: "Narrow and deep" },
  { id: "wide-shallow", label: "Wide and shallow" },
  { id: "hard-edge", label: "Hard edge" },
  { id: "soft-edge", label: "Soft edge" },
  { id: "hann-window", label: "Hann window" },
] as const;

export type PresetId = (typeof PRESETS)[number]["id"];

export const DEFAULT_PRESET: PresetId = "default";
export const DEFAULT_PAYLOAD: unknown = defaultPreset;

const loaders: Record<PresetId, () => Promise<{ default: unknown }>> = {
  default: () => Promise.resolve({ default: defaultPreset }),
  "no-notch": () => import("./presets/no-notch.v1.json"),
  "narrow-deep": () => import("./presets/narrow-deep.v1.json"),
  "wide-shallow": () => import("./presets/wide-shallow.v1.json"),
  "hard-edge": () => import("./presets/hard-edge.v1.json"),
  "soft-edge": () => import("./presets/soft-edge.v1.json"),
  "hann-window": () => import("./presets/hann-window.v1.json"),
};

export async function loadPreset(id: PresetId): Promise<unknown> {
  const mod = await loaders[id]();
  return mod.default;
}
