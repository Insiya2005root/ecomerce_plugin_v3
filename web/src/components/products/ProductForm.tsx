"use client";

import * as React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SectionCard } from "@/components/admin/SectionCard";
import { InlineError } from "@/components/admin/StateViews";
import { toast } from "@/components/admin/toast";
import {
  GeneralFields,
  InventoryFields,
  MediaField,
  OrganizationFields,
  PricingFields,
  SeoFields,
  VariantsEditor,
} from "@/components/products/ProductFormSections";
import { useProductReferenceData } from "@/components/products/useProductReferenceData";
import { ApiError, createProduct, updateProduct } from "@/lib/products/api";
import {
  ALL_SECTIONS,
  formToPayload,
  validateProductForm,
  type FormErrors,
  type FormMode,
  type ProductFormValues,
} from "@/lib/products/form";
import { productUrls } from "@/lib/products/urls";
import { cn } from "@/lib/utils";

/** Warns before leaving with unsaved edits. Returns a callback that allows the next navigation (after a save). */
function useUnsavedChangesWarning(dirty: boolean) {
  const allowLeave = React.useRef(false);
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (!allowLeave.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  return React.useCallback(() => {
    allowLeave.current = true;
  }, []);
}

const VARIANT_FIELD_IDS: Record<string, string> = { size: "size", stock: "stock", priceOverride: "price" };

export function focusFirstError(errors: FormErrors) {
  const first = Object.keys(errors)[0];
  if (!first) return;
  const [, index, field] = first.split(".");
  const id = first.startsWith("variants.") ? `variant-${index}-${VARIANT_FIELD_IDS[field] ?? field}` : first;
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.focus({ preventScroll: true });
}

export function ProductForm({
  mode,
  initialValues,
  productId,
  cancelHref,
}: {
  mode: FormMode;
  initialValues: ProductFormValues;
  productId?: string;
  cancelHref: string;
}) {
  const { categories, collections, taxClasses } = useProductReferenceData();
  const [values, setValues] = React.useState(initialValues);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const allowLeave = useUnsavedChangesWarning(dirty);

  const onChange = React.useCallback((patch: Partial<ProductFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setDirty(true);
    setErrors((prev) => {
      const keys = Object.keys(patch);
      if (!keys.some((k) => k in prev || k === "variants" || k === "images" || k === "videos")) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      if ("variants" in patch) for (const k of Object.keys(next)) if (k.startsWith("variants.")) delete next[k];
      if ("images" in patch || "videos" in patch) delete next.media;
      return next;
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateProductForm(values, ALL_SECTIONS, mode);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSubmitError("Fix the highlighted fields to continue.");
      focusFirstError(found);
      return;
    }
    setSubmitError(null);
    setSaving(true);
    try {
      const payload = formToPayload(values, ALL_SECTIONS, mode);
      const saved = mode === "create" ? await createProduct(payload) : await updateProduct(productId!, payload);
      allowLeave();
      toast.flash(mode === "create" ? "Product created" : "Product saved", saved.name);
      window.location.href = productUrls.detail(saved._id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save the product.";
      if (err instanceof ApiError && err.status === 409 && /SKU/i.test(message)) {
        setErrors((prev) => ({ ...prev, sku: message }));
        focusFirstError({ sku: message });
      }
      setSubmitError(message);
      setSaving(false);
    }
  };

  const sectionProps = { values, onChange, errors };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 pb-20">
      {submitError && <InlineError message={submitError} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <SectionCard title="General" bodyClassName="p-5">
            <GeneralFields {...sectionProps} showStatus={false} />
          </SectionCard>
          <SectionCard title="Media" bodyClassName="p-5">
            <MediaField {...sectionProps} />
          </SectionCard>
          <SectionCard title="Pricing" bodyClassName="p-5">
            <PricingFields {...sectionProps} />
          </SectionCard>
          <SectionCard title="Inventory" bodyClassName="p-5">
            <InventoryFields {...sectionProps} mode={mode} />
          </SectionCard>
          <SectionCard
            title="Variants"
            description="Optional size and color combinations, each with its own stock and price."
            bodyClassName="p-5"
          >
            <VariantsEditor {...sectionProps} />
          </SectionCard>
          <SectionCard title="Search engine listing" bodyClassName="p-5">
            <SeoFields {...sectionProps} />
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Status" bodyClassName="p-5">
            <GeneralStatus values={values} onChange={onChange} />
          </SectionCard>
          <SectionCard title="Organization" bodyClassName="p-5">
            <OrganizationFields {...sectionProps} categories={categories} collections={collections} taxClasses={taxClasses} />
          </SectionCard>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="flex items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:px-8">
          {dirty && <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>}
          <a href={cancelHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-md")}>
            Cancel
          </a>
          <Button type="submit" size="sm" className="rounded-md" disabled={saving}>
            {saving ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function GeneralStatus({ values, onChange }: { values: ProductFormValues; onChange: (patch: Partial<ProductFormValues>) => void }) {
  const options: { value: ProductFormValues["status"]; hint: string }[] = [
    { value: "Published", hint: "Visible and purchasable on the storefront." },
    { value: "Draft", hint: "Hidden from the storefront while you work on it." },
    { value: "Archived", hint: "Hidden and kept for records." },
  ];
  return (
    <fieldset className="space-y-1.5">
      <legend className="sr-only">Status</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 transition-colors",
            values.status === o.value ? "border-ring bg-muted/40" : "hover:bg-muted/30"
          )}
        >
          <input
            type="radio"
            name="status"
            value={o.value}
            checked={values.status === o.value}
            onChange={() => onChange({ status: o.value })}
            className="mt-0.5 accent-foreground"
          />
          <span>
            <span className="block text-[13px] font-medium">{o.value}</span>
            <span className="block text-xs text-muted-foreground">{o.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
