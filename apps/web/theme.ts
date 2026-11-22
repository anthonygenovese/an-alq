const THEME_STORAGE_KEY = "an-alq.theme";

export type ThemeChoice = "light" | "dark";

export function readStoredTheme(): ThemeChoice | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    return null;
  }
  return null;
}

/** Stored choice wins. Otherwise follow the system preference. */
export function resolveTheme(): ThemeChoice {
  const stored = readStoredTheme();
  if (stored) return stored;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: ThemeChoice): void {
  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: ThemeChoice): void {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}

/**
 * Runs before paint. Same rules as resolveTheme: localStorage, then
 * prefers-color-scheme. Does not write a choice the user has not made.
 */
export const themeBootScript = `(() => {
  try {
    const stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    const theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark";
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();`;
