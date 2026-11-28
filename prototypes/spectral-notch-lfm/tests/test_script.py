# SPDX-License-Identifier: MIT
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import run_demo  # noqa: E402


def test_script_writes_labelled_json(tmp_path, capsys):
    rc = run_demo.main(["--out-dir", str(tmp_path), "--no-plots", "--no-sweeps", "--depth", "20"])
    assert rc == 0
    doc = json.loads((tmp_path / "spectral-notch-lfm.json").read_text())
    assert doc["params"]["notch"]["depth_db"] == 20.0
    assert doc["illustrative"] is True
    assert "Illustrative" in capsys.readouterr().out


def test_script_writes_plots(tmp_path):
    import pytest

    pytest.importorskip("matplotlib")
    assert run_demo.main(["--out-dir", str(tmp_path)]) == 0
    for name in ("spectrum.png", "compression.png", "sweeps.png"):
        assert (tmp_path / name).stat().st_size > 1000
