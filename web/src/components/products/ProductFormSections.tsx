"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, CloudUploadIcon, Delete02Icon, StarIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  AffixInput,
  CheckboxField,
  Field,
  SelectField,
  TagInput,
  TextArea,
  TextInput,
  type SelectOption,
} from "@/components/admin/fields";
import { InlineError } from "@/components/admin/StateViews";
import { CategoryDrawer } from "@/components/categories/CategoryDrawer";
import { CURRENCY_SYMBOL } from "@/lib/format";
import {
  MAX_INLINE_MEDIA_BYTES,
  categoryPath,
  dataUrlBytes,
  emptyVariant,
  type FormErrors,
  type FormMode,
  type ProductFormValues,
  type VariantFormValues,
} from "@/lib/products/form";
import { PRODUCT_STATUSES, type Category, type Collection, type TaxClass } from "@/lib/products/types";
import { cn } from "@/lib/utils";

export type SectionProps = {
  values: ProductFormValues;
  onChange: (patch: Partial<ProductFormValues>) => void;
  errors: FormErrors;
};

const STATUS_OPTIONS: SelectOption[] = PRODUCT_STATUSES.map((s) => ({ value: s, label: s }));

export function GeneralFields({ values, onChange, errors, showStatus = true }: SectionProps & { showStatus?: boolean }) {
  return (
    <div className="space-y-4">
      <Field id="name" label="Title" error={errors.name}>
        <TextInput
          id="name"
          value={values.name}
          error={errors.name}
          placeholder="e.g. Cotton crew-neck T-shirt"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </Field>
      <Field id="description" label="Description" optional>
        <TextArea
          id="description"
          rows={5}
          value={values.description}
          placeholder="Describe the product for customers."
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>
      {showStatus && (
        <Field id="status" label="Status" hint="Only Published products are visible and purchasable on the storefront.">
          <SelectField
            id="status"
            value={values.status}
            options={STATUS_OPTIONS}
            onChange={(v) => onChange({ status: v as ProductFormValues["status"] })}
          />
        </Field>
      )}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaField({ values, onChange, errors }: SectionProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [reading, setReading] = React.useState(0);
  const [rejected, setRejected] = React.useState<string | null>(null);

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    const accepted = files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    setRejected(accepted.length < files.length ? "Only image and video files can be added." : null);
    if (accepted.length === 0) return;
    setReading(accepted.length);
    // Read every file first, then apply a single update so concurrent reads can't overwrite each other.
    const results = await Promise.all(
      accepted.map(
        (file) =>
          new Promise<{ video: boolean; url: string } | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ video: file.type.startsWith("video/"), url: String(reader.result) });
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          })
      )
    );
    setReading(0);
    const ok = results.filter((r): r is { video: boolean; url: string } => r !== null);
    if (ok.length < accepted.length) setRejected("Some files could not be read.");
    onChange({
      images: [...values.images, ...ok.filter((r) => !r.video).map((r) => r.url)],
      videos: [...values.videos, ...ok.filter((r) => r.video).map((r) => r.url)],
    });
  };

  const usedBytes = dataUrlBytes([...values.images, ...values.videos]);
  const hasMedia = values.images.length + values.videos.length > 0;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? "border-ring bg-muted/60" : "bg-muted/20"
        }`}
      >
        <HugeiconsIcon icon={CloudUploadIcon} strokeWidth={1.75} className="size-5 text-muted-foreground" />
        <p className="text-[13px] text-foreground">
          Drag images or videos here, or{" "}
          <button type="button" className="font-medium underline underline-offset-2" onClick={() => inputRef.current?.click()}>
            browse
          </button>
        </p>
        <p className="text-xs text-muted-foreground">The first image is used as the product thumbnail.</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {reading > 0 && <p className="text-xs text-muted-foreground">Processing {reading} file{reading === 1 ? "" : "s"}…</p>}
      {rejected && <p className="text-xs text-destructive">{rejected}</p>}
      {errors.media && <InlineError message={errors.media} />}

      {hasMedia && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {values.images.map((src, i) => (
            <li key={`img-${i}`} className="group relative aspect-square overflow-hidden rounded-md border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URLs / external URLs, no Next image loader in static export */}
              <img src={src} alt={`Product image ${i + 1}`} className="size-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] font-medium shadow-xs">
                  Thumbnail
                </span>
              )}
              <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                {i > 0 && (
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="outline"
                    className="rounded bg-background/95"
                    aria-label="Use as thumbnail"
                    title="Use as thumbnail"
                    onClick={() => onChange({ images: [src, ...values.images.filter((_, idx) => idx !== i)] })}
                  >
                    <HugeiconsIcon icon={StarIcon} strokeWidth={2} />
                  </Button>
                )}
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  className="rounded bg-background/95 text-destructive"
                  aria-label="Remove image"
                  title="Remove image"
                  onClick={() => onChange({ images: values.images.filter((_, idx) => idx !== i) })}
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                </Button>
              </div>
            </li>
          ))}
          {values.videos.map((src, i) => (
            <li key={`vid-${i}`} className="group relative aspect-square overflow-hidden rounded-md border bg-black">
              <video src={src} className="size-full object-cover" controls preload="metadata" />
              <span className="absolute top-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] font-medium shadow-xs">Video</span>
              <Button
                type="button"
                size="icon-xs"
                variant="outline"
                className="absolute top-1 right-1 rounded bg-background/95 text-destructive"
                aria-label="Remove video"
                title="Remove video"
                onClick={() => onChange({ videos: values.videos.filter((_, idx) => idx !== i) })}
              >
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {usedBytes > 0 && (
        <p className={`text-xs ${usedBytes > MAX_INLINE_MEDIA_BYTES ? "text-destructive" : "text-muted-foreground"}`}>
          Uploaded media: {formatBytes(usedBytes)} of about {formatBytes(MAX_INLINE_MEDIA_BYTES)}. Files are stored inside the product record.
        </p>
      )}
    </div>
  );
}

export function PricingFields({ values, onChange, errors }: SectionProps) {
  const pctActive = Number(values.discountPercentage) > 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="price" label="Price" error={errors.price}>
          <AffixInput
            id="price"
            prefix={CURRENCY_SYMBOL}
            value={values.price}
            error={errors.price}
            placeholder="0.00"
            onChange={(e) => onChange({ price: e.target.value })}
          />
        </Field>
        <Field id="costPrice" label="Cost per item" optional error={errors.costPrice} hint="Not shown to customers.">
          <AffixInput
            id="costPrice"
            prefix={CURRENCY_SYMBOL}
            value={values.costPrice}
            error={errors.costPrice}
            placeholder="0.00"
            onChange={(e) => onChange({ costPrice: e.target.value })}
          />
        </Field>
        <Field id="discountPercentage" label="Discount" optional error={errors.discountPercentage}>
          <AffixInput
            id="discountPercentage"
            suffix="%"
            value={values.discountPercentage}
            error={errors.discountPercentage}
            placeholder="0"
            onChange={(e) => onChange({ discountPercentage: e.target.value })}
          />
        </Field>
        <Field
          id="discountPrice"
          label="Sale price"
          optional
          error={errors.discountPrice}
          hint={pctActive ? "Ignored while a discount % is set." : "Fixed price shown instead of the regular price."}
        >
          <AffixInput
            id="discountPrice"
            prefix={CURRENCY_SYMBOL}
            value={values.discountPrice}
            error={errors.discountPrice}
            placeholder="0.00"
            onChange={(e) => onChange({ discountPrice: e.target.value })}
          />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        If both are set, the discount % takes priority over the sale price. Variant price overrides replace the base price
        for that variant.
      </p>
    </div>
  );
}

export function InventoryFields({ values, onChange, errors, mode }: SectionProps & { mode: FormMode }) {
  const hasVariants = values.variants.length > 0;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id="sku"
        label="SKU"
        optional={mode === "create"}
        error={errors.sku}
        hint={mode === "create" ? "Leave blank to generate one automatically." : undefined}
      >
        <TextInput id="sku" value={values.sku} error={errors.sku} onChange={(e) => onChange({ sku: e.target.value })} />
      </Field>
      <Field id="barcode" label="Barcode" optional hint="ISBN, UPC, GTIN, etc.">
        <TextInput id="barcode" value={values.barcode} onChange={(e) => onChange({ barcode: e.target.value })} />
      </Field>
      <Field
        id="stock"
        label="Stock quantity"
        error={errors.stock}
        hint={hasVariants ? "Managed per variant while this product has variants." : undefined}
      >
        <AffixInput
          id="stock"
          inputMode="numeric"
          value={values.stock}
          error={errors.stock}
          placeholder="0"
          disabled={hasVariants}
          onChange={(e) => onChange({ stock: e.target.value })}
        />
      </Field>
    </div>
  );
}

export function VariantsEditor({ values, onChange, errors }: SectionProps) {
  const update = (index: number, patch: Partial<VariantFormValues>) =>
    onChange({ variants: values.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)) });

  return (
    <div className="space-y-3">
      {values.variants.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          No variants. This product uses a single price and the stock quantity above.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 font-medium">Size</th>
                <th className="px-2 py-2 font-medium">Color</th>
                <th className="px-2 py-2 font-medium">SKU</th>
                <th className="w-24 px-2 py-2 font-medium">Stock</th>
                <th className="w-32 px-2 py-2 font-medium">Price override</th>
                <th className="w-10 px-2 py-2" aria-label="Remove" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {values.variants.map((v, i) => {
                const sizeErr = errors[`variants.${i}.size`];
                const stockErr = errors[`variants.${i}.stock`];
                const priceErr = errors[`variants.${i}.priceOverride`];
                return (
                  <tr key={v.key} className="align-top">
                    <td className="px-2 py-1.5">
                      <TextInput id={`variant-${i}-size`} aria-label={`Variant ${i + 1} size`} value={v.size} error={sizeErr} placeholder="e.g. XL" onChange={(e) => update(i, { size: e.target.value })} />
                      {sizeErr && <p className="mt-1 text-xs text-destructive">{sizeErr}</p>}
                    </td>
                    <td className="px-2 py-1.5">
                      <TextInput id={`variant-${i}-color`} aria-label={`Variant ${i + 1} color`} value={v.color} placeholder="e.g. Red" onChange={(e) => update(i, { color: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <TextInput id={`variant-${i}-sku`} aria-label={`Variant ${i + 1} SKU`} value={v.sku} placeholder="Optional" onChange={(e) => update(i, { sku: e.target.value })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <AffixInput id={`variant-${i}-stock`} aria-label={`Variant ${i + 1} stock`} inputMode="numeric" value={v.stock} error={stockErr} onChange={(e) => update(i, { stock: e.target.value })} />
                      {stockErr && <p className="mt-1 text-xs text-destructive">{stockErr}</p>}
                    </td>
                    <td className="px-2 py-1.5">
                      <AffixInput id={`variant-${i}-price`} aria-label={`Variant ${i + 1} price override`} prefix={CURRENCY_SYMBOL} value={v.priceOverride} error={priceErr} placeholder="Base" onChange={(e) => update(i, { priceOverride: e.target.value })} />
                      {priceErr && <p className="mt-1 text-xs text-destructive">{priceErr}</p>}
                    </td>
                    <td className="px-2 py-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-md text-muted-foreground hover:text-destructive"
                        aria-label={`Remove variant ${i + 1}`}
                        onClick={() => onChange({ variants: values.variants.filter((_, idx) => idx !== i) })}
                      >
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-md"
        onClick={() => onChange({ variants: [...values.variants, emptyVariant()] })}
      >
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
        Add variant
      </Button>
    </div>
  );
}

export function useCategoryOptions(categories: Category[]): SelectOption[] {
  return React.useMemo(
    () =>
      categories
        .map((c) => ({ value: String(c._id), label: categoryPath(String(c._id), categories) || c.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [categories]
  );
}

export function useTaxOptions(taxClasses: TaxClass[], current: string): SelectOption[] {
  return React.useMemo(
    () => [
      { value: "Default", label: "Default (store setting)" },
      { value: "NonTaxable", label: "Non-taxable" },
      ...taxClasses
        .filter((c) => c.status === "Active" || String(c._id) === current)
        .map((c) => ({ value: String(c._id), label: c.status === "Active" ? c.name : `${c.name} (inactive)` })),
    ],
    [taxClasses, current]
  );
}

export function useCollectionOptions(collections: Collection[]): SelectOption[] {
  return React.useMemo(() => collections.map((c) => ({ value: String(c._id), label: c.title })), [collections]);
}

export function OrganizationFields({
  values,
  onChange,
  errors,
  categories,
  collections,
  taxClasses,
}: SectionProps & { categories: Category[]; collections: Collection[]; taxClasses: TaxClass[] }) {
  // Categories created from this form (shown straight away, without reloading the page's category list).
  const [createdCategories, setCreatedCategories] = React.useState<Category[]>([]);
  const [creatingCategory, setCreatingCategory] = React.useState(false);
  const allCategories = React.useMemo(
    () => [...categories, ...createdCategories.filter((c) => !categories.some((x) => String(x._id) === String(c._id)))],
    [categories, createdCategories]
  );
  const categoryOptions = useCategoryOptions(allCategories);
  const collectionOptions = useCollectionOptions(collections);
  const taxOptions = useTaxOptions(taxClasses, values.taxClassId);
  return (
    <div className="space-y-4">
      <Field
        id="collectionId"
        label="Collection"
        optional
        hint={collectionOptions.length === 0 ? "No collections yet. Create one under Products › Collections." : "A product can be in one collection."}
      >
        <SelectField
          id="collectionId"
          value={values.collectionId || "none"}
          options={[{ value: "none", label: "No collection" }, ...collectionOptions]}
          onChange={(v) => onChange({ collectionId: v === "none" ? "" : v })}
        />
      </Field>
      <Field
        id="categoryId"
        label="Category"
        error={errors.categoryId}
        hint={categoryOptions.length === 0 ? "No categories yet. Create the first one here." : undefined}
      >
        <div className="space-y-1.5">
          {categoryOptions.length > 0 && (
            <SelectField
              id="categoryId"
              value={values.categoryId}
              options={categoryOptions}
              placeholder="Choose a category"
              error={errors.categoryId}
              onChange={(v) => onChange({ categoryId: v })}
            />
          )}
          <Button
            type="button"
            variant={categoryOptions.length === 0 ? "outline" : "ghost"}
            size="sm"
            className={cn("rounded-md", categoryOptions.length === 0 ? "h-8 w-full" : "-ml-2 h-7 text-muted-foreground hover:text-foreground")}
            onClick={() => setCreatingCategory(true)}
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            {categoryOptions.length === 0 ? "Create a category" : "New category"}
          </Button>
        </div>
      </Field>
      <CategoryDrawer
        open={creatingCategory}
        categories={allCategories}
        onClose={() => setCreatingCategory(false)}
        onSaved={(created) => {
          setCreatedCategories((list) => [...list, created]);
          onChange({ categoryId: String(created._id) });
          setCreatingCategory(false);
        }}
      />
      <Field id="taxClassId" label="Tax class" hint="Used by the tax engine to find the matching tax rule.">
        <SelectField id="taxClassId" value={values.taxClassId} options={taxOptions} onChange={(v) => onChange({ taxClassId: v || "Default" })} />
      </Field>
      <Field id="tags" label="Tags" optional hint="Shown with the product in storefront data.">
        <TagInput id="tags" value={values.tags} onChange={(tags) => onChange({ tags })} />
      </Field>
      <CheckboxField
        id="isDigital"
        checked={values.isDigital}
        onChange={(isDigital) => onChange({ isDigital })}
        label="Digital product"
        hint="Marks the product as digital in storefront data. Shipping calculation does not use this flag yet."
      />
    </div>
  );
}

export function SeoFields({ values, onChange }: SectionProps) {
  const title = values.metaTitle || values.name || "Product title";
  const description = values.metaDescription || values.description?.slice(0, 160) || "Add a description to control how this product appears in search results.";
  return (
    <div className="space-y-4">
      <Field id="metaTitle" label="Page title" optional hint={`${values.metaTitle.length} of 60 characters recommended`}>
        <TextInput id="metaTitle" value={values.metaTitle} placeholder={values.name} onChange={(e) => onChange({ metaTitle: e.target.value })} />
      </Field>
      <Field id="metaDescription" label="Meta description" optional hint={`${values.metaDescription.length} of 160 characters recommended`}>
        <TextArea id="metaDescription" rows={3} value={values.metaDescription} onChange={(e) => onChange({ metaDescription: e.target.value })} />
      </Field>
      <div className="rounded-md border bg-muted/20 p-3">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Search engine preview</p>
        <p className="truncate text-[15px] text-[#1a0dab] dark:text-sky-400">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
