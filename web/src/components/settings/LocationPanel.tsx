"use client";

import * as React from "react";
import { AddressFields } from "@/components/admin/AddressFields";
import { SidePanel } from "@/components/admin/SidePanel";
import { InlineError } from "@/components/admin/StateViews";
import { CheckboxField, Field, TextInput } from "@/components/admin/fields";
import { PanelButtons, clearErrors } from "@/components/settings/SettingsBits";
import type { PincodePlace } from "@/lib/geo";
import { fieldErrorsOf } from "@/lib/request";
import { createLocation, updateLocation, type Location } from "@/lib/settings";

type Draft = {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: string;
  longitude: string;
  priority: string;
  active: boolean;
};

const REQUIRED: [keyof Draft, string][] = [
  ["name", "Enter a location name."],
  ["addressLine1", "Enter the street address."],
  ["city", "Enter a city."],
  ["state", "Choose a state."],
  ["postalCode", "Enter a PIN code."],
];

const toDraft = (l: Location | null): Draft => ({
  name: l?.name ?? "",
  addressLine1: l?.addressLine1 ?? "",
  addressLine2: l?.addressLine2 ?? "",
  city: l?.city ?? "",
  state: l?.state ?? "",
  postalCode: l?.postalCode ?? "",
  country: l?.country ?? "India",
  latitude: l?.latitude != null ? String(l.latitude) : "",
  longitude: l?.longitude != null ? String(l.longitude) : "",
  priority: String(l?.priority ?? 0),
  active: l ? l.status === "Active" : true,
});

export function LocationPanel({ open, location, onClose, onSaved }: { open: boolean; location: Location | null; onClose: () => void; onSaved: (l: Location, created: boolean) => void }) {
  const [draft, setDraft] = React.useState(() => toDraft(location));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => clearErrors(e, Object.keys(patch)));
  };
  const text = (key: keyof Draft) => ({
    value: draft[key] as string,
    error: errors[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [key]: e.target.value } as Partial<Draft>),
  });

  // Coordinates come from the PIN code; typing them by hand is optional.
  const [manualCoords, setManualCoords] = React.useState(false);
  const applyPinCoordinates = (place: PincodePlace) => {
    if (manualCoords) return;
    // No pin for this PIN: clear the old one so the server looks the full address up on save.
    set({ latitude: place.latitude !== null ? String(place.latitude) : "", longitude: place.longitude !== null ? String(place.longitude) : "" });
  };

  const submit = async () => {
    const found: Record<string, string> = {};
    for (const [key, message] of REQUIRED) if (!String(draft[key]).trim()) found[key] = message;
    for (const [key, max] of [["latitude", 90], ["longitude", 180]] as const) {
      const v = draft[key].trim();
      if (v && (!Number.isFinite(Number(v)) || Math.abs(Number(v)) > max)) found[key] = `Enter a number between -${max} and ${max}.`;
    }
    if (Boolean(draft.latitude.trim()) !== Boolean(draft.longitude.trim())) found[draft.latitude.trim() ? "longitude" : "latitude"] = "Enter both coordinates, or leave both empty.";
    if (!/^-?\d+$/.test(draft.priority.trim())) found.priority = "Priority must be a whole number.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setFormError(null);
    const coords = draft.latitude.trim() ? { latitude: Number(draft.latitude), longitude: Number(draft.longitude) } : { latitude: null, longitude: null };
    const payload = {
      name: draft.name.trim(),
      addressLine1: draft.addressLine1.trim(),
      addressLine2: draft.addressLine2.trim(),
      city: draft.city.trim(),
      state: draft.state,
      postalCode: draft.postalCode.trim(),
      country: draft.country.trim() || "India",
      // Empty coordinates are looked up from the address by the server.
      ...coords,
      priority: Number(draft.priority),
      status: draft.active ? ("Active" as const) : ("Inactive" as const),
    };
    try {
      const saved = location ? await updateLocation(location._id, payload) : await createLocation(payload);
      onSaved(saved, !location);
    } catch (err) {
      const fields = fieldErrorsOf(err);
      setErrors(fields ?? {});
      if (!fields) setFormError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={location ? "Edit location" : "Add location"}
      description="A store or warehouse you ship orders from."
      onSubmit={submit}
      footer={<PanelButtons onCancel={onClose} saving={saving} saveLabel={location ? "Save" : "Add location"} />}
    >
      <div className="space-y-4">
        {formError && <InlineError message={formError} />}
        <Field id="loc-name" label="Name" error={errors.name} hint="e.g. Surat warehouse">
          <TextInput id="loc-name" autoFocus {...text("name")} />
        </Field>
        <AddressFields
          idPrefix="loc"
          value={draft}
          errors={errors}
          savedPin={location?.postalCode}
          onChange={set}
          onPlace={applyPinCoordinates}
        />

        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium">Map pin</p>
            <button type="button" className="text-xs text-muted-foreground underline hover:text-foreground" onClick={() => setManualCoords((m) => !m)}>
              {manualCoords ? "Use the PIN code instead" : "Enter coordinates by hand"}
            </button>
          </div>
          {manualCoords ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="loc-lat" label="Latitude" error={errors.latitude}>
                <TextInput id="loc-lat" inputMode="decimal" placeholder="21.1702" {...text("latitude")} />
              </Field>
              <Field id="loc-lng" label="Longitude" error={errors.longitude}>
                <TextInput id="loc-lng" inputMode="decimal" placeholder="72.8311" {...text("longitude")} />
              </Field>
            </div>
          ) : draft.latitude && draft.longitude ? (
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              {Number(draft.latitude).toFixed(5)}, {Number(draft.longitude).toFixed(5)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Filled in from the PIN code. If it can&apos;t be found, the address is looked up when you save.</p>
          )}
          {!manualCoords && (errors.latitude || errors.longitude) && <p className="text-xs text-destructive">{errors.latitude || errors.longitude}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="loc-priority" label="Priority" error={errors.priority} hint="Higher shows first in lists.">
            <TextInput id="loc-priority" inputMode="numeric" {...text("priority")} />
          </Field>
        </div>
        <CheckboxField id="loc-active" checked={draft.active} onChange={(active) => set({ active })} label="Active" hint="Inactive locations are never used to ship orders." />
      </div>
    </SidePanel>
  );
}
