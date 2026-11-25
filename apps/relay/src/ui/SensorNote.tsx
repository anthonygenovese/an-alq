// SPDX-License-Identifier: MIT
import { SENSOR_TOO_LATE } from "../copy.js";

/** Shown when the alert is older than the five newest Nixle messages. */
export function SensorNote({ late }: { late: boolean }) {
  if (!late) return null;
  return (
    <p className="sensor-late" role="status">
      {SENSOR_TOO_LATE}
    </p>
  );
}
