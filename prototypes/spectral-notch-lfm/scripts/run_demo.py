# SPDX-License-Identifier: MIT
"""Run the spectral-notch LFM demo: write JSON, and plots if matplotlib exists.

    python scripts/run_demo.py --out-dir out
    python scripts/run_demo.py --center 6 --width 3 --depth 40 --taper 1.5

All data is synthetic and every figure is labelled illustrative.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from spectral_notch_lfm import ILLUSTRATIVE_LABEL, NotchSpec, WaveformSpec, run_experiment  # noqa: E402

WATERMARK = "ILLUSTRATIVE: synthetic data, normalised units"


def plots(doc: dict, out_dir: Path) -> list[Path]:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib not installed: skipping plots", file=sys.stderr)
        return []

    f, d = doc["axes"]["frequency"], doc["axes"]["delay"]
    sp, cp, m = doc["spectrum"], doc["compressed"], doc["metrics"]
    written = []

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.plot(f, sp["original_db"], label="original LFM", lw=1)
    ax.plot(f, sp["notched_db"], label="notched LFM", lw=1.4)
    ax.plot(f, sp["mask_db"], "--", label="notch mask", lw=1)
    ax.set(xlabel="baseband frequency (illustrative MHz)", ylabel="level (dB)", ylim=(-70, 5))
    ax.set_title("Spectrum before and after the notch\n" + WATERMARK, fontsize=10)
    ax.legend(loc="lower left")
    ax.grid(alpha=0.3)
    written.append(out_dir / "spectrum.png")
    fig.tight_layout()
    fig.savefig(written[-1], dpi=130)
    plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(11, 4), sharey=True)
    for ax, key, title in (
        (axes[0], "replica_original_db", "matched to the ORIGINAL chirp"),
        (axes[1], "replica_notched_db", "matched to the NOTCHED chirp"),
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
        for ax, name, xk in ((axes[0], "depth_db", "depth_db"), (axes[1], "width", "width")):
            rows = doc["sweeps"][name]
            xs = [r[xk] for r in rows]
            for key, ls in (("replica_original", "-"), ("replica_notched", "--")):
                ax.plot(xs, [r[key]["psl_db"] for r in rows], ls, marker="o", label=f"PSL, {key}")
                ax.plot(xs, [r[key]["peak_loss_db"] for r in rows], ls, marker="s", label=f"peak loss, {key}")
            ax.set(xlabel=("notch depth (dB)" if xk == "depth_db" else "notch width (illustrative MHz)"), ylabel="dB")
            ax.grid(alpha=0.3)
        axes[0].legend(fontsize=7)
        fig.suptitle("Metric sweeps. " + WATERMARK, fontsize=10)
        fig.tight_layout()
        written.append(out_dir / "sweeps.png")
        fig.savefig(written[-1], dpi=130)
        plt.close(fig)

    _ = m
    return written


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out-dir", type=Path, default=Path("out"))
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

    wave = WaveformSpec(a.bandwidth, a.pulse_width, a.sample_rate, a.window)
    notch = NotchSpec(a.center, a.width, a.depth, a.taper)
    doc = run_experiment(wave, notch, sweeps=not a.no_sweeps)

    a.out_dir.mkdir(parents=True, exist_ok=True)
    json_path = a.out_dir / "spectral-notch-lfm.json"
    json_path.write_text(json.dumps(doc, indent=2) + "\n")
    print(ILLUSTRATIVE_LABEL)
    print(f"wrote {json_path}")
    if not a.no_plots:
        for p in plots(doc, a.out_dir):
            print(f"wrote {p}")
    for k in ("baseline", "replica_original", "replica_notched", "notch"):
        print(f"{k:>17}: {doc['metrics'][k]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
