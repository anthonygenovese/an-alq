# SPDX-License-Identifier: MIT
import json
import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from spectral_notch_lfm import (  # noqa: E402
    ILLUSTRATIVE_LABEL,
    LEVEL_FLOOR_DB,
    PRESETS,
    SCHEMA,
    SCHEMA_VERSION,
    NotchSpec,
    WaveformSpec,
    apply_notch,
    compression_metrics,
    lfm_chirp,
    matched_filter,
    measure_notch,
    notch_mask,
    run_experiment,
)

WAVE = WaveformSpec()


def compress(notch: NotchSpec, mode: str = "original", wave: WaveformSpec = WAVE):
    _, x = lfm_chirp(wave)
    xn, _ = apply_notch(x, wave.sample_rate, notch)
    _, y0 = matched_filter(x, x)
    _, y = matched_filter(xn, x if mode == "original" else xn)
    return x, xn, y0, y


# ---- waveform ------------------------------------------------------------


def test_chirp_shape_energy_and_envelope():
    t, x = lfm_chirp(WAVE)
    assert x.size == t.size == WAVE.n_samples == 1600
    assert math.isclose(float(np.sum(np.abs(x) ** 2)), 1.0, rel_tol=1e-12)
    assert np.allclose(np.abs(x), np.abs(x[0]))  # constant envelope without a window
    assert WAVE.time_bandwidth_product == 400.0


def test_chirp_energy_sits_inside_the_swept_band():
    _, x = lfm_chirp(WAVE)
    f = np.fft.fftfreq(x.size, 1 / WAVE.sample_rate)
    p = np.abs(np.fft.fft(x)) ** 2
    assert p[np.abs(f) <= WAVE.bandwidth / 2 * 1.1].sum() / p.sum() > 0.98


def test_chirp_instantaneous_frequency_sweeps_up():
    _, x = lfm_chirp(WAVE)
    inst = np.diff(np.unwrap(np.angle(x))) * WAVE.sample_rate / (2 * np.pi)
    assert inst[5] < -0.9 * WAVE.bandwidth / 2 and inst[-5] > 0.9 * WAVE.bandwidth / 2
    assert np.all(np.diff(inst) > -1e-6)


@pytest.mark.parametrize(
    "kwargs",
    [
        dict(bandwidth=0),
        dict(pulse_width=-1),
        dict(sample_rate=10.0),  # below Nyquist for 40
        dict(amplitude_window="kaiser"),
    ],
)
def test_waveform_validation(kwargs):
    with pytest.raises(ValueError):
        WaveformSpec(**kwargs)


# ---- notch mask ----------------------------------------------------------


def test_mask_levels_and_taper_shape():
    f = np.linspace(-40, 40, 8001)
    n = NotchSpec(center=8, width=4, depth_db=30, taper=2)
    m = notch_mask(f, n)
    floor = 10 ** (-30 / 20)
    assert np.allclose(m[np.abs(f - 8) <= 2], floor)
    assert np.allclose(m[np.abs(f - 8) >= 4 + 1e-9], 1.0)
    side = (f > 10) & (f < 12)  # right-hand taper
    assert np.all(np.diff(m[side]) >= -1e-12)  # monotone rise
    assert floor < m[side].min() + 1e-9 and m[side].max() <= 1.0
    mid = m[np.argmin(np.abs(f - 11))]
    assert math.isclose(mid, (1 + floor) / 2, rel_tol=1e-3)  # raised-cosine midpoint


def test_mask_symmetric_about_center_and_hard_edge():
    f = np.linspace(-40, 40, 8001)
    m = notch_mask(f, NotchSpec(center=-5, width=6, depth_db=20, taper=0))
    assert set(np.unique(np.round(m, 9))) == {0.1, 1.0}
    left = m[np.argmin(np.abs(f - (-5 - 2)))]
    right = m[np.argmin(np.abs(f - (-5 + 2)))]
    assert left == right


def test_zero_depth_is_all_ones():
    assert np.all(notch_mask(np.linspace(-20, 20, 101), NotchSpec(depth_db=0)) == 1.0)


@pytest.mark.parametrize("kwargs", [dict(width=-1), dict(taper=-0.1), dict(depth_db=-3)])
def test_notch_validation(kwargs):
    with pytest.raises(ValueError):
        NotchSpec(**kwargs)


# ---- applying the notch --------------------------------------------------


def test_zero_depth_notch_is_identity():
    _, x = lfm_chirp(WAVE)
    xn, _ = apply_notch(x, WAVE.sample_rate, NotchSpec(depth_db=0))
    assert np.allclose(xn, x, atol=1e-12)


