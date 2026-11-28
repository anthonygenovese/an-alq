# Spectral-notch LFM demo

Status: NumPy prototype on `feat/spectral-notch-lfm-prototype`. The JSON it writes is contract **v1.0.0**, schema id `an-alq.spectral-notch-lfm.v1`, built against Design Lead's draft UI field spec. The code is in [`prototypes/spectral-notch-lfm`](../prototypes/spectral-notch-lfm).

**Illustrative.** Synthetic signals and normalized units only. This is a signal-processing teaching demo. It does not receive, record, transmit, jam, spoof, or locate anything, and it adds no real-emitter parameters. See [CONTRIBUTING.md](../CONTRIBUTING.md).

If the model output shape changes, Design Lead's spec is updated first, then any frontend. This PR does not change `apps/web`, env vars, or Vercel settings, and it does not merge or deploy.

## What it teaches

A linear-FM (LFM) pulse trades a long duration for a wide bandwidth. A matched filter compresses it to a narrow peak of width about `0.886 / B`. If part of the band is removed (a spectral notch, as a spectrum-sharing waveform designer might do), the compressed pulse changes in three ways the demo makes visible:

1. The peak drops, because the pulse has less energy.
2. Sidelobes rise, because the spectrum is no longer a clean rectangle. At the defaults the change in the **compressed** output is concentrated in the near sidelobes, within about ±0.2 µs of the peak. A gap does appear in the **pulse envelope** around `t = f0 / k` (2 µs at the defaults, where `f0` is the notch centre and `k` is the chirp rate), but that gap does not show up as a feature in the compressed pulse (levels there sit around −60 to −68 dB, against a baseline of about −55 dB). The page should not mark an "echo" at 2 µs. Teaching the time-gap idea would need the optional `envelope` block Design Lead proposed; that block is not in v1.0.0.
3. Notch edges matter. A hard edge and a raised-cosine taper trade notch sharpness against sidelobe level.

## Prototype contents

- `lfm_chirp`: complex baseband LFM, unit energy, optional Hann or Hamming amplitude window.
- `notch_mask`, `apply_notch`: frequency-domain mask with `center`, `width` (flat bottom), `depth_db`, and a raised-cosine `taper` on each side. `taper = 0` is a hard notch. Applied with `fft`, `ifft`.
- `matched_filter`: FFT cross-correlation, linear (zero-padded), lag 0 centred.
- Two receive filters: **original** replica (mismatched) and **notched** replica (matched).
- `compression_metrics`: -3 dB and null-to-null mainlobe width, PSL, ISLR, peak loss against the un-notched baseline.
- `measure_notch`: realised notch depth, read from the spectra.
- `run_experiment`: the v1 JSON document, including an optional 4× zero-padded `compressed_zoom` and sweeps over depth, width, and taper.
- `PRESETS`: the seven static settings listed below.

Defaults: B = 40, T = 10, fs = 160 (illustrative MHz and us), notch at +8, 4 wide, 30 dB deep, 2 taper per side. With those, the baseline reads PSL −13.466 dB and a −3 dB width of 0.0217 us. The notch costs 1.366 dB of peak on the original-filter column and raises PSL to −11.047 dB. Run the script for the current numbers. They are illustrative.

## Where it lives on an-alq.com

Its own page, not folded into an existing route. Design Lead recommends `/notch` (one word, like `/range` and `/map`). The earlier placeholder was `/spectral-notch`. The route, the nav link, and when it appears are for Geno to decide. Nothing in `apps/web` is changed in this PR, and nothing links to the page until the site audit is done.

The site runs on Vercel with no Python runtime in the web app. Design Lead's plan, which this prototype follows:

1. **Ship static presets now.** Seven JSON files, about 31 KB minified each, lazy-loaded. `examples/*.v1.json` are those files. No server call, no new env var, no Vercel setting.
2. **Skip a precomputed slider grid.** Covering the live ranges would be millions of points.
3. **A TypeScript port of `core.py` for live sliders**, only if Geno approves it. That changes the deploy surface and is out of scope here. A later function would also change the deploy surface.

## v1 output shape

Schema id: `an-alq.spectral-notch-lfm.v1`, `schema_version` `"1.0.0"`. Wire names are snake_case with unit suffixes (`_db`, `_mhz`, `_us`, `_pct`). All levels are dB: `20 log10` for amplitude (spectrum, compressed pulse, PSL, peak loss) and `10 log10` for energy or power ratios (ISLR, `core_attenuation_db`, `inband_depth_db`). No linear magnitude arrays. A real example is `prototypes/spectral-notch-lfm/examples/default.v1.json`. The JSON Schema is `prototypes/spectral-notch-lfm/contract/spectral-notch-lfm.schema.json`.

