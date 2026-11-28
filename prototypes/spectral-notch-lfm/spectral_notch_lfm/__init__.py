# SPDX-License-Identifier: MIT
"""Spectral-notching LFM teaching prototype (NumPy).

Synthetic, normalized, illustrative signal processing only. Nothing here
receives, records, transmits, jams, spoofs, or locates anything.
"""

from .core import (
    ILLUSTRATIVE_LABEL,
    LEVEL_FLOOR_DB,
    MODE_KEY,
    MODEL_VERSION,
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

__all__ = [
    "ILLUSTRATIVE_LABEL",
    "LEVEL_FLOOR_DB",
    "MODE_KEY",
    "MODEL_VERSION",
    "PRESETS",
    "SCHEMA",
    "SCHEMA_VERSION",
    "NotchSpec",
    "WaveformSpec",
    "apply_notch",
    "compression_metrics",
    "lfm_chirp",
    "matched_filter",
    "measure_notch",
    "notch_mask",
    "run_experiment",
]
