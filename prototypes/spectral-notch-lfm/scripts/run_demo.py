# SPDX-License-Identifier: MIT
"""Run the spectral-notch LFM demo: write v1 JSON, and plots if matplotlib exists.

    python scripts/run_demo.py --out-dir out
    python scripts/run_demo.py --preset default --out-dir out
    python scripts/run_demo.py --all-presets --out-dir examples
    python scripts/run_demo.py --center 6 --width 3 --depth 40 --taper 1.5

All data is synthetic and every figure is labelled illustrative.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from spectral_notch_lfm import (  # noqa: E402
    ILLUSTRATIVE_LABEL,
    PRESETS,
    NotchSpec,
    WaveformSpec,
    run_experiment,
)

WATERMARK = "ILLUSTRATIVE: synthetic data, normalized units"
PAYLOAD_CAP = 64 * 1024
PAYLOAD_TARGET = 40 * 1024


def axis_values(axis: dict) -> list[float]:
    return [axis["start"] + i * axis["step"] for i in range(axis["count"])]


def write_json(doc: dict, path: Path) -> str:
    text = json.dumps(doc, separators=(",", ":"), allow_nan=False)
    path.write_text(text)
    return text


def plots(doc: dict, out_dir: Path) -> list[Path]:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib not installed: skipping plots", file=sys.stderr)
        return []

    f = axis_values(doc["axes"]["frequency_mhz"])
    d = axis_values(doc["axes"]["delay_us"])
    sp, cp, m = doc["spectrum"], doc["compressed"], doc["metrics"]
    written = []

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(f, sp["original_db"], label="original LFM", lw=1)
    ax.plot(f, sp["notched_db"], label="notched LFM", lw=1.4)
    ax.plot(f, sp["mask_db"], "--", label="notch mask", lw=1)
    ax.set(xlabel="baseband frequency (illustrative MHz)", ylabel="level (dB)", ylim=(-80, 5))
    ax.set_title("Spectrum before and after the notch\n" + WATERMARK, fontsize=10)
    ax.legend(loc="lower left")
    ax.grid(alpha=0.3)
    written.append(out_dir / "spectrum.png")
    fig.tight_layout()
    fig.savefig(written[-1], dpi=130)
    plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(11, 4), sharey=True)
    for ax, key, title in (
        (axes[0], "replica_original_db", "Filter: original chirp (mismatched)"),
        (axes[1], "replica_notched_db", "Filter: notched chirp (matched)"),
    ):
        ax.plot(d, cp["baseline_db"], lw=1, label="no notch")
        ax.plot(d, cp[key], lw=1.2, label="notched")
        ax.set(xlabel="delay (illustrative us)", ylim=(-70, 3), title=title)
        ax.grid(alpha=0.3)
    axes[0].set_ylabel("compressed level (dB re. baseline peak)")
    axes[0].legend(loc="upper right")
    fig.suptitle("Pulse compression output. " + WATERMARK, fontsize=10)
    fig.tight_layout()
    written.append(out_dir / "compression.png")
    fig.savefig(written[-1], dpi=130)
    plt.close(fig)

    if "sweeps" in doc:
        fig, axes = plt.subplots(1, 2, figsize=(10, 3.8))
        for ax, name, xk in ((axes[0], "depth_db", "depth_db"), (axes[1], "width_mhz", "width_mhz")):
            rows = doc["sweeps"][name]
            xs = [r[xk] for r in rows]
            for key, ls in (("replica_original", "-"), ("replica_notched", "--")):
                ax.plot(xs, [r[key]["psl_db"] for r in rows], ls, marker="o", label=f"PSL, {key}")
                ax.plot(xs, [r[key]["peak_loss_db"] for r in rows], ls, marker="s", label=f"peak loss, {key}")
            ax.set(
                xlabel=("notch depth (dB)" if xk == "depth_db" else "notch width (illustrative MHz)"),
                ylabel="dB",
            )
            ax.grid(alpha=0.3)
        axes[0].legend(fontsize=7)
        fig.suptitle("Metric sweeps. " + WATERMARK, fontsize=10)
        fig.tight_layout()
        written.append(out_dir / "sweeps.png")
        fig.savefig(written[-1], dpi=130)
        plt.close(fig)

    _ = m
    return written


def emit(wave: WaveformSpec, notch: NotchSpec, out_dir: Path, name: str, *, no_plots: bool, no_sweeps: bool) -> dict:
    doc = run_experiment(wave, notch, sweeps=not no_sweeps)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{name}.v1.json"
    text = write_json(doc, path)
    n = len(text)
    flag = ""
    if n > PAYLOAD_CAP:
        flag = "  EXCEEDS 64 KB CAP"
    elif n > PAYLOAD_TARGET:
        flag = "  over 40 KB target"
    print(f"wrote {path} ({n} bytes minified{flag})")
    if not no_plots:
        for p in plots(doc, out_dir):
            print(f"wrote {p}")
    return doc


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out-dir", type=Path, default=Path("out"))
    ap.add_argument("--preset", choices=sorted(PRESETS), help="static v1 preset (default: custom / default params)")
    ap.add_argument("--all-presets", action="store_true", help="write every static v1 preset into --out-dir")
    ap.add_argument("--bandwidth", type=float, default=40.0, help="illustrative MHz")
    ap.add_argument("--pulse-width", type=float, default=10.0, help="illustrative us")
    ap.add_argument("--sample-rate", type=float, default=160.0, help="illustrative MHz")
    ap.add_argument("--window", choices=("none", "hann", "hamming"), default="none")
    ap.add_argument("--center", type=float, default=8.0, help="notch centre, illustrative MHz")
    ap.add_argument("--width", type=float, default=4.0, help="flat-bottom width, illustrative MHz")
    ap.add_argument("--depth", type=float, default=30.0, help="notch depth, dB")
    ap.add_argument("--taper", type=float, default=2.0, help="raised-cosine edge per side, illustrative MHz")
    ap.add_argument("--no-sweeps", action="store_true")
    ap.add_argument("--no-plots", action="store_true")
    a = ap.parse_args(argv)

    print(ILLUSTRATIVE_LABEL)
    if a.all_presets:
        for name, (wave, notch) in PRESETS.items():
            emit(wave, notch, a.out_dir, name, no_plots=True, no_sweeps=a.no_sweeps)
        if not a.no_plots:
            wave, notch = PRESETS["default"]
            plots(run_experiment(wave, notch, sweeps=not a.no_sweeps), a.out_dir)
            print("wrote plots for the default preset")
        return 0

    if a.preset:
        wave, notch = PRESETS[a.preset]
        name = a.preset
    else:
        wave = WaveformSpec(a.bandwidth, a.pulse_width, a.sample_rate, a.window)
        notch = NotchSpec(a.center, a.width, a.depth, a.taper)
        name = "spectral-notch-lfm"
    doc = emit(wave, notch, a.out_dir, name, no_plots=a.no_plots, no_sweeps=a.no_sweeps)
    for k in ("baseline", "replica_original", "replica_notched", "notch"):
        print(f"{k:>17}: {doc['metrics'][k]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
