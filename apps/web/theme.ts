// SPDX-License-Identifier: MIT
const THEME_STORAGE_KEY = "an-alq.theme";

export type ThemeChoice = "light" | "dark";

type ThemeStore = {
  getItem: (key: string) => string | null;
  setItem?: (key: string, value: string) => void;
};

let memoryTheme: ThemeChoice | null = null;

export function themeChoice(value: string | null | undefined): ThemeChoice | null {
  if (value === "light" || value === "dark") return value;
  return null;
}

/** Flip whatever theme is actually applied, not a stale React snapshot. */
export function flippedTheme(current: ThemeChoice): ThemeChoice {
  return current === "light" ? "dark" : "light";
}

export function readThemeFromStores(
  stores: ReadonlyArray<ThemeStore | null | undefined>,
  memory: ThemeChoice | null = memoryTheme,
): ThemeChoice | null {
  for (const store of stores) {
    if (!store) continue;
    try {
      const choice = themeChoice(store.getItem(THEME_STORAGE_KEY));
      if (choice) return choice;
    } catch {
      continue;
    }
  }
  return memory;
}

/** Returns true when a store both accepts the write and reads it back. */
export function writeThemeToStores(
  theme: ThemeChoice,
  stores: ReadonlyArray<ThemeStore | null | undefined>,
): boolean {
  for (const store of stores) {
    if (!store?.setItem) continue;
    try {
      store.setItem(THEME_STORAGE_KEY, theme);
      if (store.getItem(THEME_STORAGE_KEY) === theme) return true;
    } catch {
      continue;
    }
  }
  return false;
}

function browserStore(name: "localStorage" | "sessionStorage"): ThemeStore | null {
  try {
    if (typeof window === "undefined") return null;
    const store = window[name];
    if (!store) return null;
    return store;
  } catch {
    return null;
  }
}

export function readStoredTheme(): ThemeChoice | null {
  return readThemeFromStores([browserStore("localStorage"), browserStore("sessionStorage")]);
}

/** Stored choice wins. Otherwise follow the system preference. */
export function resolveTheme(): ThemeChoice {
  const stored = readStoredTheme();
  if (stored) return stored;
  try {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
  } catch {
    return memoryTheme ?? "dark";
  }
  return memoryTheme ?? "dark";
}

export function applyTheme(theme: ThemeChoice): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: ThemeChoice): void {
  memoryTheme = theme;
  applyTheme(theme);
  writeThemeToStores(theme, [browserStore("localStorage"), browserStore("sessionStorage")]);
}

/**
 * Runs before paint. localStorage, then sessionStorage, then the system
 * preference. Does not write a choice the user has not made. Marks Instagram's
 * in-app browser so layout fallbacks can stay off Safari.
 */
export const themeBootScript = `(() => {
  const key = ${JSON.stringify(THEME_STORAGE_KEY)};
  const read = (store) => {
    try {
      const value = store.getItem(key);
      if (value === "light" || value === "dark") return value;
    } catch {}
    return null;
  };
  try {
    const stored = read(localStorage) || read(sessionStorage);
    const theme =
      stored ||
      (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
  try {
    if (/Instagram/i.test(navigator.userAgent || "")) {
      document.documentElement.dataset.webview = "instagram";
    }
  } catch {}
})();`;
