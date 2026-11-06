"use client";

import * as React from "react";
import { scrollAdminToTop } from "@/lib/host";

/**
 * Admin routing inside OpenExt's plugin area (no iframe).
 *
 * OpenExt renders each sidebar item at /dashboard/plugins/runtime/ecommerce-plugin/<navId> and calls our
 * mount() with that navId. Screens inside a section (detail, add, edit…) are the same URL plus ?view=…&id=….
 * Moving within a section is a client-side history change; moving to another section goes through
 * OpenExt's own router so its sidebar and mount context stay in sync.
 */
export const PLUGIN_ID = "ecommerce-plugin";
export const RUNTIME_BASE = `/dashboard/plugins/runtime/${PLUGIN_ID}`;

export function adminUrl(navId: string, view?: string, params?: Record<string, string | undefined>, extraQuery?: string): string {
  const qs = new URLSearchParams();
  if (view) qs.set("view", view);
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== "") qs.set(k, v);
  let query = qs.toString();
  if (extraQuery) query = query ? `${query}&${extraQuery}` : extraQuery;
  return `${RUNTIME_BASE}/${encodeURIComponent(navId)}${query ? `?${query}` : ""}`;
}

const listeners = new Set<() => void>();
/** Bumped on every navigation so the current screen remounts fresh, like a page load used to. */
let navCount = 0;
const emit = () => {
  navCount += 1;
  listeners.forEach((l) => l());
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** Changes on every navigate()/back/forward, but not on list pages' own replaceState filter updates. */
export function useNavigationKey(): number {
  return React.useSyncExternalStore(subscribe, () => navCount, () => 0);
}

/** Query of the current screen (screens remount on navigation, so this is read once per screen). */
export function useSearchParams(): URLSearchParams {
  const key = useNavigationKey();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => new URLSearchParams(window.location.search), [key]);
}

/** Section id (adminNav id) from the current runtime URL. */
export function currentNavId(): string {
  const path = window.location.pathname;
  const rest = path.startsWith(`${RUNTIME_BASE}/`) ? path.slice(RUNTIME_BASE.length + 1) : "";
  return decodeURIComponent(rest.split("/")[0] ?? "");
}

type HostRouter = { push: (href: string) => void; replace: (href: string) => void };
const hostRouter = () => (window as unknown as { next?: { router?: HostRouter } }).next?.router;

const leaveGuards = new Set<() => boolean>();

/**
 * Warns before leaving with unsaved edits: on reload/close (beforeunload) and on our own navigate().
 * isBlocking returns true while leaving should ask first. Returns a cleanup function.
 */
export function addLeaveGuard(isBlocking: () => boolean): () => void {
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (leaveGuards.has(isBlocking) && isBlocking()) e.preventDefault();
  };
  leaveGuards.add(isBlocking);
  window.addEventListener("beforeunload", onBeforeUnload);
  return () => {
    leaveGuards.delete(isBlocking);
    window.removeEventListener("beforeunload", onBeforeUnload);
  };
}

/** Go to another admin screen. Same section → instant; other section → OpenExt switches page and re-mounts us. */
export function navigate(url: string, options: { replace?: boolean } = {}) {
  if ([...leaveGuards].some((blocking) => blocking()) && !window.confirm("Leave this page? Changes you made will not be saved.")) return;
  leaveGuards.clear();
  const target = new URL(url, window.location.href);
  const sameOrigin = target.origin === window.location.origin;
  const next = target.pathname + target.search + target.hash;
  if (sameOrigin && target.pathname === window.location.pathname) {
    // A fresh state object lets OpenExt's Next.js router record the entry, so back/forward stay in sync.
    if (options.replace) window.history.replaceState({}, "", next);
    else window.history.pushState({}, "", next);
    scrollAdminToTop();
    emit();
    return;
  }
  const router = hostRouter();
  if (router && sameOrigin && target.pathname.startsWith(`${RUNTIME_BASE}/`)) {
    if (options.replace) router.replace(next);
    else router.push(next);
    return;
  }
  if (options.replace) window.location.replace(target.href);
  else window.location.assign(target.href);
}

/**
 * Wires the browser into the router for the mounted admin: back/forward re-render, and plain <a> clicks to
 * admin screens go through navigate(). Returns a cleanup function for unmount().
 */
export function startRouter(root: HTMLElement): () => void {
  const onPop = () => emit();
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement | null)?.closest?.("a");
    if (!a || !root.contains(a) || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin || !target.pathname.startsWith(`${RUNTIME_BASE}/`)) return;
    e.preventDefault();
    navigate(target.href);
  };
  window.addEventListener("popstate", onPop);
  root.addEventListener("click", onClick);
  return () => {
    window.removeEventListener("popstate", onPop);
    root.removeEventListener("click", onClick);
  };
}
