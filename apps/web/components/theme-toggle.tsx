"use client";

import { useLayoutEffect } from "react";
import { applyTheme, persistTheme, readStoredTheme, resolveTheme } from "../theme";

export function ThemeToggle() {
  useLayoutEffect(() => {
    applyTheme(resolveTheme());
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (readStoredTheme()) return;
      applyTheme(resolveTheme());
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => {
        const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
        persistTheme(next);
      }}
    >
      <span className="theme-label theme-label-to-light">
        <span className="sr-only">Switch to </span>
        Light
        <span className="sr-only"> theme</span>
      </span>
      <span className="theme-label theme-label-to-dark">
        <span className="sr-only">Switch to </span>
        Dark
        <span className="sr-only"> theme</span>
      </span>
    </button>
  );
}
