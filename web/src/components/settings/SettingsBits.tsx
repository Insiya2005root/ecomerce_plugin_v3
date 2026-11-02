"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { cn } from "@/lib/utils";

/** Loads data once (and again on reload()); keeps the last good data while a reload is in flight. */
export function useLoader<T>(load: () => Promise<T>) {
  const loadRef = React.useRef(load);
  React.useEffect(() => {
    loadRef.current = load;
  });
  const [attempt, setAttempt] = React.useState(0);
  const [state, setState] = React.useState<{ attempt: number; data: T | null; error: Error | null } | null>(null);

  React.useEffect(() => {
    let active = true;
    loadRef
      .current()
      .then((data) => active && setState({ attempt, data, error: null }))
      .catch((error) => active && setState((prev) => ({ attempt, data: prev?.data ?? null, error })));
    return () => {
      active = false;
    };
  }, [attempt]);

  return {
    data: state?.data ?? null,
    error: state?.error ?? null,
    loading: state === null || state.attempt !== attempt,
    reload: () => setAttempt((n) => n + 1),
    /** Replace the data after a save, without another request. */
    setData: (data: T) => setState({ attempt, data, error: null }),
  };
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border bg-card p-0.5 shadow-xs">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded px-3 text-[13px] font-medium transition-colors disabled:opacity-50",
            value === o.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Drops the errors for fields the user just changed, so fixed fields stop showing stale messages. */
export function clearErrors(errors: Record<string, string>, keys: string[]): Record<string, string> {
  return keys.some((k) => k in errors) ? Object.fromEntries(Object.entries(errors).filter(([k]) => !keys.includes(k))) : errors;
}

/** Cancel / Save pair for SidePanel footers (the panel's form submits on Save). */
export function PanelButtons({ onCancel, saving, saveLabel = "Save" }: { onCancel: () => void; saving: boolean; saveLabel?: string }) {
  return (
    <>
      <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" size="sm" className="rounded-md" disabled={saving}>
        {saving ? "Saving…" : saveLabel}
      </Button>
    </>
  );
}

export function OnOff({ on, onLabel = "On", offLabel = "Off" }: { on: boolean; onLabel?: string; offLabel?: string }) {
  return <StatusBadge tone={on ? "green" : "grey"}>{on ? onLabel : offLabel}</StatusBadge>;
}

export function ActiveBadge({ status }: { status: "Active" | "Inactive" }) {
  return <StatusBadge tone={status === "Active" ? "green" : "grey"}>{status}</StatusBadge>;
}

/** Big selectable card used for either/or choices (e.g. flat vs distance shipping). */
export function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  name,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  icon?: React.ReactNode;
  name: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 shadow-xs transition-colors hover:bg-muted/30",
        selected && "border-foreground/50 ring-1 ring-foreground/15"
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="mt-0.5 accent-foreground" />
      {icon && <span className="mt-px text-muted-foreground">{icon}</span>}
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
