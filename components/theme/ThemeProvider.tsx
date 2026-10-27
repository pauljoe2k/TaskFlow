"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "taskflow-theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

/* External store: localStorage + system color scheme.
 * useSyncExternalStore keeps React in sync without effects that set state,
 * and getServerSnapshot keeps SSR output stable (no hydration mismatch). */

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function storedTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null; // storage blocked: fall back to the system setting
  }
}

function systemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function getSnapshot(): Theme {
  return storedTheme() ?? systemTheme();
}

function getServerSnapshot(): Theme {
  return "light";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const media = window.matchMedia(MEDIA_QUERY);
  const onMediaChange = () => listener();
  media.addEventListener("change", onMediaChange);
  window.addEventListener("storage", listener); // changes from other tabs
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onMediaChange);
    window.removeEventListener("storage", listener);
  };
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function writeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage blocked: the theme still applies for this session.
  }
  applyTheme(theme);
  emit();
}

function toggleTheme(): void {
  writeTheme(getSnapshot() === "dark" ? "light" : "dark");
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

/**
 * Dark/light theme that follows the system setting until the user chooses
 * explicitly, then persists that choice. The inline script in the root
 * layout applies the class before paint; this provider keeps React in sync.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Keep the DOM attribute in sync with the store (the pre-paint script has
  // already applied it once; this catches system and cross-tab changes).
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
