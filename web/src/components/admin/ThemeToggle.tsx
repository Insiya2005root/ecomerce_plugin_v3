"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";

const THEME_KEY = "ecommerce-theme";
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const isDark = () => document.documentElement.classList.contains("dark");

function setDarkMode(next: boolean) {
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
  listeners.forEach((l) => l());
}

/** Current mode and a setter; the choice is saved in this browser. */
export function useDarkMode() {
  const dark = React.useSyncExternalStore(subscribe, isDark, () => false);
  return [dark, setDarkMode] as const;
}

/** Small light/dark switch. The initial class is set by an inline script in the layout to avoid a flash. */
export function ThemeToggle() {
  const [dark] = useDarkMode();
  const toggle = () => setDarkMode(!isDark());
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="fixed bottom-3 left-3 z-30 flex size-8 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
    >
      <HugeiconsIcon icon={dark ? Sun03Icon : Moon02Icon} strokeWidth={2} className="size-4" />
    </button>
  );
}
