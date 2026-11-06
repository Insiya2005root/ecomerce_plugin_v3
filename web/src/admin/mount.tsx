/**
 * OpenExt Mount API entry (manifest.adminMount = ui/admin/mount.js).
 *
 * OpenExt imports this module and calls mount(el, ctx) with the sidebar item's id in ctx.pageId. Each
 * sidebar item is a section; ?view=… picks the screen inside it (detail, add, edit…). Screens are the same
 * page components the old iframe build exported, loaded on demand.
 */
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { getScopeRoot, setHostElements } from "@/lib/host";
import { startRouter, useNavigationKey, currentNavId } from "@/lib/router";
import { startTheme } from "@/components/admin/ThemeToggle";

type Screen = React.LazyExoticComponent<React.ComponentType>;
type Section = { main: Screen; views?: Record<string, Screen> };

const screen = (load: () => Promise<{ default: React.ComponentType }>): Screen => React.lazy(load);

const SECTIONS: Record<string, Section> = {
  "ecommerce-dashboard": { main: screen(() => import("@/app/page")) },
  "ecommerce-products": {
    main: screen(() => import("@/app/products/page")),
    views: {
      add: screen(() => import("@/app/products/add/page")),
      detail: screen(() => import("@/app/products/detail/page")),
      edit: screen(() => import("@/app/products/edit/page")),
    },
  },
  "ecommerce-collections": {
    main: screen(() => import("@/app/collections/page")),
    views: { detail: screen(() => import("@/app/collections/detail/page")) },
  },
  "ecommerce-categories": {
    main: screen(() => import("@/app/categories/page")),
    views: {
      detail: screen(() => import("@/app/categories/detail/page")),
      add: screen(() => import("@/app/categories/add/page")),
      edit: screen(() => import("@/app/categories/edit/page")),
    },
  },
  "ecommerce-inventory": {
    main: screen(() => import("@/app/inventory/page")),
    views: {
      detail: screen(() => import("@/app/inventory/detail/page")),
      stock: screen(() => import("@/app/inventory/stock/page")),
    },
  },
  "ecommerce-inventory-reservations": { main: screen(() => import("@/app/inventory/reservations/page")) },
  "ecommerce-orders": {
    main: screen(() => import("@/app/orders/page")),
    views: { detail: screen(() => import("@/app/orders/detail/page")) },
  },
  "ecommerce-cart": { main: screen(() => import("@/app/cart/page")) },
  "ecommerce-customers": {
    main: screen(() => import("@/app/customers/page")),
    views: { detail: screen(() => import("@/app/customers/detail/page")) },
  },
  "ecommerce-discounts": {
    main: screen(() => import("@/app/discounts/page")),
    views: { detail: screen(() => import("@/app/discounts/detail/page")) },
  },
  "ecommerce-discounts-automatic": {
    main: screen(() => import("@/app/discounts/all/page")),
    views: { add: screen(() => import("@/app/discounts/all/add/page")), edit: screen(() => import("@/app/discounts/all/edit/page")) },
  },
  "ecommerce-discounts-coupons": {
    main: screen(() => import("@/app/discounts/coupons/page")),
    views: { add: screen(() => import("@/app/discounts/coupons/add/page")), edit: screen(() => import("@/app/discounts/coupons/edit/page")) },
  },
  "ecommerce-discounts-campaigns": {
    main: screen(() => import("@/app/discounts/campaigns/page")),
    views: { add: screen(() => import("@/app/discounts/campaigns/add/page")), edit: screen(() => import("@/app/discounts/campaigns/edit/page")) },
  },
  "ecommerce-discounts-custom": {
    main: screen(() => import("@/app/discounts/custom/page")),
    views: { add: screen(() => import("@/app/discounts/custom/add/page")), edit: screen(() => import("@/app/discounts/custom/edit/page")) },
  },
  "ecommerce-settings": { main: screen(() => import("@/app/settings/page")) },
  "ecommerce-settings-general": { main: screen(() => import("@/app/settings/general/page")) },
  "ecommerce-settings-profile": { main: screen(() => import("@/app/settings/profile/page")) },
  "ecommerce-settings-tax": {
    main: screen(() => import("@/app/settings/tax/page")),
    views: { detail: screen(() => import("@/app/settings/tax/detail/page")) },
  },
  "ecommerce-settings-shipping": { main: screen(() => import("@/app/settings/shipping/page")) },
  "ecommerce-settings-locations": {
    main: screen(() => import("@/app/settings/locations/page")),
    views: { detail: screen(() => import("@/app/settings/locations/detail/page")) },
  },
};

