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
    status: "planned",
    summary:
      "A synthetic map where TDOA and AOA lines converge on a fix. Hooks live on each archetype. No real coordinates.",
  },
  {
    id: "T3",
    name: "Response technique",
    status: "planned",
    summary:
      "Choose a training label — spot, barrage, or RGPO — and read closed-loop feedback. No transmitter.",
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
