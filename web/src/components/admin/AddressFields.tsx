"use client";

import * as React from "react";
import { CityPicker, PincodeHint } from "@/components/admin/CityPicker";
import { Field, SelectField, TextInput } from "@/components/admin/fields";
import { usePincodeLookup, type PincodePlace } from "@/lib/geo";
import { INDIAN_STATES } from "@/lib/settings";

export type AddressValue = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

/**
 * The one address block used across the Admin (store address, locations, cart).
 * Typing a 6-digit PIN fills state, city (when empty) and country, offers the PIN's areas, and warns when the
 * typed city doesn't match. `onPlace` lets a form use the rest of the lookup (e.g. map coordinates).
 */
export function AddressFields({
  idPrefix,
  value,
  onChange,
  errors = {},
  savedPin,
  onPlace,
  line1Label = "Address line 1",
  line1Placeholder = "House / building, street",
  autoFocus,
}: {
  idPrefix: string;
  value: AddressValue;
  onChange: (patch: Partial<AddressValue>) => void;
  errors?: Partial<Record<keyof AddressValue, string>>;
  /** The PIN already saved with this record; reopening it must not overwrite the saved city/state. */
  savedPin?: string;
  onPlace?: (place: PincodePlace) => void;
  line1Label?: string;
  line1Placeholder?: string;
  autoFocus?: boolean;
}) {
  const id = (f: string) => `${idPrefix}-${f}`;
  const lookup = usePincodeLookup(value.postalCode, (place) => {
    if (savedPin && place.pin === savedPin.trim()) return;
    onChange({
      state: place.state || value.state,
      city: value.city.trim() ? value.city : place.city,
      country: place.country || value.country,
    });
    onPlace?.(place);
  });
  const place = lookup.status === "found" ? lookup.place : null;
  const cityMismatch = place?.city && value.city.trim() && place.city.toLowerCase() !== value.city.trim().toLowerCase() ? place.city : null;

  const stateOptions = React.useMemo(
    () => (value.state && !INDIAN_STATES.includes(value.state) ? [value.state, ...INDIAN_STATES] : INDIAN_STATES).map((s) => ({ value: s, label: s })),
    [value.state]
  );

  return (
    <div className="space-y-4">
      <Field id={id("line1")} label={line1Label} error={errors.addressLine1}>
        <TextInput id={id("line1")} value={value.addressLine1} error={errors.addressLine1} placeholder={line1Placeholder} autoFocus={autoFocus} onChange={(e) => onChange({ addressLine1: e.target.value })} />
      </Field>
      <Field id={id("line2")} label="Area / landmark" optional>
        <TextInput id={id("line2")} value={value.addressLine2} onChange={(e) => onChange({ addressLine2: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("pin")} label="PIN code" error={errors.postalCode} hint={<PincodeHint lookup={lookup} />}>
          <TextInput
            id={id("pin")}
            inputMode="numeric"
            maxLength={6}
            placeholder="e.g. 395007"
            value={value.postalCode}
            error={errors.postalCode}
            onChange={(e) => onChange({ postalCode: e.target.value.replace(/\D/g, "") })}
          />
        </Field>
        <Field id={id("city")} label="City" error={errors.city}>
          <CityPicker id={id("city")} value={value.city} error={errors.city} onChange={(city) => onChange({ city })} onPick={(c) => onChange({ city: c.name, state: c.state })} />
        </Field>
      </div>
      {place && place.areas.length > 0 && (
        <div className="-mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Areas in {place.pin}:</span>
          {place.areas.slice(0, 8).map((a) => (
            <button key={a} type="button" onClick={() => onChange({ addressLine2: a })} className="rounded-md border px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              {a}
            </button>
          ))}
        </div>
      )}
      {cityMismatch && (
        <p className="-mt-1 text-xs text-amber-700 dark:text-amber-300">
          PIN {place?.pin} is in {cityMismatch}.{" "}
          <button type="button" className="underline" onClick={() => onChange({ city: cityMismatch })}>
            Use {cityMismatch}
          </button>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("state")} label="State" error={errors.state}>
          <SelectField id={id("state")} value={value.state} options={stateOptions} placeholder="Choose a state" error={errors.state} onChange={(state) => onChange({ state })} />
        </Field>
        <Field id={id("country")} label="Country">
          <TextInput id={id("country")} value={value.country} onChange={(e) => onChange({ country: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}
