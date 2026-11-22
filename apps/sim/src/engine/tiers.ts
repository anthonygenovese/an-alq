export const TRAINER_TIERS = [
  {
    id: "T1",
    name: "Spectral classify",
    status: "playable",
    summary:
      "Read a synthetic waterfall and name the emitter from the fictional library inside two seconds.",
  },
  {
    id: "T2",
    name: "Geolocation fix",
    status: "partial",
    summary:
      "A fictional grid and a TDOA definition after T1. AOA stays locked. No coordinates and no fix.",
  },
  {
    id: "T3",
    name: "Response technique",
    status: "partial",
    summary:
      "Barrage and FHSS are glossary definitions after T1. Spot, RGPO, VGPO, and the other comms nodes stay locked. No transmitter.",
  },
  {
    id: "T4",
    name: "Deception decisions",
    status: "planned",
    summary: "Locked. No spoofing content.",
  },
  {
    id: "T5",
    name: "Multi-threat",
    status: "partial",
    summary:
      "Collateral is a fictional board label for observe only. Time pressure and several traces stay locked.",
  },
] as const;

export type TrainerTierId = (typeof TRAINER_TIERS)[number]["id"];
