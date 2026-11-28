// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  areaPath,
  axisValues,
  cropIndices,
  nearestIndex,
  polylinePath,
  ticks,
  toX,
  toY,
} from "../lib/spectral-notch/chart.ts";
import {
  deltaChip,
  formatDb,
  formatDbMagnitude,
  formatNumber,
  formatRatio,
  formatUs,
  notchDepthMagnitude,
  sweepAxisTitle,
} from "../lib/spectral-notch/format.ts";
import { parseNotchPayload } from "../lib/spectral-notch/schema.ts";

const here = dirname(fileURLToPath(import.meta.url));
const presetDir = join(here, "..", "lib", "spectral-notch", "presets");
const protoExamples = join(here, "..", "..", "..", "prototypes", "spectral-notch-lfm", "examples");
const PRESET_IDS = [
  "default",
  "no-notch",
  "narrow-deep",
  "wide-shallow",
  "hard-edge",
  "soft-edge",
  "hann-window",
];

function load(id: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(presetDir, `${id}.v1.json`), "utf8")) as Record<
    string,
    unknown
  >;
}

test("the seven presets are present and parse with the contract schema", () => {
  assert.deepEqual(
    readdirSync(presetDir)
      .filter((name) => name.endsWith(".v1.json"))
      .sort(),
    PRESET_IDS.map((id) => `${id}.v1.json`).sort(),
  );
  for (const id of PRESET_IDS) {
    const result = parseNotchPayload(load(id));
    assert.equal(result.status, "ok", id);
    if (result.status === "ok") {
      assert.equal(result.doc.schema, "an-alq.spectral-notch-lfm.v1");
      assert.equal(result.doc.meta.model_version, "numpy-proto-1");
    }
  }
});

test("web presets are byte copies of the prototype examples", () => {
  for (const id of PRESET_IDS) {
    const a = readFileSync(join(presetDir, `${id}.v1.json`));
    const b = readFileSync(join(protoExamples, `${id}.v1.json`));
    assert.ok(a.equals(b), `${id} differs from prototypes/spectral-notch-lfm/examples`);
  }
});

test("refuses a payload that is not marked illustrative, or is marked operational", () => {
  const notIllustrative = { ...load("default"), illustrative: false };
  const missing = { ...load("default") };
  delete missing.illustrative;
  const operational = { ...load("default"), operational: true };
  const noOperational = { ...load("default") };
  delete noOperational.operational;
  assert.equal(parseNotchPayload(notIllustrative).status, "refused");
  assert.equal(parseNotchPayload(missing).status, "refused");
  assert.equal(parseNotchPayload(operational).status, "refused");
  assert.equal(parseNotchPayload(noOperational).status, "refused");
});

test("rejects other schema ids, majors, bad shapes, and the v0 file as unsupported", () => {
  const base = load("default");
  assert.equal(
    parseNotchPayload({ ...base, schema: "an-alq.spectral-notch-lfm.v2" }).status,
    "unsupported",
  );
  assert.equal(parseNotchPayload({ ...base, schema_version: "2.0.0" }).status, "unsupported");
  assert.equal(parseNotchPayload(null).status, "unsupported");
  assert.equal(parseNotchPayload("x").status, "unsupported");
  const short = structuredClone(base) as { spectrum: { original_db: number[] } };
  short.spectrum.original_db.pop();
  assert.equal(parseNotchPayload(short).status, "unsupported");
  const low = structuredClone(base) as { compressed: { baseline_db: number[] } };
  low.compressed.baseline_db[0] = -240;
  assert.equal(parseNotchPayload(low).status, "unsupported");
  const v0 = {
    schema: "an-alq.spectral-notch-lfm.v0-provisional",
    illustrative: true,
    operational: false,
  };
  assert.equal(parseNotchPayload(v0).status, "unsupported");
});

test("tolerates an unknown additive key (consumer schema strips it)", () => {
  const result = parseNotchPayload({ ...load("default"), envelope: { note: "future minor" } });
  assert.equal(result.status, "ok");
  if (result.status === "ok") assert.equal("envelope" in result.doc, false);
});

