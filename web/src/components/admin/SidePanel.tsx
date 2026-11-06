"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { portalContainer } from "@/lib/host";

/** Right-hand edit drawer (Medusa "RouteDrawer" pattern) built on the existing Base UI dialog primitive. */
export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  onSubmit,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onSubmit?: () => void;
  wide?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogPrimitive.Portal container={portalContainer()}>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/25 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup className={`fixed inset-y-2 right-2 z-50 flex w-[calc(100%-1rem)] ${wide ? "max-w-3xl" : "max-w-lg"} flex-col overflow-hidden rounded-lg border bg-background text-foreground shadow-xl outline-none transition-transform duration-200 ease-out data-ending-style:translate-x-[calc(100%+1rem)] data-starting-style:translate-x-[calc(100%+1rem)]`}>
          <form
            className="flex min-h-0 flex-1 flex-col"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              // Panels render in a portal but React still bubbles submit to forms behind them (e.g. a panel opened from a form).
              e.stopPropagation();
              onSubmit?.();
            }}
          >
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="mt-0.5 text-[13px] text-muted-foreground">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close
                render={<Button type="button" variant="ghost" size="icon-sm" className="rounded-md" aria-label="Close" />}
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              </DialogPrimitive.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t px-5 py-3">{footer}</div>}
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
