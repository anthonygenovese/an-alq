import {
  CAPABILITIES_URL,
  ILLUSTRATIVE,
  ILLUSTRATIVE_DISCLAIMER,
  PUBLIC_SITE,
} from "../config.js";

export interface IllustrativeMetric {
  name: string;
  value: string;
  label: typeof ILLUSTRATIVE;
  source: string;
}

export interface SpectrumBand {
  name: string;
  label: typeof ILLUSTRATIVE;
}

export interface CapabilityDivision {
  id: string;
  name: string;
  briefing: "public" | "not_open";
  summary: string;
  source: string;
  techniques?: readonly string[];
  modes?: readonly string[];
  bands?: readonly SpectrumBand[];
  metrics: readonly IllustrativeMetric[];
  notes?: readonly string[];
}

export interface CapabilitiesDocument {
  schema: "an-alq.capabilities.v1";
  product: "AN-ALQ";
  site: string;
  source: string;
  role: "informational";
  figures_are: typeof ILLUSTRATIVE;
  disclaimer: string;
  divisions: readonly CapabilityDivision[];
}

const band = (name: string): SpectrumBand => ({ name, label: ILLUSTRATIVE });

const metric = (
  name: string,
  value: string,
  source: string,
): IllustrativeMetric => ({
  name,
  value,
  label: ILLUSTRATIVE,
  source,
});

export const capabilities: CapabilitiesDocument = {
  schema: "an-alq.capabilities.v1",
  product: "AN-ALQ",
  site: PUBLIC_SITE,
  source: CAPABILITIES_URL,
  role: "informational",
  figures_are: ILLUSTRATIVE,
  disclaimer: ILLUSTRATIVE_DISCLAIMER,
  divisions: [
    {
      id: "radar_jamming",
      name: "Radar jamming",
      briefing: "public",
      source: PUBLIC_SITE,
      summary:
        "The public site describes an AI-adaptive radar-jamming subsystem that classifies an emitter and selects among noise, deceptive, or false-target responses. This catalog names those claims. It does not generate waveforms or run a jammer.",
      techniques: [
        "spot jamming",
        "barrage jamming",
        "swept jamming",
        "range gate pull-off (RGPO)",
        "velocity gate pull-off (VGPO)",
        "angle deception",
      ],
      bands: ["L-band", "S-band", "C-band", "X-band", "Ku-band"].map(band),
      metrics: [
        metric(
          "autonomous_threat_response_latency",
          "<12 ms",
          PUBLIC_SITE,
        ),
      ],
      notes: [
        "Bands on the capabilities page are each marked illustrative.",
        "The homepage describes autonomous threat-response latency as under 12 ms and marks that figure illustrative.",
        "The public page says effectiveness is evaluated with ESM feedback. This server does not perform that loop.",
      ],
    },
    {
      id: "communications_disruption",
      name: "Communications disruption",
      briefing: "public",
      source: CAPABILITIES_URL,
      summary:
        "The public site describes precision RF interdiction against adversarial command-and-control links, data links, and encrypted voice, using machine-learning signal fingerprinting for selectivity. This catalog names the claim. It does not interdict a signal.",
      techniques: [
        "frequency-hopping spread spectrum (FHSS)",
        "direct-sequence spread spectrum (DSSS)",
      ],
      modes: ["reactive", "pre-emptive"],
      bands: ["HF", "VHF", "UHF", "L-band", "S-band"].map(band),
      metrics: [],
      notes: [
        "Coverage on the public page runs from HF through S-band, and each band is marked illustrative.",
        "The public page says FHSS and DSSS waveforms are handled natively. This server only defines the terms.",
        "A pre-emptive mode is named on the public page. This server does not accept frequency plans or hopping sequences.",
      ],
    },
    {
      id: "ai_threat_detection",
      name: "AI threat detection",
      briefing: "public",
      source: CAPABILITIES_URL,
      summary:
        "The public site describes continuous spectral monitoring and neural classification against a library of emitter signatures, with passive ESM and active ELINT modes. Unknown emitters are described as flagged and characterized. This server returns that description. It does not classify a signal.",
      modes: ["passive ESM", "active ELINT"],
      techniques: ["time difference of arrival (TDOA)", "angle of arrival (AOA)"],
      metrics: [
        metric("emitter_library", "40,000+", PUBLIC_SITE),
        metric("identification_latency", "<50 ms", CAPABILITIES_URL),
        metric("classification_accuracy", "99.3%", PUBLIC_SITE),
        metric("frequency_coverage", "0.5–18 GHz", PUBLIC_SITE),
      ],
      notes: [
        "The homepage labels emitter-library size, classification accuracy, and frequency coverage as illustrative.",
        "The capabilities page says known threats are identified in under 50 ms and marks that figure illustrative.",
        "TDOA and AOA are named on the public page as emitter-location concepts. This server does not compute a location.",
      ],
    },
    {
      id: "electronic_deception",
      name: "Electronic deception",
      briefing: "public",
      source: CAPABILITIES_URL,
      summary:
        "The public site describes synthetic radar returns, false AIS tracks, and spoofed navigation signals, including false-target generation, terrain bounce, cross-eye, and GPS/GNSS spoofing. This catalog names those modes. It does not synthesize a return or a navigation signal.",
      techniques: [
        "false target generation",
        "terrain bounce",
        "cross-eye",
        "GPS/GNSS spoofing",
      ],
      bands: ["L1/L2", "X-band", "Ku-band", "EO/IR"].map(band),
      metrics: [
        metric("simultaneous_false_tracks", "up to 64", CAPABILITIES_URL),
      ],
      notes: [
        "The public page marks the maximum of 64 simultaneous false tracks as illustrative.",
        "The public page describes those tracks as carrying independent kinematics, RCS profiles, and Doppler signatures. This server does not produce them.",
      ],
    },
    {
      id: "advanced_research",
      name: "Advanced research",
      briefing: "not_open",
      source: CAPABILITIES_URL,
      summary:
        "AN-ALQ's advanced research division is developing next-generation EW capabilities beyond the current production suite. These programs are in active development and not yet available for general briefing.",
      metrics: [],
      notes: [
        "No program names, schedules, or performance figures are published for this division.",
        "This server will not invent them.",
      ],
    },
  ],
};

export interface CapabilitiesSummary {
  schema: "an-alq.capabilities-summary.v1";
  product: "AN-ALQ";
  site: string;
  source: string;
  role: "informational";
  figures_are: typeof ILLUSTRATIVE;
  disclaimer: string;
  divisions: Array<{
    id: string;
    name: string;
    briefing: CapabilityDivision["briefing"];
    summary: string;
    metrics: readonly IllustrativeMetric[];
  }>;
}

export function capabilitiesSummary(): CapabilitiesSummary {
  return {
    schema: "an-alq.capabilities-summary.v1",
    product: capabilities.product,
    site: capabilities.site,
    source: capabilities.source,
    role: "informational",
    figures_are: ILLUSTRATIVE,
    disclaimer: capabilities.disclaimer,
    divisions: capabilities.divisions.map((division) => ({
      id: division.id,
      name: division.name,
      briefing: division.briefing,
      summary: division.summary,
      metrics: division.metrics,
    })),
  };
}
