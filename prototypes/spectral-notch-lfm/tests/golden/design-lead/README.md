# Design Lead v1 fixtures

Copies of the seven `fixtures/*.v1.json` payloads from Design Lead's draft UI
spec (`/workspace/an-alq-spec` on 28 Nov 2026). They were built by
`scripts/build_v1_fixture.py`, which rounded spectrum and compressed arrays to
2 decimal places (the v0 exporter) and then to 1 decimal place (the v1 rule).

Our exporter rounds those arrays from full precision to 1 decimal place, which
is the v1 contract. A few bins therefore differ by 0.1 dB. Metrics, axes, zoom,
sweeps, and metadata match exactly. See `tests/test_contract.py`.
