// SPDX-License-Identifier: MIT
// Contract v1.0.0 for the spectral-notch LFM page. Wire names are snake_case, verbatim from the
// NumPy prototype. Illustrative, synthetic, normalized units only. No NaN or Infinity anywhere.

export const SPECTRAL_NOTCH_SCHEMA = "an-alq.spectral-notch-lfm.v1" as const;
export const SPECTRAL_NOTCH_SCHEMA_VERSION = "1.0.0" as const; // semver

export type AmplitudeWindow = "none" | "hann" | "hamming";

/** Uniform ascending axis. value[k] = start + k * step, k = 0..count-1. */
export interface Axis {
  start: number;
  step: number;
  count: number;
  unit: "MHz" | "us"; // illustrative units; the UI prints "MHz" / "µs" plus the illustrative label
}

export interface WaveformParams {
  bandwidth_mhz: number; // B. Chirp sweeps -B/2..+B/2.
  pulse_width_us: number; // T
  sample_rate_mhz: number; // fs, complex samples. fs >= 2 * B
  amplitude_window: AmplitudeWindow;
  n_samples: number; // round(T * fs). Derived, echoed.
  time_bandwidth_product: number; // B * T. Derived, echoed.
}

export interface NotchParams {
  center_mhz: number; // baseband offset
  width_mhz: number; // flat-bottom width
  depth_db: number; // attenuation in the flat bottom, POSITIVE dB (input convention)
  taper_mhz: number; // raised-cosine transition on EACH side. Footprint = width + 2 * taper
}

export interface Meta {
  backend: "numpy" | "torch";
  model_version: string;
  deterministic: true; // v1 has no RNG
  compute_ms: number | null; // null for offline fixtures
  level_floor_db: number; // every dB array is clamped to >= this (-120)
}

export interface Spectrum {
  original_db: number[]; // [F] amplitude dB, 0 = peak of original spectrum
  notched_db: number[]; // [F] same reference
  mask_db: number[]; // [F] applied mask, <= 0, 0 = pass
}

export interface Compressed {
  baseline_db: number[]; // [D] un-notched chirp, matched. 0 dB = baseline peak
  replica_original_db: number[]; // [D] notched signal, ORIGINAL-chirp filter (mismatched). Same reference.
  replica_notched_db: number[]; // [D] notched signal, NOTCHED-chirp filter (matched). Same reference.
}

export interface CompressedZoom {
  delay_us: Axis; // count Z, step = 1/(4*fs), centred on 0
  baseline_db: number[]; // [Z]
  replica_original_db: number[]; // [Z]
  replica_notched_db: number[]; // [Z]
}

export interface CompressionMetrics {
  peak_delay_us: number; // sub-sample peak position. 0 for symmetric cases
  mainlobe_width_3db_us: number; // 4 dp on the wire
  mainlobe_null_to_null_us: number; // 4 dp
  psl_db: number; // <= 0. Peak sidelobe level re. mainlobe peak, 20log10(magnitude)
  islr_db: number; // <= 0. 10log10(sidelobe energy / mainlobe energy)
  peak_loss_db: number; // <= 0. Peak re. BASELINE peak, 20log10(magnitude). 0 for baseline
}

export interface NotchMetrics {
  core_attenuation_db: number; // <= 0. mean power in flat bottom, notched vs original
  inband_depth_db: number; // ~<= 0. Can be slightly > 0 when depth_db = 0 (ripple; seen +0.078). UI clamps the display.
  bandwidth_removed_pct: number; // [0, 100] share of in-band power removed
}

export interface Metrics {
  baseline: CompressionMetrics;
  replica_original: CompressionMetrics;
  replica_notched: CompressionMetrics;
  notch: NotchMetrics;
}

export interface SweepMetrics {
  psl_db: number;
  islr_db: number;
  peak_loss_db: number;
  mainlobe_width_3db_us: number;
}
export interface SweepRow {
  replica_original: SweepMetrics;
  replica_notched: SweepMetrics;
}
export type DepthSweepRow = SweepRow & { depth_db: number };
export type WidthSweepRow = SweepRow & { width_mhz: number };
export type TaperSweepRow = SweepRow & { taper_mhz: number };

export interface Sweeps {
  depth_db: DepthSweepRow[]; // one row per x value; other notch params held at `params.notch`
  width_mhz: WidthSweepRow[];
  taper_mhz: TaperSweepRow[];
}

export interface SpectralNotchLfm {
  schema: typeof SPECTRAL_NOTCH_SCHEMA;
  schema_version: string;
  illustrative: true; // the UI refuses to render anything else
  operational: false; // the UI refuses to render anything else
  label: string; // shown verbatim under every chart
  meta: Meta;
  units: { frequency: string; time: string; level: string };
  params: { waveform: WaveformParams; notch: NotchParams };
  axes: { frequency_mhz: Axis; delay_us: Axis };
  spectrum: Spectrum;
  compressed: Compressed;
  compressed_zoom?: CompressedZoom; // optional since 1.0.0
  metrics: Metrics;
  sweeps?: Sweeps; // optional
}
