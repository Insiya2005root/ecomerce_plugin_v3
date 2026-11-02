"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location01Icon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { controlClass } from "@/components/admin/fields";
import { searchCities, type PincodeLookup } from "@/lib/geo";
import { cn } from "@/lib/utils";

/**
 * Type-ahead city field over the bundled list of Indian cities. Picking a city also reports its state.
 * Any other town can still be typed in by hand.
 */
export function CityPicker({
  id,
  value,
  onChange,
  onPick,
  error,
  placeholder = "Start typing a city",
}: {
  id: string;
  value: string;
  onChange: (city: string) => void;
  onPick: (city: { name: string; state: string }) => void;
  error?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const options = React.useMemo(() => searchCities(value), [value]);
  const listId = `${id}-options`;

  const pick = (o: { name: string; state: string }) => {
    onPick(o);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        className={cn(controlClass)}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Delay so a click on an option registers before the list closes.
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) return setOpen(true);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && options[active]) {
            e.preventDefault();
            pick(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && options.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
          {options.map((o, i) => (
            <li
              key={`${o.name}-${o.state}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o)}
              className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px]", i === active && "bg-muted")}
            >
              <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{o.name}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{o.state}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Hint line under a PIN field: what the lookup found, or why it didn't. */
export function PincodeHint({ lookup }: { lookup: PincodeLookup }) {
  if (lookup.status === "idle") return null;
  if (lookup.status === "loading") return <span>Looking up PIN…</span>;
  if (lookup.status === "error") return <span className="text-amber-700 dark:text-amber-300">{lookup.message}</span>;
  const p = lookup.place;
  return (
    <span className="text-emerald-700 dark:text-emerald-400">
      {[p.city, p.state].filter(Boolean).join(", ")}
      {p.latitude !== null ? " · map pin found" : " · no map pin for this PIN"}
    </span>
  );
}
