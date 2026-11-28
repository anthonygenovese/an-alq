// SPDX-License-Identifier: MIT

/** A usable device pixel ratio. Zero, NaN, and missing values fall back to 1. */
export function safeDevicePixelRatio(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 1;
  return Math.min(2, value);
}

export function canvasPixelSize(
  clientWidth: number,
  clientHeight: number,
  devicePixelRatio: number | undefined,
): { width: number; height: number } | null {
  if (
    !Number.isFinite(clientWidth) ||
    !Number.isFinite(clientHeight) ||
    clientWidth < 2 ||
    clientHeight < 2
  ) {
    return null;
  }
  const dpr = safeDevicePixelRatio(devicePixelRatio);
  return {
    width: Math.max(1, Math.floor(clientWidth * dpr)),
    height: Math.max(1, Math.floor(clientHeight * dpr)),
  };
}

type ResizeTarget = {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

type SizeObserver = {
  observe: (target: unknown) => void;
  disconnect: () => void;
};

type SizeObserverCtor = new (callback: () => void) => SizeObserver;

/**
 * ResizeObserver when the WebView has it. Otherwise window resize, plus
 * visualViewport when that exists. Either path calls onSize.
 */
export function bindCanvasResize(
  canvas: unknown,
  onSize: () => void,
  environment: {
    ResizeObserver?: SizeObserverCtor;
    windowTarget?: ResizeTarget | null;
    visualViewport?: ResizeTarget | null;
  },
): () => void {
  const cleanups: Array<() => void> = [];
  const Observer = environment.ResizeObserver;
  if (typeof Observer === "function") {
    const observer = new Observer(() => onSize());
    observer.observe(canvas);
    cleanups.push(() => observer.disconnect());
  } else if (environment.windowTarget) {
    const onResize = () => onSize();
    environment.windowTarget.addEventListener("resize", onResize);
    cleanups.push(() => environment.windowTarget?.removeEventListener("resize", onResize));
  }
  const viewport = environment.visualViewport;
  if (viewport && typeof viewport.addEventListener === "function") {
    const onResize = () => onSize();
    viewport.addEventListener("resize", onResize);
    cleanups.push(() => viewport.removeEventListener("resize", onResize));
  }
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
