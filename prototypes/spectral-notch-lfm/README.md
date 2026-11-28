# Spectral-notch LFM prototype

A NumPy teaching demo. It builds a synthetic linear-FM (LFM) chirp, cuts a notch in its spectrum, runs a matched filter, and reports how the compressed pulse changes.

**Illustrative.** Every signal is synthetic, every unit is normalised ("illustrative MHz" and "illustrative us"), and nothing here receives, records, transmits, jams, spoofs, or locates anything. It is generic signal processing. See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the project rule.

This is a standalone prototype. It is not wired into `apps/web`, `apps/mcp`, or any deploy. The repo has no other Python, so it sits outside the pnpm workspace on purpose.

Design notes, the provisional UI data shape, and the PyTorch path are in [docs/spectral-notch-lfm.md](../../docs/spectral-notch-lfm.md).

## Run

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt   # numpy only is enough for the library
python -m pytest -q
python scripts/run_demo.py --out-dir out          # JSON + 3 PNGs (PNGs are git-ignored)
python scripts/run_demo.py --center 6 --width 3 --depth 40 --taper 1.5
```

`examples/default.json` is the output for the default parameters. It is the file a UI can be built against while the schema is provisional.

## Layout

| Path                         | What                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `spectral_notch_lfm/core.py` | `lfm_chirp`, `notch_mask`, `apply_notch`, `matched_filter`, metrics, `run_experiment` |
| `scripts/run_demo.py`        | CLI. Writes `spectral-notch-lfm.json` and illustrative plots                          |
| `tests/`                     | pytest. Theory checks (sinc sidelobe, 0.886/B width), mask shape, depth, JSON         |
| `examples/default.json`      | Provisional output for the default parameters                                         |

## What it measures

- **Mainlobe**: -3 dB width and null-to-null width, in us.
- **PSL / ISLR**: peak sidelobe level and integrated sidelobe ratio, in dB against the mainlobe.
- **Peak loss**: compressed peak against the un-notched baseline peak, in dB.
- **Notch depth**: measured from the spectra (`core_attenuation_db`, `inband_depth_db`), not read back from the mask.
- Two receive filters: the **original** chirp as the replica (mismatched), and the **notched** chirp as the replica (matched).
