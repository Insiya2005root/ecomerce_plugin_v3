"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, SelectField, TextArea, TextInput } from "@/components/admin/fields";
import { SidePanel } from "@/components/admin/SidePanel";
import { InlineError } from "@/components/admin/StateViews";
import { ApiError, createCategory, updateCategory } from "@/lib/products/api";
import { categoryPath } from "@/lib/products/form";
import type { Category } from "@/lib/products/types";
import { descendantIds } from "./categoryTree";

const toHandle = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

/**
 * Create or edit a category: name, handle (slug), description and parent — the same fields as before.
 * `defaultParentId` pre-selects the parent when adding a subcategory.
 */
export function CategoryDrawer({
  open,
  category,
  defaultParentId,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean;
  category?: Category | null;
  defaultParentId?: string | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (category: Category) => void;
}) {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [parentId, setParentId] = React.useState("");
  const [errors, setErrors] = React.useState<{ name?: string; slug?: string; parentId?: string }>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const openKey = open ? `${category?._id ?? "new"}:${defaultParentId ?? ""}` : null;
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    if (openKey) {
      setName(category?.name ?? "");
      setSlug(category?.slug ?? "");
      setSlugTouched(Boolean(category));
      setDescription(category?.description ?? "");
      setParentId(category ? (category.parentId ? String(category.parentId) : "") : defaultParentId ?? "");
      setErrors({});
      setSubmitError(null);
      setSaving(false);
    }
  }

  // A category can't be moved under itself or one of its own subcategories.
  const blocked = React.useMemo(() => (category ? descendantIds(categories, String(category._id)) : new Set<string>()), [categories, category]);
  const parentOptions = React.useMemo(
    () => [
      { value: "none", label: "None (top level)" },
      ...categories
        .filter((c) => !blocked.has(String(c._id)))
        .map((c) => ({ value: String(c._id), label: categoryPath(String(c._id), categories) || c.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [categories, blocked]
  );

  const effectiveSlug = slugTouched ? toHandle(slug) : toHandle(name);

  const save = async () => {
    const found: typeof errors = {};
    if (!name.trim()) found.name = "Name is required.";
    if (!effectiveSlug) found.slug = "Handle is required.";
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(found.name ? "category-name" : "category-slug")?.focus();
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const payload = { name: name.trim(), slug: effectiveSlug, description, parentId: parentId || null };
      const saved = category ? await updateCategory(String(category._id), payload) : await createCategory(payload);
      onSaved(saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save the category.";
      if (err instanceof ApiError && err.status === 409) setErrors({ slug: message });
      else if (err instanceof ApiError && err.status === 400 && /parent|inside itself/i.test(message)) setErrors({ parentId: message });
      else setSubmitError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={category ? "Edit category" : defaultParentId ? "Add subcategory" : "Create category"}
      description="Categories organise your catalog into a browsable tree."
      onSubmit={save}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" className="rounded-md" disabled={saving}>
            {saving ? "Saving…" : category ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {submitError && <InlineError message={submitError} />}
        <Field id="category-name" label="Name" error={errors.name}>
          <TextInput
            id="category-name"
            value={name}
            error={errors.name}
            placeholder="e.g. Shirts"
            onChange={(e) => {
              setName(e.target.value);
              setErrors((x) => ({ ...x, name: undefined }));
            }}
          />
        </Field>
        <Field
          id="category-slug"
          label="Handle"
          error={errors.slug}
          hint={effectiveSlug ? `Saved as “${effectiveSlug}”. Used in storefront URLs.` : "Used in storefront URLs."}
        >
          <TextInput
            id="category-slug"
            value={slugTouched ? slug : toHandle(name)}
            error={errors.slug}
            placeholder="shirts"
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
              setErrors((x) => ({ ...x, slug: undefined }));
            }}
          />
        </Field>
        <Field id="category-parent" label="Parent category" error={errors.parentId}>
          <SelectField
            id="category-parent"
            value={parentId || "none"}
            options={parentOptions}
            error={errors.parentId}
            onChange={(v) => {
              setParentId(v === "none" ? "" : v);
              setErrors((x) => ({ ...x, parentId: undefined }));
            }}
          />
        </Field>
        <Field id="category-description" label="Description" optional>
          <TextArea id="category-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </SidePanel>
  );
}
