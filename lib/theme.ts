"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const KEY = "cpa.theme.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadTheme(): Theme {
  if (!isBrowser()) return "dark";
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    // ignore
  }
  return "dark";
}

export function saveTheme(t: Theme): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, t);
  } catch {
    // ignore
  }
}

export function applyTheme(t: Theme): void {
  if (!isBrowser()) return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(t);
}

export function useTheme(): {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
} {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const t = loadTheme();
    setThemeState(t);
    applyTheme(t);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    saveTheme(t);
  };

  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

  return { theme, setTheme, toggle };
}
