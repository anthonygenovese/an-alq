"use client";

import { useLayoutEffect, useState } from "react";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  type ThemeChoice,
} from "../theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>("dark");

  useLayoutEffect(() => {
    const sync = () => {
      const next = resolveTheme();
      applyTheme(next);
      setTheme(next);
    };
    sync();
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (readStoredTheme()) return;
      sync();
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const light = theme === "light";
  const mode = light ? "Light" : "Dark";
  const action = light ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-pressed={light}
      onClick={() => {
        const next = light ? "dark" : "light";
        persistTheme(next);
        setTheme(next);
      }}
    >
      <svg
        className="theme-sun"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden="true"
        focusable="false"
      >
        <circle className="theme-sun-core" cx="12" cy="12" r="4" />
        <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6" />
        </g>
      </svg>
      <span className="theme-toggle-label">{mode}</span>
      <span className="sr-only">{action}</span>
    </button>
  );
}
