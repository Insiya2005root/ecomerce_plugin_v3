"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// Compact, bordered controls (Medusa density) layered over the shared shadcn primitives.
export const controlClass =
  "h-8 rounded-md border-input bg-background px-2.5 text-[13px] shadow-xs md:text-[13px] aria-invalid:border-destructive";

export function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-center gap-1 text-[13px] font-medium text-foreground">
        {label}
        {optional && <span className="font-normal text-muted-foreground">(Optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  id,
  error,
  className,
  ...props
}: React.ComponentProps<"input"> & { id: string; error?: string }) {
  return (
    <Input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={cn(controlClass, className)}
      {...props}
    />
  );
}

/** Numeric input with an inline unit (₹, %). Kept as text so partially-typed values aren't coerced. */
export function AffixInput({
  id,
  prefix,
  suffix,
  error,
  className,
  ...props
}: React.ComponentProps<"input"> & { id: string; prefix?: string; suffix?: string; error?: string }) {
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-[13px] text-muted-foreground">
          {prefix}
        </span>
      )}
      <Input
        id={id}
        inputMode="decimal"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(controlClass, "tabular-nums", prefix && "pl-6", suffix && "pr-7", className)}
        {...props}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[13px] text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function TextArea({
  id,
  error,
  className,
  ...props
}: React.ComponentProps<"textarea"> & { id: string; error?: string }) {
  return (
    <Textarea
      id={id}
      aria-invalid={error ? true : undefined}
      className={cn("min-h-20 rounded-md border-input bg-background px-2.5 py-2 text-[13px] shadow-xs md:text-[13px]", className)}
      {...props}
    />
  );
}

export type SelectOption = { value: string; label: string };

export function SelectField({
  id,
  value,
  onChange,
  options,
  placeholder,
  error,
  className,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
}) {
  const items = React.useMemo(() => options.map((o) => ({ value: o.value, label: o.label })), [options]);
  return (
    <Select items={items} value={value || null} onValueChange={(v) => onChange(v == null ? "" : String(v))} disabled={disabled}>
      <SelectTrigger
        id={id}
        aria-invalid={error ? true : undefined}
        className={cn(controlClass, "w-full justify-between", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-lg" alignItemWithTrigger={false}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="rounded-md text-[13px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CheckboxField({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(Boolean(c))} className="mt-0.5 rounded" />
      <div>
        <label htmlFor={id} className="text-[13px] font-medium text-foreground">
          {label}
        </label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/** Chip input for free-form tags. Enter or comma adds; Backspace on empty input removes the last tag. */
export function TagInput({ id, value, onChange }: { id: string; value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = React.useState("");

  const commit = (raw: string) => {
    const additions = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (additions.length === 0) return;
    const existing = new Set(value.map((t) => t.toLowerCase()));
    const next = [...value];
    for (const tag of additions) {
      if (!existing.has(tag.toLowerCase())) {
        existing.add(tag.toLowerCase());
        next.push(tag);
      }
    }
    onChange(next);
    setDraft("");
  };

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-1.5 py-1 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
      {value.map((tag) => (
        <span key={tag} className="inline-flex h-6 items-center gap-1 rounded border bg-muted/60 pr-1 pl-2 text-xs">
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => onChange(value.filter((t) => t !== tag))}
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => {
          if (e.target.value.includes(",")) commit(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? "Add tags, separated by commas" : ""}
        className="h-6 min-w-24 flex-1 bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
