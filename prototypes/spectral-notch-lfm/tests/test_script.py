# SPDX-License-Identifier: MIT
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import run_demo  # noqa: E402
from spectral_notch_lfm import PRESETS  # noqa: E402


def test_script_writes_labelled_v1_json(tmp_path, capsys):
    rc = run_demo.main(["--out-dir", str(tmp_path), "--no-plots", "--no-sweeps", "--depth", "20"])
    assert rc == 0
    doc = json.loads((tmp_path / "spectral-notch-lfm.v1.json").read_text())
    assert doc["schema"] == "an-alq.spectral-notch-lfm.v1"
    assert doc["params"]["notch"]["depth_db"] == 20.0
    assert doc["illustrative"] is True and doc["operational"] is False
    assert "normalized" in doc["label"]
    assert "Illustrative" in capsys.readouterr().out


def test_script_writes_a_named_preset(tmp_path):
    assert run_demo.main(["--out-dir", str(tmp_path), "--preset", "hard-edge", "--no-plots"]) == 0
    doc = json.loads((tmp_path / "hard-edge.v1.json").read_text())
    assert doc["params"]["notch"]["taper_mhz"] == 0.0


def test_script_writes_all_presets(tmp_path):
    assert run_demo.main(["--out-dir", str(tmp_path), "--all-presets", "--no-plots"]) == 0
    for name in PRESETS:
        path = tmp_path / f"{name}.v1.json"
        assert path.stat().st_size > 1000
        assert json.loads(path.read_text())["schema"].endswith(".v1")


def test_script_writes_plots(tmp_path):
    import pytest

    pytest.importorskip("matplotlib")
    assert run_demo.main(["--out-dir", str(tmp_path), "--preset", "default"]) == 0
    for name in ("spectrum.png", "compression.png", "sweeps.png"):
        assert (tmp_path / name).stat().st_size > 1000
