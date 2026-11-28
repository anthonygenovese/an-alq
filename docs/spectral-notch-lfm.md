# Spectral-notch LFM demo

Status: prototype. The NumPy code is in [`prototypes/spectral-notch-lfm`](../prototypes/spectral-notch-lfm). The page design and the data shape below are **provisional** until Design Lead's UI spec lands.

**Illustrative.** Synthetic signals and normalised units only. This is a signal-processing teaching demo. It does not receive, record, transmit, jam, spoof, or locate anything, and it adds no real-emitter parameters. See [CONTRIBUTING.md](../CONTRIBUTING.md).

## What it teaches

A linear-FM (LFM) pulse trades a long duration for a wide bandwidth. A matched filter compresses it to a narrow peak of width about `0.886 / B`. If part of the band is removed (a spectral notch, as a spectrum-sharing waveform designer might do), the compressed pulse changes in three ways the demo makes visible:

1. The peak drops, because the pulse has less energy.
2. Sidelobes rise, because the spectrum is no longer a clean rectangle. For an LFM, a spectral feature maps to a delay, so the damage lands at a predictable delay away from the peak.
3. Notch edges matter. A hard edge and a raised-cosine taper trade notch sharpness against sidelobe level.

## Prototype contents

- `lfm_chirp`: complex baseband LFM, unit energy, optional Hann or Hamming amplitude window.
- `notch_mask`, `apply_notch`: frequency-domain mask with `center`, `width` (flat bottom), `depth_db`, and a raised-cosine `taper` on each side. `taper = 0` is a hard notch. Applied with `fft`, `ifft`.
- `matched_filter`: FFT cross-correlation, linear (zero-padded), lag 0 centred.
- Two receive filters: **original** replica (mismatched) and **notched** replica (matched).
- `compression_metrics`: -3 dB and null-to-null mainlobe width, PSL, ISLR, peak loss against the un-notched baseline.
- `measure_notch`: realised notch depth, read from the spectra.
- `run_experiment`: the JSON document below, plus sweeps over depth, width, and taper.

Defaults: B = 40, T = 10, fs = 160 (illustrative MHz and us), notch at +8, 4 wide, 30 dB deep, 2 taper per side. With those, the baseline reads PSL -13.5 dB and a -3 dB width of 0.022 us. The notch costs about 1.4 dB of peak and raises PSL by about 2.4 dB. Run the script for the current numbers. They are illustrative.

## Where it lives on an-alq.com

Its own page, not folded into an existing route. Proposed route: `/spectral-notch` in `apps/web` (siblings today: `/range`, `/map`, `/relay`, `/tiers`). Nothing links to it until the site audit is done and Design Lead has decided navigation.

The site runs on Vercel with no Python runtime in the web app, so the first version is static:

1. Run the NumPy script offline and commit the JSON (`examples/default.json` is the seed). The page reads it as a build-time import. No server call, no new env var, no Vercel setting.
2. A second step, if wanted: precompute a small grid of notch settings (a few centres, widths, depths) and let the sliders pick the nearest one. Still static.
3. A later step, only with a decision from Geno: port the 60 lines of `core.py` to TypeScript (a browser FFT) for live sliders, with the NumPy tests as the reference vectors. Or serve the PyTorch/NumPy code as a function. Both change the deploy surface and are out of scope for this PR.

## Provisional output shape

Schema id: `an-alq.spectral-notch-lfm.v0-provisional`. Names follow the repo's `an-alq.<thing>.v1` convention, with `v0-provisional` standing in until the spec fixes them. A real example is `prototypes/spectral-notch-lfm/examples/default.json`.

```jsonc
{
  "schema": "an-alq.spectral-notch-lfm.v0-provisional",
  "status": "provisional",
  "illustrative": true,
  "label": "Illustrative. Synthetic data and normalised units. ...", // show verbatim near every chart
  "units": { "frequency": "illustrative MHz", "time": "illustrative us", "level": "dB" },
  "params": {
    "waveform": {
      "bandwidth": 40,
      "pulse_width": 10,
      "sample_rate": 160,
      "amplitude_window": "none",
      "n_samples": 1600,
      "time_bandwidth_product": 400,
    },
    "notch": { "center": 8, "width": 4, "depth_db": 30, "taper": 2 },
  },
  "axes": {
    "frequency": [/* n_f values, baseband, illustrative MHz */],
    "delay": [/* n_d values, illustrative us, 0 = compressed peak */],
  },
  "spectrum": {
    "original_db": [/* n_f, 0 dB = original peak */],
    "notched_db": [/* n_f */],
    "mask_db": [/* n_f, the applied mask */],
  },
  "compressed": {
    "baseline_db": [/* n_d, no notch, 0 dB = baseline peak */],
    "replica_original_db": [/* n_d, notched signal, original-chirp filter */],
    "replica_notched_db": [/* n_d, notched signal, notched-chirp filter */],
  },
  "metrics": {
    "baseline": {
      "peak_delay_us": 0,
      "mainlobe_width_3db_us": 0.022,
      "mainlobe_null_to_null_us": 0.05,
      "psl_db": -13.47,
      "islr_db": -9.71,
      "peak_loss_db": 0,
    },
    "replica_original": {/* same keys */},
    "replica_notched": {/* same keys */},
    "notch": {
      "core_attenuation_db": -30,
      "inband_depth_db": -29.9,
      "bandwidth_removed_pct": 16.3,
    },
  },
  "sweeps": {
    "depth_db": [
      {
        "depth_db": 10,
        "replica_original": {
          "psl_db": 0,
          "islr_db": 0,
          "peak_loss_db": 0,
          "mainlobe_width_3db_us": 0,
        },
        "replica_notched": {/* same */},
      },
    ],
    "width": [/* same row shape, keyed by "width" */],
    "taper": [/* same row shape, keyed by "taper" */],
  },
}
```

