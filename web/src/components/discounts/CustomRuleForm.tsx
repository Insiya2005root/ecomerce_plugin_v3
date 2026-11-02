"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/admin/fields";
import { SectionCard } from "@/components/admin/SectionCard";
import { InlineError } from "@/components/admin/StateViews";
import { toast } from "@/components/admin/toast";
import { ActionRow, ConditionGroup, defaultAction } from "@/components/discounts/CustomRuleEditor";
import { CodeChip, DiscountStatusBadge } from "@/components/discounts/PromotionBits";
import { FormFooter, ScheduleFields, StackingFields, StatusSwitch, useDirtyGuard } from "@/components/discounts/RuleSettingsFields";
import { focusFirstError } from "@/components/products/ProductForm";
import { useProductReferenceData } from "@/components/products/useProductReferenceData";
import { ApiError } from "@/lib/products/api";
import { createDiscount, updateDiscount } from "@/lib/discounts/api";
import { describeRule, promotionUrls, scheduleLabel } from "@/lib/discounts/describe";
import { settingsFromRule, settingsToPayload, validateSettings, type FormErrors, type RuleSettings } from "@/lib/discounts/form";
import type { CustomAction, CustomCondition, DiscountRule } from "@/lib/discounts/types";

export type CustomRuleValues = RuleSettings & { name: string; code: string; conditionTree: CustomCondition; actions: CustomAction[] };

export function customFromRule(rule?: DiscountRule): CustomRuleValues {
  const tree = rule?.customConfig?.conditionTree;
  return {
    ...settingsFromRule(rule),
    name: rule?.name ?? "",
    code: rule?.code ?? "",
    conditionTree: tree && (tree.operator === "AND" || tree.operator === "OR") ? tree : { operator: "AND", conditions: [] },
    actions: rule?.customConfig?.actions?.length ? rule.customConfig.actions : [defaultAction()],
  };
}

const NUMERIC_CONDITIONS = ["CartTotal", "CartItemCount", "TotalCartQuantity", "ProductQuantity"];
const toNum = (v: unknown) => (v === "" || v === undefined || v === null ? v : Number(v));

/** Stores numbers as numbers (the evaluator also accepts strings, but numbers keep saved rules clean). */
function normalizeTree(node: CustomCondition): CustomCondition {
  if (node.operator === "AND" || node.operator === "OR") return { ...node, conditions: (node.conditions ?? []).map(normalizeTree) };
  if (NUMERIC_CONDITIONS.includes(node.type ?? "")) {
    return { ...node, value: Array.isArray(node.value) ? node.value.map(toNum) : toNum(node.value) };
  }
  return node;
}

function normalizeAction(a: CustomAction): CustomAction {
  const out: CustomAction = { ...a };
  for (const k of ["percentage", "amount", "newPrice", "quantity", "maxDiscount"] as const) {
    if (out[k] !== undefined) out[k] = toNum(out[k]) as number;
  }
  return out;
}

function validateConditions(node: CustomCondition, errors: FormErrors, path = "0") {
  (node.conditions ?? []).forEach((c, i) => {
    const p = `${path}-${i}`;
    if (c.operator === "AND" || c.operator === "OR") return validateConditions(c, errors, p);
    const empty = (v: unknown) => v === undefined || v === null || String(v).trim() === "";
    let bad = false;
    if (NUMERIC_CONDITIONS.includes(c.type ?? "")) {
      const vals = Array.isArray(c.value) ? c.value : [c.value];
      bad = vals.some((v) => empty(v) || !Number.isFinite(Number(v)));
      if (c.type === "ProductQuantity" && !c.product) bad = true;
    } else if (c.type === "ProductInCart" || c.type === "CategoryInCart") bad = !Array.isArray(c.value) || c.value.length === 0;
    else if (c.type === "DateRange") bad = !(c.value as { start?: string })?.start || !(c.value as { end?: string })?.end;
    else if (c.type === "DayOfWeek") bad = Array.isArray(c.value) ? c.value.length === 0 : empty(c.value);
    else bad = Array.isArray(c.value) ? c.value.some(empty) : empty(c.value);
    if (bad) errors.conditions = "Complete every condition (or remove the empty ones).";
  });
}

