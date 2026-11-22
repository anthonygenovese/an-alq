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
      "Pick the shared cell on a fictional grid after T1. No coordinates and no fix. TDOA and AOA nodes stay locked.",
  },
  {
    id: "T3",
    name: "Response technique",
    status: "planned",
    summary:
      "Barrage is a glossary definition after T1 mastery and an acknowledgment. Spot, RGPO, and VGPO stay locked. No transmitter.",
  },
  {
    id: "T4",
    name: "Deception decisions",
    status: "planned",
    summary: "False tracks and denial-versus-deception choices on synthetic pictures. No spoofing.",
  },
  {
    id: "T5",
    name: "Multi-threat",
    status: "planned",
    summary: "Several archetypes at once, with time pressure and collateral-spectrum rules.",
  },
] as const;

export type TrainerTierId = (typeof TRAINER_TIERS)[number]["id"];