test("the no-notch preset has a slightly positive inband_depth_db that the display clamps to 0.0", () => {
  const result = parseNotchPayload(load("no-notch"));
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.doc.params.notch.depth_db, 0);
  assert.ok(result.doc.metrics.notch.inband_depth_db > 0);
  assert.equal(notchDepthMagnitude(result.doc.metrics.notch.inband_depth_db), 0);
  assert.equal(formatDbMagnitude(result.doc.metrics.notch.inband_depth_db), "0.0 dB");
  assert.equal(formatDbMagnitude(-29.922), "29.9 dB");
});

test("format helpers", () => {
  assert.equal(formatDb(-11.047), "\u221211.0 dB");
  assert.equal(formatDb(-0.04), "0.0 dB");
  assert.equal(formatNumber(-0, 1), "0.0");
  assert.equal(formatNumber(2.44, 1, true), "+2.4");
  assert.equal(formatNumber(Number.NaN, 1), "\u2014");
  assert.equal(formatUs(0.0217), "0.0217 \u00b5s");
  assert.equal(formatUs(null), "\u2014");
  assert.equal(formatRatio(0.0209, 0.0217), "\u00d70.96");
  assert.equal(formatRatio(1, 0), "\u2014");
});

test("delta chips follow the 0.05 dB rule and direction", () => {
  const worse = deltaChip(-11.047, -13.466, true);
  assert.equal(worse.tone, "worse");
  assert.equal(worse.arrow, "\u25b2");
  assert.equal(worse.text, "+2.4");
  const better = deltaChip(-14, -13.466, true);
  assert.equal(better.tone, "better");
  assert.equal(better.arrow, "\u25bc");
  assert.equal(deltaChip(-13.48, -13.466, true).tone, "neutral");
  assert.equal(deltaChip(-1.366, 0, false).tone, "worse");
  assert.equal(deltaChip(-0.0, 0, false).text, "0.0");
});

const BOX = { x: 0, y: 0, w: 100, h: 50 };

test("scales map the domain to the box, y downward", () => {
  assert.equal(toX(0, [-10, 10], BOX), 50);
  assert.equal(toY(0, [-100, 0], BOX), 0);
  assert.equal(toY(-100, [-100, 0], BOX), 50);
});

test("polylinePath clips to the y domain, skips outside x, and breaks on non-finite values", () => {
  const d = polylinePath([0, 1, 2, 3], [0, -500, 0, Number.NaN], [0, 3], [-100, 0], BOX);
  assert.equal(d, "M0 0L33.3 50L66.7 0");
  assert.equal(polylinePath([5, 6], [0, 0], [0, 3], [-100, 0], BOX), "");
  assert.ok(areaPath([0, 1], [-10, -10], 0, [0, 1], [-100, 0], BOX).endsWith("Z"));
});

test("axis helpers", () => {
  assert.deepEqual(axisValues({ start: -1, step: 0.5, count: 5 }), [-1, -0.5, 0, 0.5, 1]);
  assert.deepEqual(ticks(-40, 40, 20), [-40, -20, 0, 20, 40]);
  assert.equal(nearestIndex([0, 1, 2, 3], 1.6), 2);
  assert.equal(nearestIndex([0, 1, 2, 3], -5), 0);
  assert.deepEqual(cropIndices([-3, -0.5, 0, 0.5, 3], 0.5), [1, 3]);
});

test("the default payload axes line up with the spec's point counts", () => {
  const result = parseNotchPayload(load("default"));
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  const f = axisValues(result.doc.axes.frequency_mhz);
  const d = axisValues(result.doc.axes.delay_us);
  assert.equal(f.length, 201);
  assert.ok(Math.abs((f[0] ?? 0) + 40) < 1e-9 && Math.abs((f.at(-1) ?? 0) - 40) < 1e-9);
  assert.equal(d.length, 961);
  assert.ok(Math.abs((d[0] ?? 0) + 3) < 1e-9);
  assert.equal(result.doc.compressed_zoom?.delay_us.count, 321);
});

test("sweep y-axis titles use the contract unit and follow the metric toggle", () => {
  assert.equal(sweepAxisTitle("psl_db"), "PSL (dB)");
  assert.equal(sweepAxisTitle("islr_db"), "ISLR (dB)");
  assert.equal(sweepAxisTitle("peak_loss_db"), "Peak loss (dB)");
  assert.equal(sweepAxisTitle("mainlobe_width_3db_us"), "Width (\u00b5s)");
});
