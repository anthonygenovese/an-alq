# SPDX-License-Identifier: MIT
"""Validate v1 documents against the strict producer schema and Design Lead's fixtures."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from spectral_notch_lfm import MODEL_VERSION, PRESETS, run_experiment  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contract"
CONSUMER_SCHEMA_PATH = CONTRACT / "spectral-notch-lfm.schema.json"
STRICT_SCHEMA_PATH = CONTRACT / "spectral-notch-lfm.strict.schema.json"
GOLDEN = Path(__file__).resolve().parent / "golden" / "design-lead"
EXAMPLES = ROOT / "examples"
PAYLOAD_CAP = 64 * 1024
PAYLOAD_TARGET = 40 * 1024


def minify(doc: dict) -> str:
    return json.dumps(doc, separators=(",", ":"), allow_nan=False)


def _validator(path: Path):
    jsonschema = pytest.importorskip("jsonschema")
    return jsonschema.Draft202012Validator(json.loads(path.read_text()))


@pytest.fixture(scope="module")
def strict():
    return _validator(STRICT_SCHEMA_PATH)


@pytest.fixture(scope="module")
def consumer():
    return _validator(CONSUMER_SCHEMA_PATH)


def _assert_valid(validator, doc):
    errors = sorted(validator.iter_errors(doc), key=lambda e: list(e.path))
    assert errors == [], "; ".join(f"{list(e.path)}: {e.message}" for e in errors)


def _assert_lengths(doc: dict):
    f = doc["axes"]["frequency_mhz"]["count"]
    d = doc["axes"]["delay_us"]["count"]
    for key in ("original_db", "notched_db", "mask_db"):
        assert len(doc["spectrum"][key]) == f
    for key in ("baseline_db", "replica_original_db", "replica_notched_db"):
        assert len(doc["compressed"][key]) == d
    if "compressed_zoom" in doc:
        z = doc["compressed_zoom"]["delay_us"]["count"]
        for key in ("baseline_db", "replica_original_db", "replica_notched_db"):
            assert len(doc["compressed_zoom"][key]) == z


@pytest.mark.parametrize("name", list(PRESETS))
def test_each_preset_matches_the_strict_schema(name, strict, consumer):
    wave, notch = PRESETS[name]
    doc = run_experiment(wave, notch)
    _assert_valid(strict, doc)
    _assert_valid(consumer, doc)
    _assert_lengths(doc)


@pytest.mark.parametrize("name", list(PRESETS))
def test_payload_is_under_the_budget(name):
    wave, notch = PRESETS[name]
    n = len(minify(run_experiment(wave, notch)))
    assert n <= PAYLOAD_CAP
    assert n <= PAYLOAD_TARGET


@pytest.mark.parametrize("name", list(PRESETS))
def test_output_matches_design_lead_fixtures_exactly(name):
    wave, notch = PRESETS[name]
    ours = run_experiment(wave, notch)
    raw = (GOLDEN / f"{name}.v1.json").read_text()
    theirs = json.loads(raw)
    assert ours["meta"]["model_version"] == MODEL_VERSION == "numpy-proto-1"
    assert ours == theirs
    assert minify(ours) == raw


@pytest.mark.parametrize("name", list(PRESETS))
def test_committed_examples_match_fixtures_byte_for_byte(name):
    example = (EXAMPLES / f"{name}.v1.json").read_bytes()
    golden = (GOLDEN / f"{name}.v1.json").read_bytes()
    assert example == golden


def test_unknown_key_fails_the_strict_schema_and_passes_the_consumer(strict, consumer):
    doc = run_experiment(sweeps=False, compressed_zoom=False)
    _assert_valid(strict, doc)
    _assert_valid(consumer, doc)
    typo = dict(doc)
    typo["unpublished_field"] = True
    assert consumer.is_valid(typo)
    errors = list(strict.iter_errors(typo))
    assert errors, "strict schema should reject an unpublished key"
    assert any("unpublished_field" in list(e.path) or "additional" in e.message.lower() for e in errors)


def test_v0_document_is_rejected_by_both_schemas(strict, consumer):
    v0 = {
        "schema": "an-alq.spectral-notch-lfm.v0-provisional",
        "status": "provisional",
        "illustrative": True,
    }
    assert not strict.is_valid(v0)
    assert not consumer.is_valid(v0)
