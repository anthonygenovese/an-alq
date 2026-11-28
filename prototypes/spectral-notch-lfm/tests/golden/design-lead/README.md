# Design Lead v1 fixtures

Copies of the seven `fixtures/*.v1.json` payloads from Design Lead's draft UI
spec. They were regenerated from this branch's `run_experiment` at `8bb8443`,
rounding dB arrays from full precision straight to 1 decimal place, and they
set `meta.model_version` to `numpy-proto-1`.

The exporter now defaults to that same model version, so these files must match
our output (and `examples/*.v1.json`) exactly. See `tests/test_contract.py`.
