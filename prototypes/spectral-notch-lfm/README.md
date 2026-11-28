# Spectral-notch LFM prototype

A NumPy teaching demo. It builds a synthetic linear-FM (LFM) chirp, cuts a notch in its spectrum, runs a matched filter, and reports how the compressed pulse changes.

**Illustrative.** Every signal is synthetic, every unit is normalized ("illustrative MHz" and "illustrative us"), and nothing here receives, records, transmits, jams, spoofs, or locates anything. It is generic signal processing. See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the project rule.

This is a standalone prototype. It is not wired into `apps/web`, `apps/mcp`, or any deploy. The repo has no other Python, so it sits outside the pnpm workspace on purpose.

The JSON it writes is contract **v1.0.0** (`an-alq.spectral-notch-lfm.v1`), matching Design Lead's draft UI field spec. The shape, the PyTorch path, and what is still waiting on Geno are in [docs/spectral-notch-lfm.md](../../docs/spectral-notch-lfm.md). The JSON Schema is in `contract/spectral-notch-lfm.schema.json`.

## Run

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt   # numpy only is enough for the library
python -m pytest -q
python scripts/run_demo.py --out-dir out                 # default params, JSON + 3 PNGs
python scripts/run_demo.py --preset hard-edge --out-dir out
python scripts/run_demo.py --all-presets --out-dir examples --no-plots
python scripts/run_demo.py --center 6 --width 3 --depth 40 --taper 1.5
```

`examples/*.v1.json` are the seven static presets a UI can load. They are minified (about 31 KB each, under the 64 KB cap and the 40 KB target). Plots from the script are git-ignored and labelled illustrative.

## Layout

| Path                                      | What                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `spectral_notch_lfm/core.py`              | Chirp, notch mask, matched filter, metrics, `run_experiment` (v1 document), `PRESETS` |
| `scripts/run_demo.py`                     | CLI. Writes `{name}.v1.json` and illustrative plots                                   |
| `tests/`                                  | pytest. Theory checks, v1 shape, JSON Schema, Design Lead fixtures                    |
| `examples/{preset}.v1.json`               | Seven static presets                                                                  |
| `contract/spectral-notch-lfm.schema.json` | JSON Schema 2020-12 for the v1 document                                               |

## What it measures

- **Mainlobe**: -3 dB width and null-to-null width, in us (4 decimal places on the wire).
- **PSL / ISLR**: peak sidelobe level (`20 log10`) and integrated sidelobe ratio (`10 log10`), in dB against the mainlobe.
- **Peak loss**: compressed peak against the un-notched baseline peak, `20 log10`, in dB.
- **Notch depth**: measured from the spectra (`core_attenuation_db`, `inband_depth_db`, both `10 log10`), not read back from the mask.
- Two receive filters: the **original** chirp as the replica (mismatched), and the **notched** chirp as the replica (matched).
