"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
};

/** Promise-friendly confirmation dialog. Keeps the dialog open (with a busy state) until onConfirm settles. */
export function useConfirm() {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const [busy, setBusy] = React.useState(false);

  const close = () => {
    if (!busy) setOptions(null);
  };

  const run = async () => {
    if (!options) return;
    setBusy(true);
    try {
      await options.onConfirm();
      setOptions(null);
    } finally {
      setBusy(false);
    }
  };

  const dialog = (
    <Dialog open={options !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent showCloseButton={false} className="gap-5 rounded-lg p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{options?.title}</DialogTitle>
          <DialogDescription className="text-[13px]">{options?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="rounded-md" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={options?.destructive ? "destructive" : "default"}
            className={options?.destructive ? "rounded-md bg-destructive text-white hover:bg-destructive/90" : "rounded-md"}
            onClick={run}
            disabled={busy}
          >
            {busy ? "Working…" : options?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm: setOptions, dialog };
}