@pytest.mark.parametrize("depth", [10.0, 30.0, 50.0])
def test_realised_notch_depth_matches_request(depth):
    notch = NotchSpec(center=8, width=4, depth_db=depth, taper=2)
    x, xn, _, _ = compress(notch)
    m = measure_notch(x, xn, WAVE.sample_rate, WAVE.bandwidth, notch)
    assert math.isclose(m["core_attenuation_db"], -depth, abs_tol=0.05)
    assert math.isclose(m["inband_depth_db"], -depth, abs_tol=1.5)  # chirp ripple
    assert 0 < m["bandwidth_removed_pct"] < 100


def test_notch_removes_energy_and_is_linear():
    _, x = lfm_chirp(WAVE)
    notch = NotchSpec()
    a, _ = apply_notch(x, WAVE.sample_rate, notch)
    b, _ = apply_notch(2 * x, WAVE.sample_rate, notch)
    assert np.allclose(b, 2 * a)
    assert np.sum(np.abs(a) ** 2) < 1.0


# ---- matched filter / compression ---------------------------------------


def test_baseline_compression_matches_theory():
    _, _, y0, _ = compress(NotchSpec(depth_db=0))
    m = compression_metrics(y0, WAVE.sample_rate)
    assert math.isclose(float(np.abs(y0).max()), 1.0, rel_tol=1e-9)  # unit energy
    assert m["peak_delay_us"] == pytest.approx(0.0, abs=1e-3)
    assert m["mainlobe_width_3db_us"] == pytest.approx(0.886 / WAVE.bandwidth, rel=0.1)
    assert m["psl_db"] == pytest.approx(-13.3, abs=0.6)  # sinc first sidelobe
    assert m["peak_loss_db"] == 0.0


def test_matched_filter_tracks_a_delay():
    _, x = lfm_chirp(WAVE)
    shift = 37
    rx = np.concatenate([np.zeros(shift), x])
    lags, y = matched_filter(rx, x)
    assert lags[np.argmax(np.abs(y))] == shift


def test_amplitude_window_lowers_sidelobes():
    wave = WaveformSpec(amplitude_window="hamming")
    _, _, y0, _ = compress(NotchSpec(depth_db=0), wave=wave)
    assert compression_metrics(y0, wave.sample_rate)["psl_db"] < -30


@pytest.mark.parametrize("mode", ["original", "notched"])
def test_peak_loss_grows_with_depth_and_width(mode):
    def loss(**kw):
        _, _, y0, y = compress(NotchSpec(**kw), mode)
        return compression_metrics(y, WAVE.sample_rate, float(np.abs(y0).max()))["peak_loss_db"]

    by_depth = [loss(depth_db=d) for d in (0, 10, 20, 40)]
    by_width = [loss(width=w, depth_db=30) for w in (1, 4, 8, 12)]
    assert by_depth[0] == pytest.approx(0.0, abs=1e-6)
    assert by_depth == sorted(by_depth, reverse=True) and by_depth[-1] < -0.5
    assert by_width == sorted(by_width, reverse=True)


def test_notched_replica_peak_is_retained_energy():
    # |sum conj(xn) xn| = E_retained, so peak loss = 20 log10(E_retained) re. unit energy.
    _, xn, y0, y = compress(NotchSpec(), "notched")
    e = float(np.sum(np.abs(xn) ** 2))
    got = compression_metrics(y, WAVE.sample_rate, float(np.abs(y0).max()))["peak_loss_db"]
    assert got == pytest.approx(20 * math.log10(e), abs=1e-6)


def test_notching_does_not_improve_sidelobes_and_keeps_the_mainlobe():
    _, _, y0, y = compress(NotchSpec(depth_db=40, width=8, taper=1), "original")
    base = compression_metrics(y0, WAVE.sample_rate)
    got = compression_metrics(y, WAVE.sample_rate, float(np.abs(y0).max()))
    assert got["psl_db"] > base["psl_db"] + 0.5  # sidelobes rise
    assert got["islr_db"] > base["islr_db"]
    assert got["peak_delay_us"] == pytest.approx(0.0, abs=1e-3)
    # Removing 8 of 40 MHz does not widen the mainlobe by more than ~25 %.
    assert got["mainlobe_width_3db_us"] < base["mainlobe_width_3db_us"] * 1.25


# ---- JSON document -------------------------------------------------------