```jsonc
{
  "schema": "an-alq.spectral-notch-lfm.v1",
  "schema_version": "1.0.0",
  "illustrative": true, // UI refuses to render anything else
  "operational": false, // UI refuses to render anything else
  "label": "Illustrative. Synthetic data and normalized units. Not a measurement of any real system.",
  "meta": {
    "backend": "numpy", // or "torch"
    "model_version": "numpy-proto-0",
    "deterministic": true,
    "compute_ms": null, // null for committed fixtures
    "level_floor_db": -120,
  },
  "units": { "frequency": "illustrative MHz", "time": "illustrative us", "level": "dB" },
  "params": {
    "waveform": {
      "bandwidth_mhz": 40,
      "pulse_width_us": 10,
      "sample_rate_mhz": 160,
      "amplitude_window": "none",
      "n_samples": 1600,
      "time_bandwidth_product": 400,
    },
    "notch": { "center_mhz": 8, "width_mhz": 4, "depth_db": 30, "taper_mhz": 2 },
  },
  "axes": {
    "frequency_mhz": { "start": -40, "step": 0.4, "count": 201, "unit": "MHz" }, // cropped to [-B, +B]
    "delay_us": { "start": -3, "step": 0.00625, "count": 961, "unit": "us" },
  },
  "spectrum": {
    "original_db": [/* 201, 1 dp, 0 = original peak */],
    "notched_db": [],
    "mask_db": [],
  },
  "compressed": {
    "baseline_db": [/* 961, 1 dp, 0 = baseline peak */],
    "replica_original_db": [],
    "replica_notched_db": [],
  },
  "compressed_zoom": {
    // optional. +-0.25 us at 1/(4 fs), 321 points, so the mainlobe is visible
    "delay_us": { "start": -0.25, "step": 0.0015625, "count": 321, "unit": "us" },
    "baseline_db": [],
    "replica_original_db": [],
    "replica_notched_db": [],
  },
  "metrics": {
    "baseline": {
      "peak_delay_us": 0,
      "mainlobe_width_3db_us": 0.0217, // 4 dp
      "mainlobe_null_to_null_us": 0.05,
      "psl_db": -13.466, // 3 dp
      "islr_db": -9.706,
      "peak_loss_db": 0,
    },
    "replica_original": {/* same keys */},
    "replica_notched": {/* same keys */},
    "notch": {
      "core_attenuation_db": -30,
      "inband_depth_db": -29.922,
      "bandwidth_removed_pct": 16.338,
    },
  },
  "sweeps": {
    // optional. Page hides the chart if absent.
    "depth_db": [
      {
        "depth_db": 0,
        "replica_original": {
          "psl_db": 0,
          "islr_db": 0,
          "peak_loss_db": 0,
          "mainlobe_width_3db_us": 0,
        },
        "replica_notched": {/* same */},
      },
    ],
    "width_mhz": [/* keyed by width_mhz */],
    "taper_mhz": [/* keyed by taper_mhz */],
  },
}
```

Rules: axes are uniform, `value[k] = start + k * step`; every array in a group has length `count`; every number is finite (`allow_nan=False`); every dB array value is `>= meta.level_floor_db` (−120), which catches the exact −240 dB nulls of an unweighted LFM; `_us` metrics are 4 decimal places and other metrics are 3; the document is deterministic (no RNG); a UI that sees `illustrative !== true` or `operational !== false` must refuse to render.

### `inband_depth_db`

This is notched core power against mean original in-band power **outside** the notch footprint. When `depth_db = 0` the in-band spectrum still ripples, so the number can be slightly **positive** (0.078 at the defaults). Design Lead's contract leaves the wire value unclamped (`inband_depth_db` is any finite number; `core_attenuation_db` stays `<= 0`). The UI clamps the displayed magnitude to `>= 0`. The exporter follows that: it does not force the wire value `<= 0`.

### Static presets

| Preset id      | width | depth | taper | window |
| -------------- | ----- | ----- | ----- | ------ |
| `default`      | 4     | 30    | 2     | none   |
| `no-notch`     | 4     | 0     | 2     | none   |
| `narrow-deep`  | 1     | 40    | 2     | none   |
| `wide-shallow` | 12    | 10    | 2     | none   |
| `hard-edge`    | 4     | 30    | 0     | none   |
| `soft-edge`    | 4     | 30    | 4     | none   |
| `hann-window`  | 4     | 30    | 2     | hann   |

