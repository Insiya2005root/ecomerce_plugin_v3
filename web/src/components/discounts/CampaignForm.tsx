"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { CheckboxField, Field, SelectField, TextArea, TextInput, controlClass } from "@/components/admin/fields";
import { SectionCard } from "@/components/admin/SectionCard";
import { InlineError } from "@/components/admin/StateViews";
import { toast } from "@/components/admin/toast";
import { DiscountStatusBadge, TabIcon } from "@/components/discounts/PromotionBits";
import { FormFooter, ScheduleFields, StatusSwitch, useDirtyGuard } from "@/components/discounts/RuleSettingsFields";
import { focusFirstError } from "@/components/products/ProductForm";
import { createDiscount, listDiscounts, updateDiscount } from "@/lib/discounts/api";
import { TYPE_LABEL, describeRule, liveStatus, promotionUrls, tabOf } from "@/lib/discounts/describe";
import { settingsFromRule, settingsToPayload, validateSettings, type FormErrors, type RuleSettings } from "@/lib/discounts/form";
import type { DiscountRule } from "@/lib/discounts/types";
import { cn } from "@/lib/utils";

export type CampaignValues = RuleSettings & {
  name: string;
  marketingHeading: string;
  description: string;
  storefrontDisplay: boolean;
  childRuleIds: string[];
};

export function campaignFromRule(rule?: DiscountRule): CampaignValues {
  return {
    ...settingsFromRule(rule),
    name: rule?.name ?? "",
    marketingHeading: rule?.campaign?.marketingHeading ?? "",
    description: rule?.campaign?.description ?? "",
    storefrontDisplay: rule?.campaign?.storefrontDisplay ?? true,
    childRuleIds: (rule?.campaign?.childRuleIds ?? []).map(String),
  };
}

