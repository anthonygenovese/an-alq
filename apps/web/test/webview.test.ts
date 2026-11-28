// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import test from "node:test";
import { resolvePlacementViewport } from "../lib/toggle-placement.ts";
import { isInstagramWebView } from "../lib/webview.ts";

const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0.0";

test("treats Instagram's in-app browser as a webview and Safari as the browser", () => {
  assert.equal(isInstagramWebView(INSTAGRAM), true);
  assert.equal(isInstagramWebView(SAFARI), false);
  assert.equal(isInstagramWebView("Mozilla/5.0 (Macintosh) Safari/605.1.15"), false);
});

test("keeps the layout viewport when the visual viewport matches", () => {
  const layout = { width: 390, height: 844 };
  assert.deepEqual(resolvePlacementViewport(layout, null), layout);
  assert.deepEqual(resolvePlacementViewport(layout, { width: 390, height: 844 }), layout);
  assert.deepEqual(resolvePlacementViewport(layout, { width: 0, height: 700 }), layout);
});

test("shrinks placement to the visible viewport when a toolbar covers it", () => {
  const placed = resolvePlacementViewport({ width: 390, height: 844 }, { width: 390, height: 620 });
  assert.deepEqual(placed, { width: 390, height: 620 });
});
