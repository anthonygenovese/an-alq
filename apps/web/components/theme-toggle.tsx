// SPDX-License-Identifier: MIT
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { measureTogglePlacement } from "./toggle-placement-dom";
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
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const held = useRef({ hover: false, focus: false, press: false });

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    let timer = 0;
    let measuring = false;
    const heldDown = () => held.current.hover || held.current.focus || held.current.press;
    const place = () => {
      if (heldDown() || button.matches(":hover, :focus, :focus-visible, :active")) return;
      measuring = true;
      const shift = measureTogglePlacement(button);
      const raw = getComputedStyle(button).transform;
      const matrix = raw && raw !== "none" ? new DOMMatrix(raw) : new DOMMatrix();
      if (
        shift &&
        (Math.abs(shift.x - matrix.m41) >= 0.5 || Math.abs(shift.y - matrix.m42) >= 0.5)
      ) {
        button.style.transform = `translate3d(${shift.x}px, ${shift.y}px, 0)`;
      }
      window.setTimeout(() => {
        measuring = false;
      }, 0);
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(place, 250);
    };
    const release = () => {
      if (!heldDown()) schedule();
    };
    const frame = window.requestAnimationFrame(place);
    const observer = new ResizeObserver(schedule);
    observer.observe(button);
    observer.observe(document.documentElement);
    const mutations = new MutationObserver(() => {
      if (!measuring) schedule();
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    const narrow = window.matchMedia("(max-width: 860px)");
    narrow.addEventListener("change", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    const onEnter = () => {
      held.current.hover = true;
    };
    const onLeave = () => {
      held.current.hover = false;
      release();
    };
    const onDown = () => {
      held.current.press = true;
    };
    const onUp = () => {
      held.current.press = false;
      release();
    };
    const onFocus = () => {
      held.current.focus = true;
    };
    const onBlur = () => {
      held.current.focus = false;
      release();
    };
    button.addEventListener("pointerenter", onEnter);
    button.addEventListener("pointerleave", onLeave);
    button.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    button.addEventListener("focus", onFocus);
    button.addEventListener("blur", onBlur);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      observer.disconnect();
      mutations.disconnect();
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      narrow.removeEventListener("change", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      button.removeEventListener("pointerenter", onEnter);
      button.removeEventListener("pointerleave", onLeave);
      button.removeEventListener("pointerdown", onDown);
      button.removeEventListener("focus", onFocus);
      button.removeEventListener("blur", onBlur);
    };
  }, [pathname]);

  return (
    <button
      ref={buttonRef}
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