def test_document_is_json_safe_labelled_and_consistent():
    doc = run_experiment(sweeps=True)
    text = json.dumps(doc, allow_nan=False)  # no NaN / inf
    assert json.loads(text)["schema"] == SCHEMA == "an-alq.spectral-notch-lfm.v1"
    assert doc["schema_version"] == SCHEMA_VERSION
    assert doc["illustrative"] is True and doc["operational"] is False
    assert doc["label"] == ILLUSTRATIVE_LABEL
    assert "normalised" not in doc["label"]
    assert "status" not in doc and "status_note" not in doc
    f, dly = doc["axes"]["frequency_mhz"], doc["axes"]["delay_us"]
    assert f["count"] == 201 and f["start"] == -40.0 and f["step"] == 0.4 and f["unit"] == "MHz"
    assert dly["count"] == 961 and dly["start"] == -3.0 and dly["step"] == 0.00625 and dly["unit"] == "us"
    assert all(len(v) == f["count"] for v in doc["spectrum"].values())
    assert all(len(v) == dly["count"] for v in doc["compressed"].values())
    z = doc["compressed_zoom"]["delay_us"]
    assert z["count"] == 321 and z["start"] == -0.25 and z["step"] == 0.0015625
    assert all(len(doc["compressed_zoom"][k]) == 321 for k in ("baseline_db", "replica_original_db", "replica_notched_db"))
    assert set(doc["metrics"]) == {"baseline", "replica_original", "replica_notched", "notch"}
    assert set(doc["sweeps"]) == {"depth_db", "width_mhz", "taper_mhz"}
    assert max(doc["compressed"]["baseline_db"]) == pytest.approx(0.0, abs=0.01)
    assert doc["meta"]["level_floor_db"] == LEVEL_FLOOR_DB
    assert doc["meta"]["backend"] == "numpy" and doc["meta"]["compute_ms"] is None
    # params use unit suffixes
    assert set(doc["params"]["waveform"]) >= {"bandwidth_mhz", "pulse_width_us", "sample_rate_mhz"}
    assert set(doc["params"]["notch"]) == {"center_mhz", "width_mhz", "depth_db", "taper_mhz"}


def test_us_metrics_are_rounded_to_4_decimals():
    doc = run_experiment()
    width = doc["metrics"]["baseline"]["mainlobe_width_3db_us"]
    notched = doc["metrics"]["replica_original"]["mainlobe_width_3db_us"]
    assert width == 0.0217 and notched == 0.0209
    for block in ("baseline", "replica_original", "replica_notched"):
        for key, value in doc["metrics"][block].items():
            text = f"{value:.10f}".rstrip("0")
            decimals = len(text.split(".")[1]) if "." in text else 0
            if key.endswith("_us"):
                assert decimals <= 4
            else:
                assert decimals <= 3
    # a 3 dp round would have collapsed both widths
    assert round(width, 3) != round(notched, 3) or width != notched


def test_db_arrays_are_clamped_to_the_floor():
    doc = run_experiment()
    arrays = list(doc["spectrum"].values()) + list(doc["compressed"].values())
    arrays += [doc["compressed_zoom"][k] for k in ("baseline_db", "replica_original_db", "replica_notched_db")]
    floor = doc["meta"]["level_floor_db"]
    assert floor == -120.0
    for arr in arrays:
        assert min(arr) >= floor
        assert all(len(str(v).split(".")[-1]) <= 1 or float(v) == int(v) or str(v).endswith(".0") for v in arr)
    # unweighted LFM baseline has exact nulls that would be -240 dB unclamped
    assert doc["compressed"]["baseline_db"].count(-120.0) == 12


def test_inband_depth_is_left_unclamped_when_slightly_positive():
    wave, notch = PRESETS["no-notch"]
    depth = run_experiment(wave, notch)["metrics"]["notch"]["inband_depth_db"]
    assert depth == 0.078  # in-band ripple; the contract allows a small positive
    assert depth > 0


def test_document_is_deterministic():
    assert run_experiment() == run_experiment()


def test_sweeps_and_zoom_can_be_skipped():
    doc = run_experiment(sweeps=False, compressed_zoom=False)
    assert "sweeps" not in doc and "compressed_zoom" not in doc


def test_committed_examples_match_the_code():
    root = Path(__file__).resolve().parents[1] / "examples"
    for name, (wave, notch) in PRESETS.items():
        path = root / f"{name}.v1.json"
        assert json.loads(path.read_text()) == json.loads(json.dumps(run_experiment(wave, notch)))
