"use client";

import * as React from "react";
import { SidePanel } from "@/components/admin/SidePanel";
import { InlineError } from "@/components/admin/StateViews";
import { AffixInput, CheckboxField, Field, SelectField, TextArea, TextInput } from "@/components/admin/fields";
import { PanelButtons, Segmented, clearErrors } from "@/components/settings/SettingsBits";
import { fieldErrorsOf } from "@/lib/request";
import {
  ADJUST_REASONS,
  UNASSIGNED_LOCATION,
  adjustStock,
  createReservation,
  setItemLocations,
  updateInventoryItem,
  updateReservation,
  type InventoryItemDetail,
  type InventoryLevel,
  type Reservation,
} from "@/lib/inventory";
import type { Location } from "@/lib/settings";

const wholeNumber = (v: string) => /^\d+$/.test(v.trim());
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Could not save.");

/** Change the stock at one location: set an exact count or add/remove units, with a reason for the history. */
export function AdjustStockPanel({ open, item, level, onClose, onSaved }: { open: boolean; item: InventoryItemDetail; level: InventoryLevel | null; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = React.useState<"set" | "add">("set");
  const [quantity, setQuantity] = React.useState(String(level?.stocked ?? 0));
  const [incoming, setIncoming] = React.useState(String(level?.incoming ?? 0));
  const [reason, setReason] = React.useState("Correction");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  if (!level) return null;
  const n = Number(quantity);
  const next = mode === "set" ? n : level.stocked + n;

  const submit = async () => {
    const valid = mode === "set" ? wholeNumber(quantity) : /^-?\d+$/.test(quantity.trim());
    if (!valid) return setError(mode === "set" ? "Enter a whole number of 0 or more." : "Enter how many to add (or a negative number to remove).");
    if (!wholeNumber(incoming)) return setError("Incoming must be a whole number of 0 or more.");
    if (next < level.reserved) return setError(`In stock can't be less than the ${level.reserved} reserved for orders here.`);
    setSaving(true);
    setError(null);
    try {
      await adjustStock(item._id, { locationId: level.locationId, ...(mode === "set" ? { stocked: n } : { delta: n }), incoming: Number(incoming), reason, note: note.trim() || undefined });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel open={open} onOpenChange={(o) => !o && !saving && onClose()} title={`Adjust stock · ${level.locationName}`} description={item.title} onSubmit={submit} footer={<PanelButtons onCancel={onClose} saving={saving} />}>
      <div className="space-y-4">
        {error && <InlineError message={error} />}
        <dl className="grid grid-cols-3 gap-2 rounded-md border p-3 text-center text-[13px]">
          {[
            ["In stock", level.stocked],
            ["Reserved", level.reserved],
            ["Available", level.available],
          ].map(([l, v]) => (
            <div key={l as string}>
              <dt className="text-xs text-muted-foreground">{l}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <Segmented
          label="How to change stock"
          value={mode}
          options={[
            { value: "set", label: "Set count" },
            { value: "add", label: "Add / remove" },
          ]}
          onChange={(m) => {
            setMode(m);
            setQuantity(m === "set" ? String(level.stocked) : "0");
          }}
        />
        <Field id="adjust-qty" label={mode === "set" ? "In stock" : "Units to add (negative to remove)"} hint={Number.isFinite(next) ? `After saving: ${next} in stock, ${next - level.reserved} available.` : undefined}>
          <TextInput id="adjust-qty" inputMode="numeric" value={quantity} autoFocus onChange={(e) => setQuantity(e.target.value.replace(mode === "set" ? /[^\d]/g : /[^\d-]/g, ""))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="adjust-reason" label="Reason">
            <SelectField id="adjust-reason" value={reason} options={ADJUST_REASONS.map((r) => ({ value: r, label: r }))} onChange={(v) => setReason(v || "Correction")} />
          </Field>
          <Field id="adjust-incoming" label="Incoming" hint="Units on their way (e.g. ordered from a supplier).">
            <TextInput id="adjust-incoming" inputMode="numeric" value={incoming} onChange={(e) => setIncoming(e.target.value.replace(/[^\d]/g, ""))} />
          </Field>
        </div>
        <Field id="adjust-note" label="Note" optional hint="Shown in the stock history, e.g. a supplier invoice number.">
          <TextInput id="adjust-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </SidePanel>
  );
}

/** Choose which locations stock this item. Locations still holding units can't be turned off. */
export function ManageLocationsPanel({ open, item, locations, onClose, onSaved }: { open: boolean; item: InventoryItemDetail; locations: Location[]; onClose: () => void; onSaved: () => void }) {
  const [selected, setSelected] = React.useState<string[]>(item.levels.map((l) => l.locationId));
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const levelAt = (id: string) => item.levels.find((l) => l.locationId === id);
  const options = [...locations.map((l) => ({ id: l._id, name: l.name, inactive: l.status !== "Active" })), ...item.levels.filter((l) => l.locationId === UNASSIGNED_LOCATION).map((l) => ({ id: l.locationId, name: l.locationName, inactive: false }))];

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await setItemLocations(item._id, selected);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel open={open} onOpenChange={(o) => !o && !saving && onClose()} title="Manage locations" description="Choose where this item is stocked." onSubmit={submit} footer={<PanelButtons onCancel={onClose} saving={saving} />}>
      <div className="space-y-3">
        {error && <InlineError message={error} />}
        {options.length === 0 && <p className="text-[13px] text-muted-foreground">No locations yet. Add one under Settings → Locations.</p>}
        {options.map((o) => {
          const level = levelAt(o.id);
          const holds = Boolean(level && (level.stocked || level.reserved || level.incoming));
          const checked = selected.includes(o.id);
          return (
            <CheckboxField
              key={o.id}
              id={`loc-${o.id}`}
              checked={checked}
              onChange={(c) => {
                if (!c && holds) return setError(`${o.name} still has ${level!.stocked} in stock, ${level!.reserved} reserved and ${level!.incoming} incoming. Set them to 0 first.`);
                setError(null);
                setSelected((s) => (c ? [...s, o.id] : s.filter((x) => x !== o.id)));
              }}
              label={`${o.name}${o.inactive ? " (inactive)" : ""}`}
              hint={level ? `${level.stocked} in stock · ${level.reserved} reserved` : "Not stocked here"}
            />
          );
        })}
      </div>
    </SidePanel>
  );
}

type SettingsDraft = {
  requiresShipping: boolean;
  trackInventory: boolean;
  allowBackorder: boolean;
  weight: string;
  length: string;
  width: string;
  height: string;
  hsCode: string;
  midCode: string;
  originCountry: string;
  material: string;
  unit: string;
};

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));

/** Item settings (tracking, backorders, shipping) and attributes (size, weight, customs codes). */
export function ItemSettingsPanel({ open, item, section, onClose, onSaved }: { open: boolean; item: InventoryItemDetail; section: "settings" | "attributes"; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = React.useState<SettingsDraft>({
    requiresShipping: item.requiresShipping !== false,
    trackInventory: item.trackInventory !== false,
    allowBackorder: item.allowBackorder === true,
    weight: str(item.weight),
    length: str(item.length),
    width: str(item.width),
    height: str(item.height),
    hsCode: str(item.hsCode),
    midCode: str(item.midCode),
    originCountry: str(item.originCountry),
    material: str(item.material),
    unit: str(item.unit),
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const set = (patch: Partial<SettingsDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => clearErrors(e, Object.keys(patch)));
  };
  const num = (key: "weight" | "length" | "width" | "height", label: string, suffix: string) => (
    <Field id={`attr-${key}`} label={label} optional error={errors[key]}>
      <AffixInput id={`attr-${key}`} suffix={suffix} value={draft[key]} error={errors[key]} onChange={(e) => set({ [key]: e.target.value.replace(/[^\d.]/g, "") } as Partial<SettingsDraft>)} />
    </Field>
  );
  const text = (key: "hsCode" | "midCode" | "originCountry" | "material" | "unit", label: string, placeholder?: string) => (
    <Field id={`attr-${key}`} label={label} optional>
      <TextInput id={`attr-${key}`} value={draft[key]} placeholder={placeholder} onChange={(e) => set({ [key]: e.target.value } as Partial<SettingsDraft>)} />
    </Field>
  );

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const body =
        section === "settings"
          ? { requiresShipping: draft.requiresShipping, trackInventory: draft.trackInventory, allowBackorder: draft.trackInventory && draft.allowBackorder }
          : { weight: draft.weight, length: draft.length, width: draft.width, height: draft.height, hsCode: draft.hsCode, midCode: draft.midCode, originCountry: draft.originCountry, material: draft.material, unit: draft.unit };
      await updateInventoryItem(item._id, body);
      onSaved();
    } catch (err) {
      const fields = fieldErrorsOf(err);
      setErrors(fields ?? {});
      if (!fields) setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel open={open} onOpenChange={(o) => !o && !saving && onClose()} title={section === "settings" ? "Edit stock settings" : "Edit attributes"} description={item.title} onSubmit={submit} footer={<PanelButtons onCancel={onClose} saving={saving} />}>
      <div className="space-y-4">
        {formError && <InlineError message={formError} />}
        {section === "settings" ? (
          <>
            <CheckboxField id="track" checked={draft.trackInventory} onChange={(trackInventory) => set({ trackInventory })} label="Track inventory" hint="Stock goes down when orders are placed. Turn off for items you never run out of (e.g. made to order)." />
            <CheckboxField
              id="backorder"
              checked={draft.trackInventory && draft.allowBackorder}
              onChange={(allowBackorder) => set({ allowBackorder })}
              label="Allow backorders"
              hint={draft.trackInventory ? "Keep selling when stock runs out; available can go below zero." : "Only for tracked items."}
            />
            <CheckboxField id="ship" checked={draft.requiresShipping} onChange={(requiresShipping) => set({ requiresShipping })} label="Requires shipping" hint="Turn off for items that are never shipped (e.g. digital)." />
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {num("weight", "Weight", "g")}
              {text("unit", "Unit of measure", "e.g. piece, kg, metre")}
              {num("length", "Length", "cm")}
              {num("width", "Width", "cm")}
              {num("height", "Height", "cm")}
              {text("material", "Material", "e.g. Cotton")}
              {text("hsCode", "HS code", "e.g. 6205")}
              {text("midCode", "MID code")}
              {text("originCountry", "Country of origin", "e.g. India")}
            </div>
            <p className="text-xs text-muted-foreground">Used for shipping labels and customs. Leave empty if not needed.</p>
          </>
        )}
      </div>
    </SidePanel>
  );
}

/** Create or edit a manual reservation (stock held for a phone order, a display, etc.). */
export function ReservationPanel({
  open,
  reservation,
  itemId,
  levels,
  onClose,
  onSaved,
}: {
  open: boolean;
  reservation: Reservation | null;
  itemId: string;
  levels: InventoryLevel[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [locationId, setLocationId] = React.useState(reservation?.locationId ?? levels.find((l) => l.available > 0)?.locationId ?? levels[0]?.locationId ?? "");
  const [quantity, setQuantity] = React.useState(String(reservation?.quantity ?? 1));
  const [description, setDescription] = React.useState(reservation?.description ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const level = levels.find((l) => l.locationId === locationId);
  const max = (level?.available ?? 0) + (reservation?.quantity ?? 0);

  const submit = async () => {
    if (!locationId) return setError("Choose a location.");
    if (!/^\d+$/.test(quantity) || Number(quantity) < 1) return setError("Reserve at least 1.");
    if (Number(quantity) > max) return setError(max > 0 ? `Only ${max} available at this location.` : "Nothing is available at this location.");
    setSaving(true);
    setError(null);
    try {
      if (reservation) await updateReservation(reservation._id, { quantity: Number(quantity), description });
      else await createReservation({ itemId, locationId, quantity: Number(quantity), description });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={reservation ? "Edit reservation" : "Create reservation"}
      description="Hold stock so it can't be sold, e.g. for a phone order."
      onSubmit={submit}
      footer={<PanelButtons onCancel={onClose} saving={saving} saveLabel={reservation ? "Save" : "Reserve"} />}
    >
      <div className="space-y-4">
        {error && <InlineError message={error} />}
        <Field id="res-location" label="Location">
          <SelectField id="res-location" value={locationId} disabled={Boolean(reservation)} options={levels.map((l) => ({ value: l.locationId, label: `${l.locationName} · ${l.available} available` }))} onChange={setLocationId} />
        </Field>
        <Field id="res-qty" label="Quantity" hint={`Up to ${Math.max(0, max)} at this location.`}>
          <TextInput id="res-qty" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ""))} />
        </Field>
        <Field id="res-desc" label="Description" optional>
          <TextArea id="res-desc" value={description} placeholder="What is this stock held for?" onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </SidePanel>
  );
}
