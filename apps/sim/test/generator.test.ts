// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { emitterById } from "@an-alq/emitters";
import { generateRound, profileFor, trainingRoundSchema } from "../src/engine/generator.js";
import { sampleRow, visualTiming } from "../src/engine/signature.js";
import { DIFFICULTIES, type SignatureDraw } from "../src/engine/types.js";

function argmax(values: ArrayLike<number>): number {
  let best = 0;
  let index = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i] ?? 0;
    if (value > best) {
      best = value;
      index = i;
    }
  }
  return index;
}

describe("training round generator", () => {
  it("is deterministic for the same seed and difficulty", () => {
    const first = generateRound({ seed: 42, difficulty: "operator" });
    const second = generateRound({ seed: 42, difficulty: "operator" });
    expect(second).toEqual(first);
    expect(generateRound({ seed: 42, difficulty: "lead" }).primaryId).not.toBe("");
  });

  it("emits valid rounds whose emitters stay inside the catalog and the window", () => {
    const seen = new Set<string>();
    for (const difficulty of DIFFICULTIES) {
      const profile = profileFor(difficulty);
      for (let seed = 1; seed <= 24; seed += 1) {
        const round = generateRound({ seed, difficulty });
        expect(trainingRoundSchema.safeParse(round).success).toBe(true);
        expect(round.tier).toBe("T1");
        expect(round.operational).toBe(false);
        expect(round.classifyWindowMs).toBe(2000);
        expect(round.choices).toContain(round.primaryId);
        expect(new Set(round.choices).size).toBe(round.choices.length);
        expect(round.choices.length).toBeLessThanOrEqual(profile.choices);
        const primaries = round.emitters.filter((emitter) => emitter.role === "primary");
        expect(primaries).toHaveLength(1);
        const primary = primaries[0];
        expect(primary?.libraryId).toBe(round.primaryId);
        expect(primary?.snrDb).toBeGreaterThanOrEqual(profile.snrDb[0]);
        expect(primary?.snrDb).toBeLessThanOrEqual(profile.snrDb[1]);
        if (difficulty === "recruit") expect(round.emitters).toHaveLength(1);
        if (difficulty === "lead") expect(round.emitters.length).toBeGreaterThanOrEqual(1);
        for (const emitter of round.emitters) {
          const archetype = emitterById(emitter.libraryId);
          expect(archetype).toBeDefined();
          expect(emitter.centerMhz).toBeGreaterThanOrEqual(archetype?.frequency.minMhz ?? 0);
          expect(emitter.centerMhz).toBeLessThanOrEqual(archetype?.frequency.maxMhz ?? 0);
          expect(emitter.centerMhz).toBeGreaterThanOrEqual(round.display.startMhz);
          expect(emitter.centerMhz).toBeLessThanOrEqual(round.display.stopMhz);
          expect(Number.isFinite(emitter.snrDb)).toBe(true);
          expect(emitter.signature).toBe(archetype?.signature);
        }
        seen.add(round.primaryId);
      }
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it("raises difficulty with more traces, lower SNR, and a coarser readout", () => {
    let recruitTraces = 0;
    let leadTraces = 0;
    let recruitSnr = 0;
    let leadSnr = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      const recruit = generateRound({ seed, difficulty: "recruit" });
      const lead = generateRound({ seed, difficulty: "lead" });
      recruitTraces += recruit.emitters.length;
      leadTraces += lead.emitters.length;
      recruitSnr += recruit.emitters[0]?.snrDb ?? 0;
      leadSnr += lead.emitters[0]?.snrDb ?? 0;
      expect(recruit.observation.confidence).toBe("high");
      expect(lead.observation.confidence).toBe("low");
      expect(lead.observation.centerMhz).toBeNull();
      expect(recruit.noiseFloor).toBeLessThan(lead.noiseFloor);
    }
    expect(leadTraces).toBeGreaterThan(recruitTraces);
    expect(recruitSnr).toBeGreaterThan(leadSnr);
    const slots = new Set<number>();
    for (let seed = 1; seed <= 20; seed += 1) {
      const round = generateRound({ seed, difficulty: "operator" });
      slots.add(round.choices.indexOf(round.primaryId));
    }
    expect(slots.size).toBeGreaterThan(1);
  });
});

describe("signature sampler", () => {
  const base: SignatureDraw = {
    kind: "cw",
    centerBin: 32,
    widthBins: 6,
    amplitude: 1,
    periodRows: 1,
    onRows: 1,
    hopChannels: null,
    hopRows: null,
    chirpUp: true,
  };

  it("is deterministic and keeps a tone above the noise floor", () => {
    const input = { bins: 64, noiseFloor: 0, seed: 7, rowIndex: 3, draws: [base] };
    const first = sampleRow(input);
    const second = sampleRow(input);
    expect(Array.from(first)).toEqual(Array.from(second));
    expect(first[32]).toBeGreaterThan(first[0] ?? 0);
    expect(first.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
  });

  it("blanks pulsed rows and walks chirps and hops", () => {
    const slow = visualTiming("pulsed", 80, null);
    const fast = visualTiming("pulsed", 15_000, null);
    expect(slow.periodRows).toBeGreaterThan(fast.periodRows);
    const pulsed: SignatureDraw = { ...base, kind: "pulsed", periodRows: 8, onRows: 1 };
    const on = sampleRow({ bins: 64, noiseFloor: 0, seed: 1, rowIndex: 0, draws: [pulsed] });
    const off = sampleRow({ bins: 64, noiseFloor: 0, seed: 1, rowIndex: 4, draws: [pulsed] });
    expect(on[32]).toBeGreaterThan(off[32] ?? 0);

    const chirp: SignatureDraw = {
      ...base,
      kind: "chirp_pulse",
      widthBins: 24,
      periodRows: 18,
      onRows: 8,
    };
    const early = argmax(
      sampleRow({ bins: 64, noiseFloor: 0, seed: 2, rowIndex: 0, draws: [chirp] }),
    );
    const later = argmax(
      sampleRow({ bins: 64, noiseFloor: 0, seed: 2, rowIndex: 8, draws: [chirp] }),
    );
    expect(later).toBeGreaterThan(early);

    const hop: SignatureDraw = {
      ...base,
      kind: "fhss",
      widthBins: 28,
      hopChannels: 4,
      hopRows: 2,
      periodRows: 2,
      onRows: 2,
    };
    const firstHop = argmax(
      sampleRow({ bins: 64, noiseFloor: 0, seed: 3, rowIndex: 0, draws: [hop] }),
    );
    const laterHop = argmax(
      sampleRow({ bins: 64, noiseFloor: 0, seed: 3, rowIndex: 6, draws: [hop] }),
    );
    expect(laterHop).toBeGreaterThan(firstHop);
  });
});
