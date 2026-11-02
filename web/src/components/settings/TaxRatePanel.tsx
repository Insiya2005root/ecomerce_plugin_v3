"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { PincodeHint } from "@/components/admin/CityPicker";
import { SidePanel } from "@/components/admin/SidePanel";
import { InlineError } from "@/components/admin/StateViews";
import { AffixInput, CheckboxField, Field, SelectField, TextInput } from "@/components/admin/fields";
import { PanelButtons, clearErrors } from "@/components/settings/SettingsBits";
import { usePincodeLookup } from "@/lib/geo";
import { fieldErrorsOf } from "@/lib/request";
import { INDIAN_STATES, SHIPPING_TAX_LABEL, createTaxRule, totalRate, updateTaxRule, type ShippingTaxPolicy, type TaxRule } from "@/lib/settings";

const TAX_TYPES = ["GST", "VAT", "Sales Tax"];
const ANY_STATE = "*";

type Draft = {
  type: string;
  customName: string;
  country: string;
  state: string;
  postalScope: string;
  components: { label: string; rate: string }[];
  shippingTaxPolicy: ShippingTaxPolicy;
  priority: string;
  active: boolean;
};

function toDraft(rule: TaxRule | null): Draft {
  const name = rule?.name ?? "GST";
  return {
    type: TAX_TYPES.includes(name) ? name : "Custom",
    customName: TAX_TYPES.includes(name) ? "" : name,
    country: !rule || rule.country === "*" ? (rule ? "" : "India") : rule.country,
    state: rule?.state && rule.state !== "*" ? rule.state : ANY_STATE,
    postalScope: rule?.postalScope && rule.postalScope !== "*" ? rule.postalScope : "",
    components: rule?.components?.length ? rule.components.map((c) => ({ label: c.label, rate: String(c.rate) })) : [{ label: "CGST", rate: "9" }, { label: "SGST", rate: "9" }],
    shippingTaxPolicy: rule?.shippingTaxPolicy ?? "UseGlobal",
    priority: String(rule?.priority ?? 0),
    active: rule ? rule.status === "Active" : true,
  };
}

/** Quick fills for Indian GST: intra-state splits the rate into CGST + SGST, inter-state charges IGST. */
const PRESETS: { label: string; build: (total: number) => { label: string; rate: string }[] }[] = [
  { label: "CGST + SGST", build: (t) => [{ label: "CGST", rate: String(t / 2) }, { label: "SGST", rate: String(t / 2) }] },
  { label: "IGST", build: (t) => [{ label: "IGST", rate: String(t) }] },
];
const GST_SLABS = [5, 12, 18, 28];