export function CustomRuleForm({ mode, rule, initial }: { mode: "create" | "edit"; rule?: DiscountRule; initial: CustomRuleValues }) {
  const { categories } = useProductReferenceData();
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const allowLeave = useDirtyGuard(dirty);

  const set = (patch: Partial<CustomRuleValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setDirty(true);
    setErrors({});
  };

  const payload = () => ({
    ...settingsToPayload(values),
    name: values.name.trim(),
    type: "custom" as const,
    // Custom rules apply automatically unless given a code (the engine treats a coded rule like a coupon).
    isAutomatic: !values.code.trim(),
    code: values.code.trim() || undefined,
    customConfig: { conditionTree: normalizeTree(values.conditionTree), actions: values.actions.map(normalizeAction) },
  });
  const preview = { ...(rule ?? {}), ...payload(), _id: rule?._id ?? "preview", usedCount: rule?.usedCount ?? 0 } as DiscountRule;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: FormErrors = {};
    if (!values.name.trim()) found.name = "Give the rule a name.";
    if (values.code.trim() && !/^[A-Za-z0-9_-]+$/.test(values.code.trim())) found.code = "Letters, numbers, - and _ only.";
    if (values.actions.length === 0) found.actions = "Add at least one action.";
    validateConditions(values.conditionTree, found);
    values.actions.forEach((a, i) => {
      const n = (v: unknown) => Number.isFinite(Number(v)) && String(v ?? "").trim() !== "";
      if (a.type === "PercentageOff" && !(n(a.percentage) && Number(a.percentage) > 0 && Number(a.percentage) <= 100)) found[`action-${i}`] = "Percentage must be between 0 and 100.";
      if (a.type === "FixedAmountOff" && !(n(a.amount) && Number(a.amount) > 0)) found[`action-${i}`] = "Enter an amount above 0.";
      if ((a.type === "PercentageOff" || a.type === "FixedAmountOff") && a.applyTo === "MultipleProducts" && !a.productIds?.length) found[`action-${i}`] = "Choose the products.";
      if ((a.type === "PercentageOff" || a.type === "FixedAmountOff") && a.applyTo === "Category" && !a.categoryIds?.length) found[`action-${i}`] = "Choose the categories.";
      if (a.type === "SetProductPrice" && (!a.productIds?.length || !(n(a.newPrice) && Number(a.newPrice) >= 0))) found[`action-${i}`] = "Choose products and a price of 0 or more.";
      if (a.type === "FreeProduct" && (!a.rewardProductId || !(n(a.quantity) && Number.isInteger(Number(a.quantity)) && Number(a.quantity) >= 1))) found[`action-${i}`] = "Choose the product and a quantity of 1 or more.";
    });
    validateSettings(values, found);
    setErrors(found);
    if (Object.keys(found).length) {
      setSubmitError(found.conditions ?? "Fix the highlighted fields to continue.");
      focusFirstError(found);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const saved = mode === "create" ? await createDiscount(payload()) : await updateDiscount(rule!._id, payload());
      allowLeave();
      toast.flash(mode === "create" ? "Rule created" : "Rule saved", saved.name);
      window.location.href = promotionUrls.detail(saved._id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save.";
      if (err instanceof ApiError && err.status === 409) setErrors({ code: message });
      setSubmitError(message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 pb-20">
      {submitError && <InlineError message={submitError} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <SectionCard title="Details" bodyClassName="grid gap-4 p-5 sm:grid-cols-2">
            <Field id="name" label="Name" error={errors.name}>
              <TextInput id="name" value={values.name} error={errors.name} placeholder="e.g. Weekend free shipping" onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field id="code" label="Code" optional error={errors.code} hint="Leave blank to apply automatically when the conditions match.">
              <TextInput id="code" value={values.code} error={errors.code} className="font-mono uppercase" onChange={(e) => set({ code: e.target.value.replace(/\s/g, "") })} />
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[13px] font-medium">Status</p>
              <StatusSwitch values={values} onChange={set} />
            </div>
          </SectionCard>

          <SectionCard title="When" description="The rule applies only when these conditions are met." bodyClassName="p-5" >
            <div id="conditions">
              <ConditionGroup node={values.conditionTree} onChange={(t) => set({ conditionTree: t })} categories={categories} />
            </div>
          </SectionCard>

          <SectionCard
            title="Then"
            description="What the customer gets. Actions run in order."
            bodyClassName="space-y-2 p-5"
            actions={
              <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={() => set({ actions: [...values.actions, defaultAction()] })}>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
                Add action
              </Button>
            }
          >
            {errors.actions && <InlineError message={errors.actions} />}
            {values.actions.map((a, i) => (
              <ActionRow
                key={i}
                index={i}
                action={a}
                errors={errors}
                categories={categories}
                onChange={(next) => set({ actions: values.actions.map((x, j) => (j === i ? next : x)) })}
                onRemove={() => set({ actions: values.actions.filter((_, j) => j !== i) })}
              />
            ))}
          </SectionCard>

          <SectionCard title="Schedule & limits" bodyClassName="p-5">
            <ScheduleFields values={values} onChange={set} errors={errors} />
          </SectionCard>

          <SectionCard title="Stacking & priority" bodyClassName="p-5">
            <StackingFields values={values} onChange={set} errors={errors} />
          </SectionCard>
        </div>

        <div className="min-w-0">
          <div className="space-y-4 lg:sticky lg:top-4">
            <SectionCard title="Summary">
              <div className="space-y-3 px-5 py-4 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <DiscountStatusBadge rule={preview} />
                  {values.code.trim() && <CodeChip code={values.code.trim()} />}
                </div>
                <p className="font-medium">{values.name.trim() || "Untitled rule"}</p>
                <p className="text-muted-foreground">{describeRule(preview)}</p>
                <dl className="space-y-1 border-t pt-3 text-xs">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Applies</dt><dd>{values.code.trim() ? "With the code" : "Automatically"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Schedule</dt><dd>{scheduleLabel(preview)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Stacking</dt><dd>{values.exclusive ? "Exclusive" : "Combines"}</dd></div>
                </dl>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
      <FormFooter saving={saving} submitLabel={mode === "create" ? "Create rule" : "Save changes"} cancelHref={rule ? promotionUrls.detail(rule._id) : promotionUrls.list("custom")} dirty={dirty} />
    </form>
  );
}
