"use client";

import * as React from "react";
import { Toast } from "@base-ui/react/toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, Cancel01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error";

const manager = Toast.createToastManager<{ kind: ToastKind }>();
const FLASH_KEY = "ecommerce-admin-flash";

export const toast = {
  success: (title: string, description?: string) => manager.add({ title, description, data: { kind: "success" } }),
  error: (title: string, description?: string) =>
    manager.add({ title, description, priority: "high", data: { kind: "error" } }),
  /** Admin pages are separate HTML documents; flash survives the navigation and shows on the next page. */
  flash: (title: string, description?: string) => {
    try {
      sessionStorage.setItem(FLASH_KEY, JSON.stringify({ title, description }));
    } catch {
      // Storage unavailable: the confirmation is simply not shown.
    }
  },
};

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => {
    const kind: ToastKind = t.data?.kind ?? "success";
    return (
      <Toast.Root
        key={t.id}
        toast={t}
        // Clicks pass through to the page underneath (only Dismiss is clickable), so a toast never blocks a button.
        className="pointer-events-none rounded-lg border data-limited:hidden bg-popover text-popover-foreground shadow-lg transition-all duration-200 data-ending-style:translate-y-2 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0"
      >
        <Toast.Content className="flex items-start gap-2.5 p-3">
          <HugeiconsIcon
            icon={kind === "error" ? AlertCircleIcon : CheckmarkCircle02Icon}
            strokeWidth={2}
            className={cn("mt-px size-4 shrink-0", kind === "error" ? "text-destructive" : "text-emerald-600")}
          />
          <div className="min-w-0 flex-1">
            <Toast.Title className="text-[13px] font-medium" />
            <Toast.Description className="mt-0.5 text-[13px] text-muted-foreground" />
          </div>
          <Toast.Close aria-label="Dismiss" className="pointer-events-auto rounded p-0.5 text-muted-foreground hover:text-foreground">
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    );
  });
}

function FlashReader() {
  React.useEffect(() => {
    // Child effects run before the Provider subscribes to the manager; defer so the toast isn't dropped.
    const t = window.setTimeout(() => {
      try {
        const raw = sessionStorage.getItem(FLASH_KEY);
        if (!raw) return;
        sessionStorage.removeItem(FLASH_KEY);
        const { title, description } = JSON.parse(raw);
        if (title) toast.success(title, description);
      } catch {
        // Ignore malformed or unavailable storage.
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}

export function AdminToaster({ children }: { children: React.ReactNode }) {
  return (
    // One at a time, so a growing stack never covers page content.
    <Toast.Provider toastManager={manager} timeout={4000} limit={1}>
      {children}
      <FlashReader />
      <Toast.Portal>
        {/* Bottom-centre, raised above the sticky save bars: page actions live top-right and Save buttons bottom-right. */}
        <Toast.Viewport className="pointer-events-none fixed bottom-16 left-1/2 z-[60] flex w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2 sm:w-96">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