const DEFAULT_SECTION = "ecommerce-dashboard";

function pickScreen(pageId: string | undefined): Screen {
  // The URL wins over ctx.pageId so back/forward inside OpenExt always shows the matching section.
  const section = SECTIONS[currentNavId()] ?? SECTIONS[pageId ?? ""] ?? SECTIONS[DEFAULT_SECTION];
  const view = new URLSearchParams(window.location.search).get("view") ?? "";
  return section.views?.[view] ?? section.main;
}

function AdminApp({ pageId }: { pageId?: string }) {
  const navKey = useNavigationKey();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const Current = React.useMemo(() => pickScreen(pageId), [navKey, pageId]);
  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
      <main>
        <React.Suspense fallback={null}>
          {/* Keyed by navigation so each screen starts fresh, as with the old page loads. */}
          <Current key={navKey} />
        </React.Suspense>
      </main>
    </div>
  );
}

type MountContext = { pluginId: string; pageId?: string; assetBase?: string };

const FONT_LINK_ID = "ecommerce-admin-fonts";
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&family=Lora:ital,wght@0,400..700;1,400..700&display=swap";

type Instance = { root: Root; cleanups: Array<() => void>; disposed: boolean };
let active: Instance | null = null;

function moduleBase(ctx: MountContext): string {
  // Stylesheet sits next to this module; fall back to OpenExt's assetBase layout.
  try {
    return new URL(".", import.meta.url).href;
  } catch {
    return `${ctx.assetBase ?? `/plugins/${ctx.pluginId}/`}ui/admin/`;
  }
}

export function mount(el: HTMLElement, ctx: MountContext) {
  unmount();
  const cleanups: Array<() => void> = [];

  // OpenExt pads and whitens #plugin-root; our own layout supplies both (and the dark background).
  const prevStyle = el.getAttribute("style");
  el.style.padding = "0";
  el.style.background = "transparent";
  // Forms keep a sticky save bar at the bottom; keep focused/scrolled-to fields clear of it.
  el.style.scrollPaddingBottom = "72px";
  cleanups.push(() => (prevStyle === null ? el.removeAttribute("style") : el.setAttribute("style", prevStyle)));

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = `${moduleBase(ctx)}admin.css`;
  stylesheet.setAttribute("data-ecommerce-admin", "");
  document.head.appendChild(stylesheet);
  cleanups.push(() => stylesheet.remove());

  if (!document.getElementById(FONT_LINK_ID)) {
    const fonts = document.createElement("link");
    fonts.id = FONT_LINK_ID;
    fonts.rel = "stylesheet";
    fonts.href = FONT_HREF;
    document.head.appendChild(fonts);
    // Left in place: later mounts reuse it.
  }

  // Scope root: our stylesheet is @scope'd to .ecom-admin, and .dark goes here. Portals render inside it.
  // Utility classes only match inside the scope, not the root itself, so the page look sits on appEl.
  const scope = document.createElement("div");
  scope.className = "ecom-admin";
  scope.style.cssText = "min-height:100%;display:flex;flex-direction:column";
  scope.style.setProperty("--font-sans", '"Geist", ui-sans-serif, system-ui, sans-serif');
  scope.style.setProperty("--font-serif", '"Lora", ui-serif, Georgia, serif');
  scope.style.setProperty("--font-mono", '"Geist Mono", ui-monospace, SFMono-Regular, monospace');
  const appEl = document.createElement("div");
  appEl.className = "flex-1 bg-zinc-50 text-foreground font-sans antialiased dark:bg-background";
  const portal = document.createElement("div");
  portal.setAttribute("data-ecommerce-portals", "");
  scope.append(appEl, portal);
  el.appendChild(scope);
  setHostElements(scope, portal);
  cleanups.push(() => getScopeRoot() === scope && setHostElements(null, null));
  cleanups.push(startTheme());
  cleanups.push(startRouter(scope));

  const root = createRoot(appEl);
  root.render(<AdminApp pageId={ctx.pageId} />);
  const instance: Instance = { root, cleanups, disposed: false };
  active = instance;
  // OpenExt may unmount the previous page after mounting the next one, so each mount gets its own unmount.
  return { unmount: () => dispose(instance) };
}

export function unmount() {
  if (active) dispose(active);
}

function dispose(instance: Instance) {
  if (instance.disposed) return;
  instance.disposed = true;
  if (active === instance) active = null;
  instance.root.unmount();
  for (const fn of instance.cleanups.reverse()) fn();
}
