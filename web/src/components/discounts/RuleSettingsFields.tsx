"use client";

import * as React from "react";
import { AffixInput, Field, TextInput } from "@/components/admin/fields";
import { CURRENCY_SYMBOL } from "@/lib/format";
import type { FormErrors, RuleSettings, SavedStatus } from "@/lib/discounts/form";
import { cn } from "@/lib/utils";

type Props<T extends RuleSettings> = { values: T; onChange: (patch: Partial<T>) => void; errors: FormErrors };

const STATUS_HINT: Record<SavedStatus, string> = {
  Active: "Applies whenever its schedule and conditions allow.",
  Draft: "Saved but never applied. Use it while you prepare.",
  Paused: "Temporarily switched off. Activate it again any time.",
};

export function StatusSwitch<T extends RuleSettings>({ values, onChange }: Pick<Props<T>, "values" | "onChange">) {
  return (
    <div className="space-y-1.5">
      <div role="radiogroup" aria-label="Status" className="inline-flex rounded-md border bg-muted/40 p-0.5">
        {(["Active", "Draft", "Paused"] as SavedStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={values.status === s}
            onClick={() => onChange({ status: s } as Partial<T>)}
            className={cn(
              "h-7 rounded px-3 text-[13px] font-medium transition-colors",
              values.status === s ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{STATUS_HINT[values.status]}</p>
    </div>
  );
}

export function ScheduleFields<T extends RuleSettings>({ values, onChange, errors, showMinSubtotal = true, showUsage = true }: Props<T> & { showMinSubtotal?: boolean; showUsage?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="startDate" label="Starts" optional hint="Starts immediately if empty.">
        <TextInput id="startDate" type="datetime-local" value={values.startDate} onChange={(e) => onChange({ startDate: e.target.value } as Partial<T>)} />
      </Field>
      <Field id="endDate" label="Ends" optional error={errors.endDate} hint="Runs until you pause it if empty.">
        <TextInput id="endDate" type="datetime-local" value={values.endDate} error={errors.endDate} onChange={(e) => onChange({ endDate: e.target.value } as Partial<T>)} />
      </Field>
      {showUsage && (
        <Field id="usageLimit" label="Total uses" optional error={errors.usageLimit} hint="Stops after this many orders. Cancelled orders give the use back.">
          <TextInput id="usageLimit" inputMode="numeric" value={values.usageLimit} error={errors.usageLimit} placeholder="Unlimited" onChange={(e) => onChange({ usageLimit: e.target.value } as Partial<T>)} />
        </Field>
      )}
      {showMinSubtotal && (
        <Field id="minSubtotal" label="Minimum order subtotal" optional error={errors.minSubtotal} hint="The cart must reach this before the discount applies.">
          <AffixInput id="minSubtotal" prefix={CURRENCY_SYMBOL} value={values.minSubtotal} error={errors.minSubtotal} placeholder="No minimum" onChange={(e) => onChange({ minSubtotal: e.target.value } as Partial<T>)} />
        </Field>
      )}
    </div>
  );
}

export function StackingFields<T extends RuleSettings>({ values, onChange, errors }: Props<T>) {
  return (
    <div className="space-y-4">
      <label className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors", values.exclusive && "border-foreground/40 bg-muted/40")}>
        <input type="checkbox" className="mt-0.5 accent-foreground" checked={values.exclusive} onChange={(e) => onChange({ exclusive: e.target.checked } as Partial<T>)} />
        <span>
          <span className="block text-[13px] font-medium">Don’t combine with other discounts (exclusive)</span>
          <span className="block text-xs text-muted-foreground">
            The cart is priced with this discount alone and with all other discounts together; the customer gets whichever saves more.
          </span>
        </span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="priority" label="Priority" error={errors.priority} hint="Higher numbers apply first. Matters when discounts stack (e.g. % off before a fixed amount).">
          <TextInput id="priority" inputMode="numeric" value={values.priority} error={errors.priority} onChange={(e) => onChange({ priority: e.target.value } as Partial<T>)} />
        </Field>
        <Field id="maxDiscountAmount" label="Maximum discount" optional error={errors.maxDiscountAmount} hint="Caps how much this discount can take off one order.">
          <AffixInput id="maxDiscountAmount" prefix={CURRENCY_SYMBOL} value={values.maxDiscountAmount} error={errors.maxDiscountAmount} placeholder="No cap" onChange={(e) => onChange({ maxDiscountAmount: e.target.value } as Partial<T>)} />
        </Field>
      </div>
    </div>
  );
}

/** Sticky save bar used by the promotion forms. */
export function FormFooter({ saving, submitLabel, cancelHref, dirty }: { saving: boolean; submitLabel: string; cancelHref: string; dirty: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:px-8">
        {dirty && <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>}
        <a href={cancelHref} className="inline-flex h-7 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted">
          Cancel
        </a>
        <button type="submit" disabled={saving} className="inline-flex h-7 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/85 disabled:opacity-50">
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

export function useDirtyGuard(dirty: boolean) {
  const allow = React.useRef(false);
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (!allow.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  return React.useCallback(() => {
    allow.current = true;
  }, []);
}