export function CampaignForm({ mode, rule, initial }: { mode: "create" | "edit"; rule?: DiscountRule; initial: CampaignValues }) {
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const allowLeave = useDirtyGuard(dirty);
  const [rules, setRules] = React.useState<DiscountRule[] | null>(null);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");

  React.useEffect(() => {
    listDiscounts()
      .then((all) => setRules(all.filter((r) => r.type !== "campaign")))
      .catch(() => setRules([]));
  }, []);

  const set = (patch: Partial<CampaignValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setDirty(true);
    setErrors({});
  };
  const toggleChild = (id: string) =>
    set({ childRuleIds: values.childRuleIds.includes(id) ? values.childRuleIds.filter((c) => c !== id) : [...values.childRuleIds, id] });

  const q = search.trim().toLowerCase();
  const visible = (rules ?? []).filter((r) => (!q || r.name.toLowerCase().includes(q) || (r.code ?? "").toLowerCase().includes(q)) && (typeFilter === "all" || r.type === typeFilter));
  const typeOptions = [{ value: "all", label: "All types" }, ...[...new Set((rules ?? []).map((r) => r.type))].map((t) => ({ value: t, label: TYPE_LABEL[t] ?? t }))];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: FormErrors = {};
    if (!values.name.trim()) found.name = "Give the campaign a name.";
    if (values.childRuleIds.length === 0) found.childRuleIds = "Include at least one discount.";
    validateSettings(values, found);
    setErrors(found);
    if (Object.keys(found).length) {
      setSubmitError("Fix the highlighted fields to continue.");
      focusFirstError(found);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const s = settingsToPayload(values);
      const payload = {
        name: values.name.trim(),
        type: "campaign" as const,
        // Campaigns turn on automatically; their included discounts follow the campaign's dates and status.
        isAutomatic: true,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        minSubtotal: s.minSubtotal,
        campaign: {
          childRuleIds: values.childRuleIds,
          marketingHeading: values.marketingHeading.trim(),
          description: values.description.trim(),
          storefrontDisplay: values.storefrontDisplay,
        },
      };
      const saved = mode === "create" ? await createDiscount(payload) : await updateDiscount(rule!._id, payload);
      allowLeave();
      toast.flash(mode === "create" ? "Campaign created" : "Campaign saved", saved.name);
      window.location.href = promotionUrls.detail(saved._id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save.");
      setSaving(false);
    }
  };

  const selected = (rules ?? []).filter((r) => values.childRuleIds.includes(r._id));

  return (
    <form onSubmit={submit} noValidate className="space-y-4 pb-20">
      {submitError && <InlineError message={submitError} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <SectionCard title="Campaign" bodyClassName="space-y-4 p-5">
            <Field id="name" label="Name" error={errors.name} hint="For your team, e.g. “Diwali 2026”.">
              <TextInput id="name" value={values.name} error={errors.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field id="marketingHeading" label="Storefront heading" optional hint="Shown to shoppers, e.g. “MEGA FESTIVE SALE”. The “up to X% off” label is worked out from the included discounts.">
              <TextInput id="marketingHeading" value={values.marketingHeading} onChange={(e) => set({ marketingHeading: e.target.value })} />
            </Field>
            <Field id="description" label="Description" optional>
              <TextArea id="description" rows={3} value={values.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <CheckboxField id="storefrontDisplay" checked={values.storefrontDisplay} onChange={(c) => set({ storefrontDisplay: c })} label="Show this campaign on the storefront" hint="Adds it to the storefront’s active campaigns list." />
            <div>
              <p className="mb-1.5 text-[13px] font-medium">Status</p>
              <StatusSwitch values={values} onChange={set} />
            </div>
          </SectionCard>

          <SectionCard title="Schedule" bodyClassName="p-5">
            <ScheduleFields values={values} onChange={set} errors={errors} showUsage={false} />
          </SectionCard>

          <SectionCard
            title="Included discounts"
            description="While the campaign runs, these discounts apply automatically, even ones that normally need a code."
          >
            <div className="flex flex-wrap gap-2 border-b px-5 py-3">
              <div className="relative min-w-48 flex-1">
                <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input type="search" aria-label="Search discounts" placeholder="Search discounts" value={search} onChange={(e) => setSearch(e.target.value)} className={cn(controlClass, "pl-8")} />
              </div>
              <SelectField id="campaign-type-filter" value={typeFilter} options={typeOptions} onChange={(v) => setTypeFilter(v || "all")} className="w-40" />
            </div>
            {errors.childRuleIds && <div id="childRuleIds" className="px-5 pt-3"><InlineError message={errors.childRuleIds} /></div>}
            <ul className="max-h-80 divide-y overflow-y-auto">
              {rules === null && <li className="px-5 py-4 text-[13px] text-muted-foreground">Loading discounts…</li>}
              {rules?.length === 0 && <li className="px-5 py-4 text-[13px] text-muted-foreground">No discounts yet. Create automatic discounts or coupons first.</li>}
              {visible.map((r) => (
                <li key={r._id}>
                  <label className="flex cursor-pointer items-center gap-3 px-5 py-2.5 text-[13px] hover:bg-muted/40">
                    <input type="checkbox" className="accent-foreground" checked={values.childRuleIds.includes(r._id)} onChange={() => toggleChild(r._id)} />
                    <TabIcon tab={tabOf(r)} className="size-6" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{describeRule(r)}</span>
                    </span>
                    <DiscountStatusBadge rule={r} />
                  </label>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <div className="min-w-0">
          <div className="space-y-4 lg:sticky lg:top-4">
            <SectionCard title="Summary">
              <div className="space-y-3 px-5 py-4 text-[13px]">
                <p className="font-medium">{values.name.trim() || "Untitled campaign"}</p>
                {values.marketingHeading.trim() && <p className="rounded-md bg-violet-50 px-2.5 py-1.5 text-xs font-semibold tracking-wide text-violet-800 uppercase dark:bg-violet-500/10 dark:text-violet-300">{values.marketingHeading}</p>}
                <p className="text-muted-foreground">{values.childRuleIds.length} discount{values.childRuleIds.length === 1 ? "" : "s"} included</p>
                {selected.length > 0 && (
                  <ul className="space-y-1 border-t pt-3 text-xs">
                    {selected.map((r) => (
                      <li key={r._id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{r.name}</span>
                        <span className={cn("shrink-0", liveStatus(r) === "Active" ? "text-emerald-600" : "text-muted-foreground")}>{liveStatus(r)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
      <FormFooter saving={saving} submitLabel={mode === "create" ? "Create campaign" : "Save changes"} cancelHref={rule ? promotionUrls.detail(rule._id) : promotionUrls.list("campaigns")} dirty={dirty} />
    </form>
  );
}