All use B = 40, T = 10, fs = 160, centre 8, and sit on the sweep grid. `scripts/run_demo.py --all-presets` writes them.

### Payload size (minified, with zoom and sweeps)

The hard cap is 64 KB per payload; the target is 40 KB. All seven presets are about 31.2 KB minified (the Hann window file is 32.4 KB). That is under both.

## Path to PyTorch

Goal: the same demo as a differentiable, batched model, so notch parameters can be fitted and swept in bulk. The NumPy functions are written as array-in, array-out with no global state, so each maps one-to-one. The v1 document already has `meta.backend` (`numpy` or `torch`).

| Step | Change                                                                                                                                                                                                                                                                                                                | Why                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 0    | NumPy reference, v1 exporter, and tests (this branch). Golden vectors are the seven presets.                                                                                                                                                                                                                          | The PyTorch port must match these within tolerance.                      |
| 1    | Direct port. `np` to `torch`, `np.fft` to `torch.fft.fft`, `ifft`, `fftfreq`. Complex64 and complex128 both tested.                                                                                                                                                                                                   | Parity first. No new behaviour.                                          |
| 2    | Batch. Waveform `[B, N]`, notch parameters `[B, K]` for K notches. Mask built by broadcasting over `freqs[None, :]`. Matched filter is `ifft(fft(rx, n) * conj(fft(ref, n)))` on the last dim. Metrics vectorised.                                                                                                    | Sweeps (the `sweeps` block) become one call instead of a Python loop.    |
| 3    | Differentiable parameters. `center`, `width`, `depth_db`, `taper` are `nn.Parameter` or leaf tensors. Replace the boolean `d <= half` with a smooth edge (`sigmoid`-based or the raised cosine, which is already smooth inside the taper). Window shape (Hann or Hamming blend, or Kaiser `beta`) is a parameter too. | Gradients flow from a loss on the compressed output back to the notch.   |
| 4    | Differentiable metrics. PSL is a hard `max` and is not smooth, so train on a `logsumexp` or p-norm of sidelobe magnitude (soft-PSL). Mask the mainlobe with a smooth gate, not an index slice. Keep the exact metrics for reporting.                                                                                  | Training loss and reported number are different on purpose.              |
| 5    | Loss and demo task. Fit a notch of a fixed width and depth that minimises soft-PSL for a given peak-loss budget. Compare the fit with the grid in `sweeps`. Pure synthetic targets.                                                                                                                                   | A teaching result: "the optimiser picks a wider taper".                  |
| 6    | Device. `device = "cuda" if available else "cpu"`. No code changes beyond `.to(device)`. Use `torch.fft` (cuFFT on GPU). Keep a CPU test path in CI. GPU is optional and only pays off at large batches.                                                                                                              | The demo itself is tiny (N = 1600). GPU matters for sweeps and training. |
| 7    | Export. A script writes the same v1 JSON from either backend and sets `meta.backend`.                                                                                                                                                                                                                                 | The UI does not care which one produced the file.                        |

Points to watch: `torch.fft` on real input returns complex, so build the chirp as complex from the start; use `torch.hann_window(n, periodic=False)` to match `np.hanning`; `fftshift` is `torch.fft.fftshift`; autograd through `abs` at zero has an undefined gradient, so add an epsilon inside the square root; set `torch.manual_seed` for any random init; pin `torch` as an optional extra (`requirements-torch.txt`) so the NumPy path stays dependency-light.

## Still open (not blocked for this prototype)

Design Lead's draft answers the field names, the dB convention, the charts, the axis ranges, the payload budget, the seven presets, and the illustrative label. These remain for Geno, and this PR does not decide them:

1. Route `/notch`, and when a nav link appears.
2. Whether to port `core.py` to TypeScript for live sliders.
3. Whether `apps/web` gains a `zod` dependency or a hand validator.
4. The page-note sentence that reuses "Names are fictional."
5. Five glossary entries (PSL, ISLR, matched filter, pulse compression, spectral notch).
6. The optional `envelope` block (a 1.1.0 candidate) for the time-domain gap.

Until those are decided, no change to `apps/web`, `apps/mcp`, `apps/sim`, env vars, or Vercel settings.
