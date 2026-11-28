// SPDX-License-Identifier: MIT
import { isInstagramWebView } from "../lib/webview";
import {
  chooseTogglePlacement,
  resolvePlacementViewport,
  toggleCandidates,
  type Box,
  type Point,
  type TogglePlacementScene,
} from "../lib/toggle-placement";

const CONTROL_SELECTOR =
  "a, button, input, textarea, select, canvas, svg, nav, header, summary, label";

let insetProbe: HTMLDivElement | null = null;

function insetProbeElement(): HTMLDivElement {
  if (insetProbe?.isConnected) return insetProbe;
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.width = "0";
  probe.style.height = "0";
  probe.style.paddingTop = "env(safe-area-inset-top, 0px)";
  probe.style.paddingRight = "env(safe-area-inset-right, 0px)";
  probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
  probe.style.paddingLeft = "env(safe-area-inset-left, 0px)";
  document.body.append(probe);
  insetProbe = probe;
  return probe;
}

function readInset(style: CSSStyleDeclaration, edge: "top" | "right" | "bottom" | "left"): number {
  const value = Number.parseFloat(style.getPropertyValue(`padding-${edge}`));
  return Number.isFinite(value) ? value : 0;
}

export function readSafeInsets(): TogglePlacementScene["inset"] {
  const style = getComputedStyle(insetProbeElement());
  return {
    top: readInset(style, "top"),
    right: readInset(style, "right"),
    bottom: readInset(style, "bottom"),
    left: readInset(style, "left"),
  };
}

function textBoxes(ignore: HTMLElement): Box[] {
  const boxes: Box[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    const text = node.textContent ?? "";
    if (text.trim() && parent && !ignore.contains(parent) && !parent.closest("script, style")) {
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width > 0 && rect.height > 0) {
          boxes.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
        }
      }
    }
    node = walker.nextNode();
  }
  return boxes;
}

function controlBoxes(ignore: HTMLElement): Box[] {
  const boxes: Box[] = [];
  for (const node of document.querySelectorAll(CONTROL_SELECTOR)) {
    if (!(node instanceof Element) || node === ignore || ignore.contains(node)) continue;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    boxes.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  }
  return boxes;
}

function hitsAt(samples: readonly Point[], ignore: HTMLElement): Box[] {
  const boxes: Box[] = [];
  for (const sample of samples) {
    const hits = document.elementsFromPoint(sample.x, sample.y);
    for (const hit of hits) {
      if (hit === document.body || hit === document.documentElement) continue;
      if (hit === ignore || ignore.contains(hit)) continue;
      const control = hit.closest(CONTROL_SELECTOR);
      if (!control || control === ignore || ignore.contains(control)) continue;
      const rect = control.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      boxes.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }
  }
  return boxes;
}

export function measureTogglePlacement(button: HTMLElement): Point | null {
  const visual = button.getBoundingClientRect();
  const raw = getComputedStyle(button).transform;
  const matrix = raw && raw !== "none" ? new DOMMatrix(raw) : new DOMMatrix();
  const base = {
    x: visual.x - matrix.m41,
    y: visual.y - matrix.m42,
    width: visual.width,
    height: visual.height,
  };

  const header = document.querySelector("header.nav");
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const layout = {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  };
  const instagram =
    typeof navigator !== "undefined" && isInstagramWebView(navigator.userAgent || "");
  const visible = instagram ? window.visualViewport : null;
  const scene: TogglePlacementScene = {
    viewport: resolvePlacementViewport(
      layout,
      visible ? { width: visible.width, height: visible.height } : null,
    ),
    button: { width: base.width, height: base.height },
    inset: readSafeInsets(),
    headerBottom,
    current: { x: visual.x, y: visual.y },
    fallback: { x: base.x, y: base.y },
    obstacles: [],
  };
  const samples = toggleCandidates(scene).map((point) => ({
    x: point.x + base.width / 2,
    y: point.y + base.height / 2,
  }));
  scene.obstacles = [...textBoxes(button), ...controlBoxes(button), ...hitsAt(samples, button)];
  const next = chooseTogglePlacement(scene);
  if (!next) return null;
  return { x: next.x - base.x, y: next.y - base.y };
}
