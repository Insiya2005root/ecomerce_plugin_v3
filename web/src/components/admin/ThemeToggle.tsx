"use client";

import * as React from "react";
import { getScopeRoot } from "@/lib/host";

/**
 * Light/dark for the admin follows OpenExt's own switch (the `dark` class OpenExt puts on <html>), so one
 * switch controls OpenExt, this admin and the storefront. The class goes on our mount root, because our
 * stylesheet is scoped to it.
 */
const LEGACY_OVERRIDE_KEY = "ecommerce-theme";
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const hostIsDark = () => document.documentElement.classList.contains("dark");

function applyTheme() {
  getScopeRoot()?.classList.toggle("dark", hostIsDark());
  listeners.forEach((l) => l());
}

/** Applies the theme to the mount root and keeps it in step with OpenExt. Returns a cleanup function. */
export function startTheme(): () => void {
  try {
    // Older versions let the admin override OpenExt's theme; drop that so the two always match.
    localStorage.removeItem(LEGACY_OVERRIDE_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
  applyTheme();
  const observer = new MutationObserver(applyTheme);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** Whether the admin is currently dark. */
export function useDarkMode() {
  return React.useSyncExternalStore(subscribe, () => getScopeRoot()?.classList.contains("dark") ?? false, () => false);
}
