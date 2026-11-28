# SPDX-License-Identifier: MIT
"""Core NumPy routines: LFM chirp, spectral notch, matched filter, metrics.

Units are illustrative: frequency in "MHz", time in "us". They are a
normalised scale for teaching, not a description of any real system.

Every function takes plain arrays and returns plain arrays so the same code
path can be ported to ``torch`` by swapping ``np`` for ``torch`` and
``np.fft`` for ``torch.fft`` (see docs/spectral-notch-lfm.md).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np

ILLUSTRATIVE_LABEL = (
    "Illustrative. Synthetic data and normalised units. Not a measurement of any real system."
)

ReplicaMode = str  # "original" or "notched"
REPLICA_MODES = ("original", "notched")
# JSON keys for the two receive-filter choices.
MODE_KEY = {"original": "replica_original", "notched": "replica_notched"}


@dataclass(frozen=True)
class WaveformSpec:
    """Baseband LFM pulse. Sweeps -bandwidth/2 .. +bandwidth/2 over pulse_width."""

    bandwidth: float = 40.0  # illustrative MHz
    pulse_width: float = 10.0  # illustrative us
    sample_rate: float = 160.0  # illustrative MHz (complex samples)
    amplitude_window: str = "none"  # "none" | "hann" | "hamming"

    def __post_init__(self) -> None:
        if self.bandwidth <= 0 or self.pulse_width <= 0 or self.sample_rate <= 0:
            raise ValueError("bandwidth, pulse_width and sample_rate must be positive")
        if self.sample_rate < 2 * self.bandwidth:
            raise ValueError("sample_rate must be at least 2 x bandwidth (Nyquist)")
        if self.amplitude_window not in ("none", "hann", "hamming"):
            raise ValueError("amplitude_window must be none, hann or hamming")

    @property
    def n_samples(self) -> int:
        return int(round(self.pulse_width * self.sample_rate))

    @property
    def time_bandwidth_product(self) -> float:
        return self.bandwidth * self.pulse_width


@dataclass(frozen=True)
class NotchSpec:
    """Frequency-domain notch.

    ``width`` is the flat-bottom width. ``taper`` is the extra raised-cosine
    transition on EACH side, so the full footprint is ``width + 2 * taper``.
    ``taper = 0`` is a hard (rectangular) notch.
    """

    center: float = 8.0  # illustrative MHz, baseband offset
    width: float = 4.0  # illustrative MHz
    depth_db: float = 30.0  # attenuation in the flat bottom, positive dB
    taper: float = 2.0  # illustrative MHz per side

    def __post_init__(self) -> None:
        if self.width < 0 or self.taper < 0:
            raise ValueError("width and taper must be non-negative")
        if self.depth_db < 0:
            raise ValueError("depth_db is a positive attenuation in dB")


def lfm_chirp(spec: WaveformSpec) -> tuple[np.ndarray, np.ndarray]:
    """Return ``(t, x)``: time axis (us) and unit-energy complex LFM samples."""
    n = spec.n_samples
    t = (np.arange(n) - (n - 1) / 2) / spec.sample_rate  # centred on 0
    k = spec.bandwidth / spec.pulse_width  # chirp rate, MHz/us
    x = np.exp(1j * np.pi * k * t**2)
    if spec.amplitude_window == "hann":
        x = x * np.hanning(n)
    elif spec.amplitude_window == "hamming":
        x = x * np.hamming(n)
    x = x / np.sqrt(np.sum(np.abs(x) ** 2))
    return t, x


def notch_mask(freqs: np.ndarray, notch: NotchSpec) -> np.ndarray:
    """Real amplitude mask over ``freqs`` (1 = pass, ``10**(-depth/20)`` = floor)."""
    floor = 10.0 ** (-notch.depth_db / 20.0)
    d = np.abs(freqs - notch.center)
    half = notch.width / 2.0
    mask = np.ones_like(freqs, dtype=float)
    mask[d <= half] = floor
    if notch.taper > 0:
        edge = (d > half) & (d < half + notch.taper)
        u = (d[edge] - half) / notch.taper  # 0 at the flat bottom, 1 at the pass edge
        mask[edge] = floor + (1.0 - floor) * 0.5 * (1.0 - np.cos(np.pi * u))
    return mask


def apply_notch(x: np.ndarray, sample_rate: float, notch: NotchSpec) -> tuple[np.ndarray, np.ndarray]:
    """Apply the notch with an FFT. Returns ``(x_notched, mask_on_fft_grid)``."""
    freqs = np.fft.fftfreq(x.shape[-1], d=1.0 / sample_rate)
    mask = notch_mask(freqs, notch)
    return np.fft.ifft(np.fft.fft(x) * mask), mask


def matched_filter(rx: np.ndarray, replica: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """FFT cross-correlation of ``rx`` with ``replica``.

    Returns ``(lags, y)`` where ``lags`` are integer sample lags and lag 0 sits
    at the centre of the output. Linear (not circular) correlation.
    """
    n = rx.shape[-1] + replica.shape[-1] - 1
    n_fft = 1 << (n - 1).bit_length()
    y = np.fft.ifft(np.fft.fft(rx, n_fft) * np.conj(np.fft.fft(replica, n_fft)))
    y = np.fft.fftshift(y)
    lags = np.arange(n_fft) - n_fft // 2
    return lags, y


def _parabolic_peak(mag: np.ndarray, i: int) -> float:
    """Sub-sample peak offset from three points around ``i`` (in samples)."""
    if i <= 0 or i >= mag.size - 1:
        return 0.0
    a, b, c = mag[i - 1], mag[i], mag[i + 1]
    den = a - 2 * b + c
    return 0.0 if den == 0 else 0.5 * (a - c) / den


def _first_null(mag: np.ndarray, peak: int, step: int) -> int:
    """Walk from the peak until the envelope stops falling (first local minimum)."""
    i = peak
    while 0 < i + step < mag.size - 1 and mag[i + step] < mag[i]:
        i += step
    return i


def compression_metrics(
    y: np.ndarray, sample_rate: float, reference_peak: float | None = None
) -> dict[str, float]:
    """Mainlobe and sidelobe metrics for one compressed pulse.

    ``reference_peak`` is the baseline (un-notched) peak magnitude. When given,
    ``peak_loss_db`` is measured against it, otherwise it is 0.
    """
    mag = np.abs(y)
    p = int(np.argmax(mag))
    peak = float(mag[p])
    # -3 dB (half power) width by linear interpolation on the envelope.
    half = peak / np.sqrt(2.0)
    lo = p
    while lo > 0 and mag[lo] > half:
        lo -= 1
    hi = p
    while hi < mag.size - 1 and mag[hi] > half:
        hi += 1
    lo_x = lo + (half - mag[lo]) / max(mag[lo + 1] - mag[lo], 1e-300)
    hi_x = hi - (half - mag[hi]) / max(mag[hi - 1] - mag[hi], 1e-300)
    width_3db = (hi_x - lo_x) / sample_rate
    left, right = _first_null(mag, p, -1), _first_null(mag, p, +1)
    null_null = (right - left) / sample_rate
    side = np.ones(mag.size, dtype=bool)
    side[left : right + 1] = False
    side_mag = mag[side]
    psl = 20.0 * np.log10(side_mag.max() / peak) if side_mag.size else float("-inf")
    islr = 10.0 * np.log10(np.sum(side_mag**2) / np.sum(mag[left : right + 1] ** 2))
    ref = peak if reference_peak is None else reference_peak
    return {
        "peak_delay_us": float((p + _parabolic_peak(mag, p) - mag.size // 2) / sample_rate),
        "mainlobe_width_3db_us": float(width_3db),
        "mainlobe_null_to_null_us": float(null_null),
        "psl_db": float(psl),
        "islr_db": float(islr),
        "peak_loss_db": float(20.0 * np.log10(peak / ref)),
    }


def measure_notch(
    x: np.ndarray, x_notched: np.ndarray, sample_rate: float, bandwidth: float, notch: NotchSpec
) -> dict[str, float]:
    """Measure the realised notch from the spectra, not from the mask.

    ``core_attenuation_db``: mean power in the flat bottom, notched vs original.
    ``inband_depth_db``: the same notched core power against the mean original
    in-band power OUTSIDE the notch footprint. This is the number a viewer
    perceives as "how deep is the hole in the spectrum".
    """
    f = np.fft.fftfreq(x.shape[-1], d=1.0 / sample_rate)
    p0 = np.abs(np.fft.fft(x)) ** 2
    p1 = np.abs(np.fft.fft(x_notched)) ** 2
    core = np.abs(f - notch.center) <= notch.width / 2.0
    inband = np.abs(f) <= bandwidth / 2.0
    outside = inband & (np.abs(f - notch.center) > notch.width / 2.0 + notch.taper)
    tiny = 1e-300
    if not core.any():
        return {"core_attenuation_db": 0.0, "inband_depth_db": 0.0, "bandwidth_removed_pct": 0.0}
    core_att = 10.0 * np.log10(max(p1[core].mean(), tiny) / max(p0[core].mean(), tiny))
    depth = 10.0 * np.log10(max(p1[core].mean(), tiny) / max(p0[outside].mean(), tiny)) if outside.any() else core_att
    removed = 100.0 * (1.0 - p1[inband].sum() / p0[inband].sum())
    return {
        "core_attenuation_db": float(core_att),
        "inband_depth_db": float(depth),
        "bandwidth_removed_pct": float(removed),
    }


def _compress(wave: WaveformSpec, notch: NotchSpec, mode: ReplicaMode):
    if mode not in REPLICA_MODES:
        raise ValueError(f"replica mode must be one of {REPLICA_MODES}")
    _, x = lfm_chirp(wave)
    xn, mask = apply_notch(x, wave.sample_rate, notch)
    replica = x if mode == "original" else xn
    lags, y = matched_filter(xn, replica)
    _, y0 = matched_filter(x, x)
    return x, xn, mask, lags, y0, y


def _db(v: np.ndarray, ref: float) -> np.ndarray:
    return 20.0 * np.log10(np.maximum(np.abs(v), 1e-12 * ref) / ref)


def _r(a: np.ndarray, nd: int = 3) -> list[float]:
    return [round(float(v), nd) for v in a]


def run_experiment(
    wave: WaveformSpec | None = None,
    notch: NotchSpec | None = None,
    *,
    delay_window_us: float = 3.0,
    spectrum_points: int = 400,
    sweeps: bool = True,
) -> dict:
    """Run the full demo and return the provisional JSON-ready document."""
    wave = wave or WaveformSpec()
    notch = notch or NotchSpec()
    x = lfm_chirp(wave)[1]
    xn, mask = apply_notch(x, wave.sample_rate, notch)
    f = np.fft.fftshift(np.fft.fftfreq(x.size, d=1.0 / wave.sample_rate))
    spec0 = np.fft.fftshift(np.abs(np.fft.fft(x)))
    spec1 = np.fft.fftshift(np.abs(np.fft.fft(xn)))
    ref = float(spec0.max())
    keep = np.abs(f) <= wave.sample_rate / 2
    stride = max(1, int(np.ceil(keep.sum() / spectrum_points)))
    sl = np.flatnonzero(keep)[::stride]

    compressed: dict[str, list[float]] = {}
    metrics: dict[str, dict] = {}
    delay_axis = None
    for mode in REPLICA_MODES:
        _, _, _, lags, y0, y = _compress(wave, notch, mode)
        peak0 = float(np.abs(y0).max())
        t = lags / wave.sample_rate
        sel = np.abs(t) <= delay_window_us
        delay_axis = t[sel]
        compressed["baseline_db"] = _r(_db(y0[sel], peak0), 2)
        compressed[f"{MODE_KEY[mode]}_db"] = _r(_db(y[sel], peak0), 2)
        metrics[MODE_KEY[mode]] = compression_metrics(y, wave.sample_rate, reference_peak=peak0)
    metrics["baseline"] = compression_metrics(y0, wave.sample_rate)
    metrics["notch"] = measure_notch(x, xn, wave.sample_rate, wave.bandwidth, notch)
    metrics = {k: {m: round(v, 3) for m, v in d.items()} for k, d in metrics.items()}

    doc = {
        "schema": "an-alq.spectral-notch-lfm.v0-provisional",
        "status": "provisional",
        "status_note": (
            "Field names and shapes are a placeholder until Design Lead's UI spec lands."
        ),
        "illustrative": True,
        "label": ILLUSTRATIVE_LABEL,
        "units": {"frequency": "illustrative MHz", "time": "illustrative us", "level": "dB"},
        "params": {
            "waveform": {
                **asdict(wave),
                "n_samples": wave.n_samples,
                "time_bandwidth_product": round(wave.time_bandwidth_product, 3),
            },
            "notch": asdict(notch),
        },
        "axes": {
            "frequency": _r(f[sl], 3),
            "delay": _r(delay_axis, 4),
        },
        "spectrum": {
            "original_db": _r(_db(spec0[sl], ref), 2),
            "notched_db": _r(_db(spec1[sl], ref), 2),
            "mask_db": _r(_db(np.fft.fftshift(mask)[sl], 1.0), 2),
        },
        "compressed": compressed,
        "metrics": metrics,
    }
    if sweeps:
        doc["sweeps"] = _sweeps(wave, notch)
    return doc


def _sweeps(wave: WaveformSpec, notch: NotchSpec) -> dict:
    def point(n: NotchSpec) -> dict:
        row = {}
        for mode in REPLICA_MODES:
            _, _, _, _, y0, y = _compress(wave, n, mode)
            m = compression_metrics(y, wave.sample_rate, float(np.abs(y0).max()))
            row[MODE_KEY[mode]] = {k: round(m[k], 3) for k in ("psl_db", "islr_db", "peak_loss_db", "mainlobe_width_3db_us")}
        return row

    depths = [0.0, 10.0, 20.0, 30.0, 40.0, 60.0]
    widths = [1.0, 2.0, 4.0, 8.0, 12.0]
    return {
        "depth_db": [
            {"depth_db": d, **point(NotchSpec(notch.center, notch.width, d, notch.taper))} for d in depths
        ],
        "width": [
            {"width": w, **point(NotchSpec(notch.center, w, notch.depth_db, notch.taper))} for w in widths
        ],
        "taper": [
            {"taper": tp, **point(NotchSpec(notch.center, notch.width, notch.depth_db, tp))}
            for tp in (0.0, 1.0, 2.0, 4.0)
        ],
    }
