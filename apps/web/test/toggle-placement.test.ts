// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import test from "node:test";
import { chooseTogglePlacement, type TogglePlacementScene } from "../lib/toggle-placement.ts";

function scene(overrides: Partial<TogglePlacementScene> = {}): TogglePlacementScene {
  return {
    viewport: { width: 1280, height: 800 },
    button: { width: 108, height: 44 },
    inset: { top: 0, right: 0, bottom: 0, left: 0 },
    headerBottom: 64,
    current: { x: 1150, y: 76 },
    obstacles: [],
    ...overrides,
  };
}

test("keeps the current spot when it is still clear", () => {
  const current = { x: 1150, y: 200 };
  const placed = chooseTogglePlacement(scene({ current }));
  assert.deepEqual(placed, current);
});

test("moves to the nearest clear edge when the current spot covers text", () => {
  const current = { x: 1150, y: 200 };
  const placed = chooseTogglePlacement(
    scene({
      current,
      obstacles: [{ x: 1140, y: 190, width: 130, height: 70 }],
    }),
  );
  assert.ok(placed);
  assert.notDeepEqual(placed, current);
  assert.ok(placed.y >= 76);
  assert.ok(placed.x + 108 <= 1280 - 22);
});

test("does not cover the header nav", () => {
  const placed = chooseTogglePlacement(
    scene({
      current: { x: 1150, y: 10 },
      headerBottom: 120,
      obstacles: [],
    }),
  );
  assert.ok(placed);
  assert.ok(placed.y >= 132);
});

test("stays inside a 390px viewport", () => {
  const placed = chooseTogglePlacement(
    scene({
      viewport: { width: 390, height: 700 },
      button: { width: 108, height: 44 },
      inset: { top: 8, right: 6, bottom: 12, left: 6 },
      headerBottom: 140,
      current: { x: 300, y: 160 },
      obstacles: [{ x: 250, y: 150, width: 140, height: 80 }],
    }),
  );
  assert.ok(placed);
  assert.ok(placed.x >= 6 + 22);
  assert.ok(placed.x + 108 <= 390 - 6 - 22);
  assert.ok(placed.y >= 140 + 12);
  assert.ok(placed.y + 44 <= 700 - 12 - 22);
});

test("uses the left edge when the right edge is blocked", () => {
  const placed = chooseTogglePlacement(
    scene({
      current: { x: 1150, y: 200 },
      obstacles: [{ x: 1100, y: 0, width: 180, height: 800 }],
    }),
  );
  assert.ok(placed);
  assert.equal(placed.x, 22);
});

test("falls back to the default top-right slot when every edge is blocked", () => {
  const current = { x: 40, y: 400 };
  const fallback = { x: 1150, y: 76 };
  const placed = chooseTogglePlacement(
    scene({
      current,
      fallback,
      obstacles: [{ x: 0, y: 0, width: 1280, height: 800 }],
    }),
  );
  assert.deepEqual(placed, fallback);
});

test("treats a gap smaller than 8px as overlap", () => {
  const current = { x: 400, y: 300 };
  const blocked = chooseTogglePlacement(
    scene({
      current,
      obstacles: [{ x: 508, y: 300, width: 20, height: 44 }],
    }),
  );
  assert.ok(blocked);
  assert.notDeepEqual(blocked, current);

  const clear = chooseTogglePlacement(
    scene({
      current,
      obstacles: [{ x: 516, y: 300, width: 20, height: 44 }],
    }),
  );
  assert.deepEqual(clear, current);
});
