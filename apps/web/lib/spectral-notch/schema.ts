// SPDX-License-Identifier: MIT
// Zod 4 consumer schema for contract v1.0.0, copied from Design Lead's spec
// (an-alq-spec/contract/spectral-notch-lfm.zod.ts). Keep the two in step: the spec changes first.
// Unknown keys are stripped (z.object, not z.strictObject) so an additive MINOR field from the
// exporter does not break the page. MAJOR changes change the `schema` literal.
import { z } from "zod";
import type { SpectralNotchLfm } from "./types";

const num = z.number().finite();
const db = num.min(-120); // level_floor_db clamp
const dbArr = z.array(db);

const axis = z.object({
  start: num,
  step: num.positive(),
  count: z.int().positive(),
  unit: z.enum(["MHz", "us"]),
});

const compressionMetrics = z.object({
  peak_delay_us: num,
  mainlobe_width_3db_us: num.positive(),
  mainlobe_null_to_null_us: num.positive(),
  psl_db: num.max(0),
  islr_db: num.max(0),
  peak_loss_db: num.max(0),
});

const sweepMetrics = z.object({
  psl_db: num.max(0),
  islr_db: num.max(0),
  peak_loss_db: num.max(0),
  mainlobe_width_3db_us: num.positive(),
});
const sweepRow = { replica_original: sweepMetrics, replica_notched: sweepMetrics };

export const spectralNotchLfmSchema = z
  .object({
    schema: z.literal("an-alq.spectral-notch-lfm.v1"),
    schema_version: z.string().regex(/^1\.\d+\.\d+$/), // this build understands MAJOR 1
    illustrative: z.literal(true),
    operational: z.literal(false),
    label: z.string().min(1),
    meta: z.object({
      backend: z.enum(["numpy", "torch"]),
      model_version: z.string().min(1),
      deterministic: z.literal(true),
      compute_ms: num.min(0).nullable(),
      level_floor_db: num.max(-40),
    }),
    units: z.object({ frequency: z.string(), time: z.string(), level: z.string() }),
    params: z.object({
      waveform: z.object({
        bandwidth_mhz: num.positive(),
        pulse_width_us: num.positive(),
        sample_rate_mhz: num.positive(),
        amplitude_window: z.enum(["none", "hann", "hamming"]),
        n_samples: z.int().positive(),
        time_bandwidth_product: num.positive(),
      }),
      notch: z.object({
        center_mhz: num,
        width_mhz: num.min(0),
        depth_db: num.min(0),
        taper_mhz: num.min(0),
      }),
    }),
    axes: z.object({ frequency_mhz: axis, delay_us: axis }),
    spectrum: z.object({ original_db: dbArr, notched_db: dbArr, mask_db: dbArr }),
    compressed: z.object({
      baseline_db: dbArr,
      replica_original_db: dbArr,
      replica_notched_db: dbArr,
    }),
    compressed_zoom: z
      .object({
        delay_us: axis,
        baseline_db: dbArr,
        replica_original_db: dbArr,
        replica_notched_db: dbArr,
      })
      .optional(),
    metrics: z.object({
      baseline: compressionMetrics,
      replica_original: compressionMetrics,
      replica_notched: compressionMetrics,
      notch: z.object({
        core_attenuation_db: num.max(0),
        inband_depth_db: num, // can be slightly > 0 when depth_db = 0 (spectrum ripple). Seen: +0.078
        bandwidth_removed_pct: num.min(0).max(100),
      }),
    }),
    sweeps: z
      .object({
        depth_db: z.array(z.object({ depth_db: num.min(0), ...sweepRow })),
        width_mhz: z.array(z.object({ width_mhz: num.min(0), ...sweepRow })),
        taper_mhz: z.array(z.object({ taper_mhz: num.min(0), ...sweepRow })),
      })
      .optional(),
  })
  .superRefine((d, ctx) => {
    // Fixed-text messages. Never echo a value.
    const fail = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    const F = d.axes.frequency_mhz.count;
    const D = d.axes.delay_us.count;
    for (const k of ["original_db", "notched_db", "mask_db"] as const)
      if (d.spectrum[k].length !== F) fail(["spectrum", k], "shape_mismatch");
    for (const k of ["baseline_db", "replica_original_db", "replica_notched_db"] as const)
      if (d.compressed[k].length !== D) fail(["compressed", k], "shape_mismatch");
    if (d.compressed_zoom) {
      const Z = d.compressed_zoom.delay_us.count;
      for (const k of ["baseline_db", "replica_original_db", "replica_notched_db"] as const)
        if (d.compressed_zoom[k].length !== Z) fail(["compressed_zoom", k], "shape_mismatch");
    }
    const w = d.params.waveform;
    if (w.sample_rate_mhz < 2 * w.bandwidth_mhz)
      fail(["params", "waveform", "sample_rate_mhz"], "below_nyquist");
    if (d.axes.frequency_mhz.unit !== "MHz" || d.axes.delay_us.unit !== "us")
      fail(["axes"], "unit_mismatch");
  });

export type SpectralNotchLfmParsed = z.output<typeof spectralNotchLfmSchema>;

// Compile-time check: what the schema outputs is what the contract interface describes.
type ParsedMatchesContract = SpectralNotchLfmParsed extends SpectralNotchLfm ? true : never;
export const parsedMatchesContract: ParsedMatchesContract = true;

/** Fixed-text outcomes. The page never echoes a rejected value or field name. */
export type NotchParse =
  | { status: "ok"; doc: SpectralNotchLfmParsed }
  | { status: "refused" } // illustrative !== true or operational !== false
  | { status: "unsupported" }; // schema or major differs, or the shape check failed

/**
 * Parse an untrusted payload. The two safety flags are checked first and on their own, so a
 * payload that is not marked illustrative and non-operational is refused without being read further.
 */
export function parseNotchPayload(raw: unknown): NotchParse {
  if (typeof raw !== "object" || raw === null) return { status: "unsupported" };
  const flags = raw as { illustrative?: unknown; operational?: unknown };
  if (flags.illustrative !== true || flags.operational !== false) return { status: "refused" };
  const result = spectralNotchLfmSchema.safeParse(raw);
  return result.success ? { status: "ok", doc: result.data } : { status: "unsupported" };
}
