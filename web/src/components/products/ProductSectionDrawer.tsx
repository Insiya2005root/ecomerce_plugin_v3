"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/admin/SidePanel";
import { InlineError } from "@/components/admin/StateViews";
import { toast } from "@/components/admin/toast";
import { focusFirstError } from "@/components/products/ProductForm";
import {
  GeneralFields,
  InventoryFields,
  MediaField,
  OrganizationFields,
  PricingFields,
  SeoFields,
  VariantsEditor,
} from "@/components/products/ProductFormSections";
import { ApiError, updateProduct } from "@/lib/products/api";
import {
  formToPayload,
  productToForm,
  validateProductForm,
  type FormErrors,
  type ProductFormValues,
  type ProductSection,
} from "@/lib/products/form";
import type { Category, Collection, Product, TaxClass } from "@/lib/products/types";

const SECTION_META: Record<ProductSection, { title: string; description?: string; wide?: boolean }> = {
  general: { title: "Edit general", description: "Title, description and status." },
  media: { title: "Edit media", description: "The first image is the product thumbnail." },
  pricing: { title: "Edit pricing" },
  inventory: { title: "Edit inventory" },
  variants: { title: "Edit variants", description: "Size and color combinations with their own stock and price.", wide: true },
  organization: { title: "Edit organization" },
  seo: { title: "Edit search engine listing" },
};

/** Edits one section of a saved product and sends only that section's fields. */
export function ProductSectionDrawer({
  product,
  section,
  onClose,
  onSaved,
  categories,
  collections,
  taxClasses,
}: {
  product: Product;
  section: ProductSection | null;
  onClose: () => void;
  onSaved: (product: Product) => void;
  categories: Category[];
  collections: Collection[];
  taxClasses: TaxClass[];
}) {
  const [values, setValues] = React.useState<ProductFormValues>(() => productToForm(product));
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [openFor, setOpenFor] = React.useState<ProductSection | null>(null);

  // Reset the draft from the latest saved product each time a section is opened.
  if (section !== openFor) {
    setOpenFor(section);
    if (section) {
      setValues(productToForm(product));
      setErrors({});
      setSubmitError(null);
      setSaving(false);
    }
  }

  const onChange = React.useCallback((patch: Partial<ProductFormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors({});
  }, []);

  const save = async () => {
    if (!section) return;
    const found = validateProductForm(values, [section], "edit");
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const updated = await updateProduct(product._id, formToPayload(values, [section], "edit"));
      onSaved(updated);
      toast.success("Changes saved", product.name);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save changes.";
      if (err instanceof ApiError && err.status === 409 && /SKU/i.test(message)) setErrors({ sku: message });
      setSubmitError(message);
    } finally {
      setSaving(false);
    }
  };

  const meta = section ? SECTION_META[section] : null;
  const props = { values, onChange, errors };

  return (
    <SidePanel
      open={section !== null}
      onOpenChange={(open) => !open && !saving && onClose()}
      title={meta?.title ?? ""}
      description={meta?.description}
      wide={meta?.wide}
      onSubmit={save}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" className="rounded-md" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {submitError && <InlineError message={submitError} />}
        {section === "general" && <GeneralFields {...props} />}
        {section === "media" && <MediaField {...props} />}
        {section === "pricing" && <PricingFields {...props} />}
        {section === "inventory" && <InventoryFields {...props} mode="edit" />}
        {section === "variants" && <VariantsEditor {...props} />}
        {section === "organization" && <OrganizationFields {...props} categories={categories} collections={collections} taxClasses={taxClasses} />}
        {section === "seo" && <SeoFields {...props} />}
      </div>
    </SidePanel>
  );
}