Rules for the shape: all arrays in a group share one axis and length; levels are dB; no `NaN` or `Infinity` (the tests use `allow_nan=False`); the file is deterministic (no RNG in v0); a UI that sees `illustrative !== true` must refuse to render.

If the model output shape changes after Design Lead publishes a spec, the spec is updated first, then the frontend.

## Path to PyTorch

Goal: the same demo as a differentiable, batched model, so notch parameters can be fitted and swept in bulk. The NumPy functions are written as array-in, array-out with no global state, so each maps one-to-one.

| Step | Change                                                                                                                                                                                                                                                                                                                | Why                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 0    | NumPy reference and tests (this PR). Freeze a few golden vectors (JSON metrics for 5 settings).                                                                                                                                                                                                                       | The PyTorch port must match these within tolerance.                      |
| 1    | Direct port. `np` to `torch`, `np.fft` to `torch.fft.fft`, `ifft`, `fftfreq`. Complex64 and complex128 both tested.                                                                                                                                                                                                   | Parity first. No new behaviour.                                          |
| 2    | Batch. Waveform `[B, N]`, notch parameters `[B, K]` for K notches. Mask built by broadcasting over `freqs[None, :]`. Matched filter is `ifft(fft(rx, n) * conj(fft(ref, n)))` on the last dim. Metrics vectorised.                                                                                                    | Sweeps (the `sweeps` block) become one call instead of a Python loop.    |
| 3    | Differentiable parameters. `center`, `width`, `depth_db`, `taper` are `nn.Parameter` or leaf tensors. Replace the boolean `d <= half` with a smooth edge (`sigmoid`-based or the raised cosine, which is already smooth inside the taper). Window shape (Hann or Hamming blend, or Kaiser `beta`) is a parameter too. | Gradients flow from a loss on the compressed output back to the notch.   |
| 4    | Differentiable metrics. PSL is a hard `max` and is not smooth, so train on a `logsumexp` or p-norm of sidelobe magnitude (soft-PSL). Mask the mainlobe with a smooth gate, not an index slice. Keep the exact metrics for reporting.                                                                                  | Training loss and reported number are different on purpose.              |
| 5    | Loss and demo task. Fit a notch of a fixed width and depth that minimises soft-PSL for a given peak-loss budget. Compare the fit with the grid in `sweeps`. Pure synthetic targets.                                                                                                                                   | A teaching result: "the optimiser picks a wider taper".                  |
| 6    | Device. `device = "cuda" if available else "cpu"`. No code changes beyond `.to(device)`. Use `torch.fft` (cuFFT on GPU). Keep a CPU test path in CI. GPU is optional and only pays off at large batches.                                                                                                              | The demo itself is tiny (N = 1600). GPU matters for sweeps and training. |
| 7    | Export. A script writes the same JSON schema from either backend, plus `"backend": "numpy" or "torch"`.                                                                                                                                                                                                               | The UI does not care which one produced the file.                        |

Points to watch: `torch.fft` on real input returns complex, so build the chirp as complex from the start; use `torch.hann_window(n, periodic=False)` to match `np.hanning`; `fftshift` is `torch.fft.fftshift`; autograd through `abs` at zero has an undefined gradient, so add an epsilon inside the square root; set `torch.manual_seed` for any random init; pin `torch` as an optional extra (`requirements-torch.txt`) so the NumPy path stays dependency-light.

## Blocked on Design Lead's spec

Nothing in the repo describes the UI spec yet (no file, issue, or branch). These are open, and the answers decide the final JSON, so the frontend waits:

1. Field names and casing for every key above (`replica_original`, `mask_db`, `psl_db`, and so on), and whether the UI wants dB arrays or linear magnitudes.
2. Which charts exist: spectrum, compressed pulse, metric sweeps, or fewer. This decides which blocks stay.
3. Axis units and ranges: delay window (now +/-3 us), frequency span, decimation, and the maximum payload size (now about 50 KB).
4. Which controls the page has (centre, width, depth, taper, window, replica mode) and their ranges and steps. This decides whether a precomputed grid is enough.
5. Which metrics are shown, their labels, and the rounding.
6. The wording and placement of the illustrative label, and any glossary ids (the repo uses `packages/emitters` glossary entries).
7. Route name and navigation. `/spectral-notch` is a placeholder.
8. Static JSON, a precomputed grid, or live compute (see the three stages above).

Until then, no change to `apps/web`, `apps/mcp`, `apps/sim`, env vars, or Vercel settings.