export function TaxRatePanel({
  open,
  taxClassId,
  rule,
  onClose,
  onSaved,
}: {
  open: boolean;
  taxClassId: string;
  rule: TaxRule | null;
  onClose: () => void;
  onSaved: (rule: TaxRule, created: boolean) => void;
}) {
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(rule));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    // The custom tax name is reported under "name".
    setErrors((e) => clearErrors(e, Object.keys(patch).map((k) => (k === "customName" ? "name" : k))));
  };
  const setComponent = (i: number, patch: Partial<Draft["components"][number]>) =>
    set({ components: draft.components.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  const total = totalRate(draft.components.map((c) => ({ label: c.label, rate: Number(c.rate) || 0 })));
  // A PIN-specific rate: the PIN tells us its state (and country), so those are filled in.
  const pinLookup = usePincodeLookup(draft.postalScope, (place) => {
    if (rule && place.pin === rule.postalScope) return;
    set({ ...(place.state ? { state: place.state } : {}), ...(draft.country.trim() ? {} : { country: place.country }) });
  });

  const stateOptions = React.useMemo(() => {
    const states = draft.state !== ANY_STATE && !INDIAN_STATES.includes(draft.state) ? [draft.state, ...INDIAN_STATES] : INDIAN_STATES;
    return [{ value: ANY_STATE, label: "All states" }, ...states.map((s) => ({ value: s, label: s }))];
  }, [draft.state]);

  const submit = async () => {
    const found: Record<string, string> = {};
    if (draft.type === "Custom" && !draft.customName.trim()) found.name = "Enter a name for this tax.";
    if (draft.components.some((c) => !c.label.trim())) found.components = "Every rate needs a label, like CGST.";
    else if (draft.components.some((c) => c.rate.trim() === "" || !Number.isFinite(Number(c.rate)) || Number(c.rate) < 0 || Number(c.rate) > 100)) found.components = "Rates must be between 0% and 100%.";
    if (!/^-?\d+$/.test(draft.priority.trim())) found.priority = "Priority must be a whole number.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setFormError(null);
    const payload = {
      name: draft.type === "Custom" ? draft.customName.trim() : draft.type,
      taxClassId,
      country: draft.country.trim() || "*",
      state: draft.state,
      postalScope: draft.postalScope.trim() || "*",
      components: draft.components.map((c) => ({ label: c.label.trim(), rate: Number(c.rate) })),
      shippingTaxPolicy: draft.shippingTaxPolicy,
      priority: Number(draft.priority),
      status: draft.active ? ("Active" as const) : ("Inactive" as const),
    };
    try {
      const saved = rule ? await updateTaxRule(rule._id, payload) : await createTaxRule(payload);
      onSaved(saved, !rule);
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
      title={rule ? "Edit tax rate" : "Add tax rate"}
      description="Rates apply to products in this category, for orders shipped to the region below."
      onSubmit={submit}
      footer={<PanelButtons onCancel={onClose} saving={saving} saveLabel={rule ? "Save" : "Add rate"} />}
    >
      <div className="space-y-5">
        {formError && <InlineError message={formError} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="tax-type" label="Tax">
            <SelectField id="tax-type" value={draft.type} options={[...TAX_TYPES, "Custom"].map((t) => ({ value: t, label: t === "Custom" ? "Other…" : t }))} onChange={(v) => set({ type: v || "GST" })} />
          </Field>
          {draft.type === "Custom" && (
            <Field id="tax-name" label="Tax name" error={errors.name}>
              <TextInput id="tax-name" value={draft.customName} error={errors.name} placeholder="e.g. Cess" onChange={(e) => set({ customName: e.target.value })} />
            </Field>
          )}
        </div>

        <fieldset className="space-y-3">
          <legend className="text-[13px] font-medium">Region</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="tax-country" label="Country" hint="Leave empty for any country.">
              <TextInput id="tax-country" value={draft.country} onChange={(e) => set({ country: e.target.value })} />
            </Field>
            <Field id="tax-state" label="State">
              <SelectField id="tax-state" value={draft.state} options={stateOptions} onChange={(v) => set({ state: v || ANY_STATE })} />
            </Field>
          </div>
          <Field id="tax-pin" label="PIN code" optional hint={pinLookup.status === "idle" ? "Only for a rate that applies to one PIN code." : <PincodeHint lookup={pinLookup} />}>
            <TextInput id="tax-pin" inputMode="numeric" maxLength={6} value={draft.postalScope} onChange={(e) => set({ postalScope: e.target.value.replace(/\D/g, "") })} />
          </Field>
          <p className="text-xs text-muted-foreground">When several rates match an address, the most specific one wins (PIN, then state, then country), then the higher priority.</p>
        </fieldset>

        <fieldset className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="text-[13px] font-medium">Rates</legend>
            <span className="text-[13px] tabular-nums">
              Total <span className="font-semibold">{total}%</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GST_SLABS.map((slab) =>
              PRESETS.map((p) => (
                <button
                  key={`${p.label}-${slab}`}
                  type="button"
                  onClick={() => set({ components: p.build(slab) })}
                  className="rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {slab}% {p.label}
                </button>
              ))
            )}
          </div>
          <div className="space-y-2 pt-1" role="group" aria-label="Rate components">
            {draft.components.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <TextInput id={`component-label-${i}`} aria-label="Label" value={c.label} placeholder="Label, e.g. CGST" onChange={(e) => setComponent(i, { label: e.target.value })} />
                <div className="w-28 shrink-0">
                  <AffixInput id={`component-rate-${i}`} aria-label="Rate" suffix="%" value={c.rate} onChange={(e) => setComponent(i, { rate: e.target.value.replace(/[^\d.]/g, "") })} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 rounded-md text-muted-foreground"
                  aria-label={`Remove ${c.label || "rate"}`}
                  disabled={draft.components.length === 1}
                  onClick={() => set({ components: draft.components.filter((_, j) => j !== i) })}
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                </Button>
              </div>
            ))}
          </div>
          {errors.components && <p className="text-xs text-destructive">{errors.components}</p>}
          <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={() => set({ components: [...draft.components, { label: "", rate: "" }] })}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            Add component
          </Button>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="tax-shipping" label="Tax on shipping">
            <SelectField
              id="tax-shipping"
              value={draft.shippingTaxPolicy}
              options={(Object.keys(SHIPPING_TAX_LABEL) as ShippingTaxPolicy[]).map((p) => ({ value: p, label: SHIPPING_TAX_LABEL[p] }))}
              onChange={(v) => set({ shippingTaxPolicy: (v || "UseGlobal") as ShippingTaxPolicy })}
            />
          </Field>
          <Field id="tax-priority" label="Priority" error={errors.priority} hint="Breaks ties between equally specific rates.">
            <TextInput id="tax-priority" inputMode="numeric" value={draft.priority} error={errors.priority} onChange={(e) => set({ priority: e.target.value })} />
          </Field>
        </div>

        <CheckboxField id="tax-active" checked={draft.active} onChange={(active) => set({ active })} label="Active" hint="Inactive rates are kept but never applied." />
      </div>
    </SidePanel>
  );
}
