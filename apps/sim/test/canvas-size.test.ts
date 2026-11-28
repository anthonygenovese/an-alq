// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { bindCanvasResize, canvasPixelSize, safeDevicePixelRatio } from "../src/gl/canvas-size";

describe("canvas pixel size", () => {
  it("falls back when devicePixelRatio is missing or zero", () => {
    expect(safeDevicePixelRatio(undefined)).toBe(1);
    expect(safeDevicePixelRatio(0)).toBe(1);
    expect(safeDevicePixelRatio(Number.NaN)).toBe(1);
    expect(safeDevicePixelRatio(3)).toBe(2);
  });

  it("refuses a zero-size canvas instead of locking in a 1px bitmap", () => {
    expect(canvasPixelSize(0, 0, 2)).toBeNull();
    expect(canvasPixelSize(1, 400, 2)).toBeNull();
  });

  it("sizes a laid-out canvas from the device pixel ratio", () => {
    expect(canvasPixelSize(320, 240, 2)).toEqual({ width: 640, height: 480 });
    expect(canvasPixelSize(320, 240, 0)).toEqual({ width: 320, height: 240 });
  });
});

describe("canvas resize binding", () => {
  it("uses ResizeObserver when the webview provides one", () => {
    let observed = false;
    const stop = bindCanvasResize({}, () => undefined, {
      ResizeObserver: class {
        observe() {
          observed = true;
        }
        disconnect() {
          observed = false;
        }
      },
    });
    expect(observed).toBe(true);
    stop();
    expect(observed).toBe(false);
  });

  it("listens for window resize when ResizeObserver is missing", () => {
    const listeners = new Map<string, () => void>();
    const target = {
      addEventListener: (type: string, listener: () => void) => {
        listeners.set(type, listener);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      },
    };
    const stop = bindCanvasResize({}, () => undefined, {
      windowTarget: target,
      visualViewport: target,
    });
    expect(listeners.has("resize")).toBe(true);
    stop();
    expect(listeners.size).toBe(0);
  });
});
