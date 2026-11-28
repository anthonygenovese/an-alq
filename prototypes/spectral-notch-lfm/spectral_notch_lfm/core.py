# SPDX-License-Identifier: MIT
"""Core NumPy routines: LFM chirp, spectral notch, matched filter, metrics.

Units are illustrative: frequency in "MHz", time in "us". They are a
normalized scale for teaching, not a description of any real system.

Every function takes plain arrays and returns plain arrays so the same code
path can be ported to ``torch`` by swapping ``np`` for ``torch`` and
``np.fft`` for ``torch.fft`` (see docs/spectral-notch-lfm.md).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

ILLUSTRATIVE_LABEL = (
    "Illustrative. Synthetic data and normalized units. Not a measurement of any real system."
)

SCHEMA = "an-alq.spectral-notch-lfm.v1"
SCHEMA_VERSION = "1.0.0"
MODEL_VERSION = "numpy-proto-1"
LEVEL_FLOOR_DB = -120.0
DELAY_WINDOW_US = 3.0
SPECTRUM_POINTS = 400  # budget over +-fs/2 before the crop to +-B
ZOOM_HALF_US = 0.25
ZOOM_UPSAMPLE = 4

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

def _axis(start: float, step: float, count: int, unit: str) -> dict:
    return {"start": round(float(start), 6), "step": round(float(step), 8), "count": int(count), "unit": unit}


def _clamp_db(values, nd: int = 1) -> list[float]:
    return [round(max(float(v), LEVEL_FLOOR_DB), nd) for v in values]


def _db(values: np.ndarray, ref: float) -> np.ndarray:
    return 20.0 * np.log10(np.maximum(np.abs(values), 1e-12 * ref) / ref)


def _round_metric(key: str, value: float) -> float:
    return round(float(value), 4 if key.endswith("_us") else 3)


def _round_metrics(m: dict) -> dict:
    return {k: _round_metric(k, v) for k, v in m.items()}


def _compressed_zoom(wave: WaveformSpec, notch: NotchSpec) -> dict:
    """Zero-padded (x4) compressed pulse near the mainlobe. Optional in the v1 contract."""
    _, x = lfm_chirp(wave)
    xn, _ = apply_notch(x, wave.sample_rate, notch)

    def comp(rx: np.ndarray, rep: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        n = rx.size + rep.size - 1
        n_fft = 1 << (n - 1).bit_length()
        spectrum = np.fft.fft(rx, n_fft) * np.conj(np.fft.fft(rep, n_fft))
        shifted = np.fft.fftshift(spectrum)
        pad = n_fft * (ZOOM_UPSAMPLE - 1) // 2
        y = np.fft.fftshift(np.fft.ifft(np.fft.ifftshift(np.pad(shifted, (pad, pad)))) * ZOOM_UPSAMPLE)
        lags = (np.arange(y.size) - y.size // 2) / (wave.sample_rate * ZOOM_UPSAMPLE)
        return lags, y

    lags, y0 = comp(x, x)
    peak = float(np.abs(y0).max())
    sel = np.abs(lags) <= ZOOM_HALF_US
    delay = lags[sel]

    def curve(y: np.ndarray) -> list[float]:
        return _clamp_db(_db(y[sel], peak), 1)

    _, yo = comp(xn, x)
    _, yn = comp(xn, xn)
    step = 1.0 / (wave.sample_rate * ZOOM_UPSAMPLE)
    return {
        "delay_us": _axis(delay[0], step, int(sel.sum()), "us"),
        "baseline_db": curve(y0),
        "replica_original_db": curve(yo),
        "replica_notched_db": curve(yn),
    }


def _sweeps(wave: WaveformSpec, notch: NotchSpec) -> dict:
    def point(n: NotchSpec) -> dict:
        row = {}
        for mode in REPLICA_MODES:
            _, _, _, _, y0, y = _compress(wave, n, mode)
            m = compression_metrics(y, wave.sample_rate, float(np.abs(y0).max()))
            row[MODE_KEY[mode]] = {
                k: _round_metric(k, m[k])
                for k in ("psl_db", "islr_db", "peak_loss_db", "mainlobe_width_3db_us")
            }
        return row

    return {
        "depth_db": [
            {"depth_db": d, **point(NotchSpec(notch.center, notch.width, d, notch.taper))}
            for d in (0.0, 10.0, 20.0, 30.0, 40.0, 60.0)
        ],
        "width_mhz": [
            {"width_mhz": w, **point(NotchSpec(notch.center, w, notch.depth_db, notch.taper))}
            for w in (1.0, 2.0, 4.0, 8.0, 12.0)
        ],
        "taper_mhz": [
            {"taper_mhz": t, **point(NotchSpec(notch.center, notch.width, notch.depth_db, t))}
            for t in (0.0, 1.0, 2.0, 4.0)
        ],
    }


def run_experiment(
    wave: WaveformSpec | None = None,
    notch: NotchSpec | None = None,
    *,
    delay_window_us: float = DELAY_WINDOW_US,
    spectrum_points: int = SPECTRUM_POINTS,
    sweeps: bool = True,
    compressed_zoom: bool = True,
    backend: str = "numpy",
    model_version: str = MODEL_VERSION,
    compute_ms: float | None = None,
) -> dict:
    """Run the demo and return a v1 contract document (an-alq.spectral-notch-lfm.v1)."""
    wave = wave or WaveformSpec()
    notch = notch or NotchSpec()
    fs = wave.sample_rate
    _, x = lfm_chirp(wave)
    xn, mask = apply_notch(x, fs, notch)

    f = np.fft.fftshift(np.fft.fftfreq(x.size, d=1.0 / fs))
    spec0 = np.fft.fftshift(np.abs(np.fft.fft(x)))
    spec1 = np.fft.fftshift(np.abs(np.fft.fft(xn)))
    mask_s = np.fft.fftshift(mask)
    ref = float(spec0.max())

    nyq = np.abs(f) <= fs / 2
    stride = max(1, int(np.ceil(nyq.sum() / spectrum_points)))
    sl = np.flatnonzero(nyq)[::stride]
    f0 = f[sl]
    keep = np.abs(f0) <= wave.bandwidth + 1e-9
    idx = np.flatnonzero(keep)
    fstep = float(f0[1] - f0[0])

    compressed: dict[str, list[float]] = {}
    metrics: dict[str, dict] = {}
    delay_start = None
    delay_count = 0
    y0 = None
    for mode in REPLICA_MODES:
        _, _, _, lags, y0, y = _compress(wave, notch, mode)
        peak0 = float(np.abs(y0).max())
        t = lags / fs
        sel = np.abs(t) <= delay_window_us
        delay_start = float(t[sel][0])
        delay_count = int(sel.sum())
        compressed["baseline_db"] = _clamp_db(_db(y0[sel], peak0), 1)
        compressed[f"{MODE_KEY[mode]}_db"] = _clamp_db(_db(y[sel], peak0), 1)
        metrics[MODE_KEY[mode]] = _round_metrics(
            compression_metrics(y, fs, reference_peak=peak0)
        )
    metrics["baseline"] = _round_metrics(compression_metrics(y0, fs))
    # inband_depth_db can be slightly > 0 when depth_db = 0 because of in-band
    # spectrum ripple (about +0.078 at the defaults). The v1 contract leaves
    # the wire value unclamped; the UI clamps the displayed magnitude.
    metrics["notch"] = _round_metrics(measure_notch(x, xn, fs, wave.bandwidth, notch))

    doc = {
        "schema": SCHEMA,
        "schema_version": SCHEMA_VERSION,
        "illustrative": True,
        "operational": False,
        "label": ILLUSTRATIVE_LABEL,
        "meta": {
            "backend": backend,
            "model_version": model_version,
            "deterministic": True,
            "compute_ms": compute_ms,
            "level_floor_db": LEVEL_FLOOR_DB,
        },
        "units": {"frequency": "illustrative MHz", "time": "illustrative us", "level": "dB"},
        "params": {
            "waveform": {
                "bandwidth_mhz": wave.bandwidth,
                "pulse_width_us": wave.pulse_width,
                "sample_rate_mhz": fs,
                "amplitude_window": wave.amplitude_window,
                "n_samples": wave.n_samples,
                "time_bandwidth_product": round(wave.time_bandwidth_product, 3),
            },
            "notch": {
                "center_mhz": notch.center,
                "width_mhz": notch.width,
                "depth_db": notch.depth_db,
                "taper_mhz": notch.taper,
            },
        },
        "axes": {
            "frequency_mhz": _axis(float(f0[idx[0]]), fstep, int(idx.size), "MHz"),
            "delay_us": _axis(delay_start, 1.0 / fs, delay_count, "us"),
        },
        "spectrum": {
            "original_db": _clamp_db(_db(spec0[sl][idx], ref), 1),
            "notched_db": _clamp_db(_db(spec1[sl][idx], ref), 1),
            "mask_db": _clamp_db(_db(mask_s[sl][idx], 1.0), 1),
        },
        "compressed": compressed,
    }
    if compressed_zoom:
        doc["compressed_zoom"] = _compressed_zoom(wave, notch)
    doc["metrics"] = metrics
    if sweeps:
        doc["sweeps"] = _sweeps(wave, notch)
    return doc


# Static v1 presets. All sit on the sweep grid. See docs/spectral-notch-lfm.md.
PRESETS: dict[str, tuple[WaveformSpec, NotchSpec]] = {
    "default": (WaveformSpec(), NotchSpec(8.0, 4.0, 30.0, 2.0)),
    "no-notch": (WaveformSpec(), NotchSpec(8.0, 4.0, 0.0, 2.0)),
    "narrow-deep": (WaveformSpec(), NotchSpec(8.0, 1.0, 40.0, 2.0)),
    "wide-shallow": (WaveformSpec(), NotchSpec(8.0, 12.0, 10.0, 2.0)),
    "hard-edge": (WaveformSpec(), NotchSpec(8.0, 4.0, 30.0, 0.0)),
    "soft-edge": (WaveformSpec(), NotchSpec(8.0, 4.0, 30.0, 4.0)),
    "hann-window": (WaveformSpec(amplitude_window="hann"), NotchSpec(8.0, 4.0, 30.0, 2.0)),
}
