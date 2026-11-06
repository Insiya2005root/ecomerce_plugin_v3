"use client";

/**
 * The element OpenExt gave us in mount(). Our stylesheet is scoped to it, so dialogs, menus and toasts must
 * portal into it (not document.body) to keep their styles and the dark theme.
 */
let scopeRoot: HTMLElement | null = null;
let portalRoot: HTMLElement | null = null;

export function setHostElements(scope: HTMLElement | null, portal: HTMLElement | null) {
  scopeRoot = scope;
  portalRoot = portal;
}

export const getScopeRoot = () => scopeRoot;

/** Container for base-ui portals; undefined falls back to document.body (e.g. outside the mount). */
export const portalContainer = () => portalRoot ?? undefined;

/** The admin scrolls inside OpenExt's #plugin-root, not the window. */
export function scrollAdminToTop() {
  const scroller = scopeRoot?.closest<HTMLElement>("#plugin-root") ?? scopeRoot?.parentElement;
  if (scroller) scroller.scrollTop = 0;
  window.scrollTo(0, 0);
}
