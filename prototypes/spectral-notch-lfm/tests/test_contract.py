# SPDX-License-Identifier: MIT
"""Validate v1 documents against the JSON Schema and Design Lead's fixtures."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from spectral_notch_lfm import PRESETS, run_experiment  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "contract" / "spectral-notch-lfm.schema.json"
GOLDEN = Path(__file__).resolve().parent / "golden" / "design-lead"
PAYLOAD_CAP = 64 * 1024
PAYLOAD_TARGET = 40 * 1024
# Arrays that Design Lead's builder rounded twice (2 dp then 1 dp).
ARRAY_BLOCKS = {
    "spectrum": ("original_db", "notched_db", "mask_db"),
    "compressed": ("baseline_db", "replica_original_db", "replica_notched_db"),
}


def minify(doc: dict) -> str:
    return json.dumps(doc, separators=(",", ":"), allow_nan=False)


@pytest.fixture(scope="module")
def schema():
    return json.loads(SCHEMA_PATH.read_text())


@pytest.fixture(scope="module")
def validator(schema):
    jsonschema = pytest.importorskip("jsonschema")
    return jsonschema.Draft202012Validator(schema)


@pytest.mark.parametrize("name", list(PRESETS))
def test_each_preset_matches_the_schema(name, validator):
    wave, notch = PRESETS[name]
    doc = run_experiment(wave, notch)
    errors = sorted(validator.iter_errors(doc), key=lambda e: list(e.path))
    assert errors == [], "; ".join(f"{list(e.path)}: {e.message}" for e in errors)


@pytest.mark.parametrize("name", list(PRESETS))
def test_payload_is_under_the_budget(name):
    wave, notch = PRESETS[name]
    n = len(minify(run_experiment(wave, notch)))
    assert n <= PAYLOAD_CAP
    assert n <= PAYLOAD_TARGET


def _walk_exact(ours, theirs, path, ignore_arrays=True):
    diffs = []
    if isinstance(ours, dict):
        if ours.keys() != theirs.keys():
            diffs.append(f"{path}: keys {list(ours.keys())} vs {list(theirs.keys())}")
        for key in ours.keys() | theirs.keys():
            if key not in ours or key not in theirs:
                diffs.append(f"{path}.{key}: missing on one side")
                continue
            skip = ignore_arrays and any(path.endswith(f".{block}") and key in keys for block, keys in ARRAY_BLOCKS.items())
            if skip:
                continue
            diffs.extend(_walk_exact(ours[key], theirs[key], f"{path}.{key}", ignore_arrays))
        return diffs
    if isinstance(ours, list):
        if len(ours) != len(theirs):
            return [f"{path}: length {len(ours)} vs {len(theirs)}"]
        for i, (a, b) in enumerate(zip(ours, theirs)):
            diffs.extend(_walk_exact(a, b, f"{path}[{i}]", ignore_arrays))
        return diffs
    if ours != theirs:
        diffs.append(f"{path}: {ours!r} vs {theirs!r}")
    return diffs


@pytest.mark.parametrize("name", list(PRESETS))
def test_matches_design_lead_fixtures_except_known_array_rounding(name):
    """Metrics, axes, zoom, sweeps, and metadata must match the fixtures exactly.

    Spectrum and compressed arrays may differ by at most 0.1 dB: the fixtures
    inherited a 2-dp-then-1-dp rounding from the v0 exporter, while we round
    full-precision values to 1 dp, which is what the v1 contract asks for.
    """
    wave, notch = PRESETS[name]
    ours = run_experiment(wave, notch)
    theirs = json.loads((GOLDEN / f"{name}.v1.json").read_text())
    diffs = _walk_exact(ours, theirs, "$")
    assert diffs == [], "unexpected non-array diffs:\n" + "\n".join(diffs[:20])
    off = []
    for block, keys in ARRAY_BLOCKS.items():
        for key in keys:
            for i, (a, b) in enumerate(zip(ours[block][key], theirs[block][key], strict=True)):
                if a != b:
                    if abs(a - b) > 0.1000001:
                        off.append(f"{block}.{key}[{i}]: {a} vs {b}")
    assert off == [], "array diffs larger than 0.1 dB:\n" + "\n".join(off[:20])


def test_v0_document_is_rejected_by_the_schema(validator):
    v0 = {
        "schema": "an-alq.spectral-notch-lfm.v0-provisional",
        "status": "provisional",
        "illustrative": True,
    }
    assert not validator.is_valid(v0)
