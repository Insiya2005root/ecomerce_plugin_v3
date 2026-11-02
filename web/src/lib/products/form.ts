import type { Product, ProductPayload, ProductStatus } from "./types";

export type VariantFormValues = {
  key: string;
  _id?: string;
  size: string;
  color: string;
  sku: string;
  stock: string;
  priceOverride: string;
};

export type ProductFormValues = {
  name: string;
  description: string;
  status: ProductStatus;
  images: string[];
  videos: string[];
  price: string;
  discountPercentage: string;
  discountPrice: string;
  costPrice: string;
  sku: string;
  barcode: string;
  stock: string;
  variants: VariantFormValues[];
  categoryId: string;
  collectionId: string;
  taxClassId: string;
  tags: string[];
  isDigital: boolean;
  metaTitle: string;
  metaDescription: string;
};

export type ProductSection = "general" | "media" | "pricing" | "inventory" | "variants" | "organization" | "seo";

export const ALL_SECTIONS: ProductSection[] = ["general", "media", "pricing", "inventory", "variants", "organization", "seo"];

export type FormErrors = Partial<Record<string, string>>;

export type FormMode = "create" | "edit";

/** MongoDB rejects documents over 16 MB; media is stored inline as data URLs. */
export const MAX_INLINE_MEDIA_BYTES = 15 * 1024 * 1024;

let keySeed = 0;
export const newKey = () => `v${Date.now().toString(36)}${(keySeed++).toString(36)}`;

const numToString = (value: number | null | undefined) =>
  value === null || value === undefined || Number.isNaN(Number(value)) ? "" : String(value);

export function emptyVariant(): VariantFormValues {
  return { key: newKey(), size: "", color: "", sku: "", stock: "0", priceOverride: "" };
}

export function emptyProductForm(): ProductFormValues {
  return {
    name: "",
    description: "",
    status: "Published",
    images: [],
    videos: [],
    price: "",
    discountPercentage: "0",
    discountPrice: "",
    costPrice: "",
    sku: "",
    barcode: "",
    stock: "",
    variants: [],
    categoryId: "",
    collectionId: "",
    taxClassId: "Default",
    tags: [],
    isDigital: false,
    metaTitle: "",
    metaDescription: "",
  };
}

export function productToForm(p: Product): ProductFormValues {
  return {
    name: p.name ?? "",
    description: p.description ?? "",
    status: p.status ?? "Published",
    images: p.images ?? [],
    videos: p.videos ?? [],
    price: numToString(p.price),
    discountPercentage: numToString(p.discountPercentage ?? 0),
    discountPrice: numToString(p.discountPrice),
    costPrice: numToString(p.costPrice),
    sku: p.sku ?? "",
    barcode: p.barcode ?? "",
    stock: numToString(p.stock),
    variants: (p.variants ?? []).map((v) => ({
      key: v._id || newKey(),
      _id: v._id,
      size: v.size ?? "",
      color: v.color ?? "",
      sku: v.sku ?? "",
      stock: numToString(v.stock ?? 0),
      priceOverride: numToString(v.priceOverride),
    })),
    categoryId: p.categoryId ? String(p.categoryId) : "",
    collectionId: p.collectionId ? String(p.collectionId) : "",
    taxClassId: p.taxClassId || "Default",
    tags: p.tags ?? [],
    isDigital: Boolean(p.isDigital),
    metaTitle: p.metaTitle ?? "",
    metaDescription: p.metaDescription ?? "",
  };
}

const isBlank = (value: string) => value.trim() === "";
const toNumber = (value: string) => Number(value.trim());
const optionalNumber = (value: string) => (isBlank(value) ? null : toNumber(value));
const isNonNegativeNumber = (value: string) => Number.isFinite(toNumber(value)) && toNumber(value) >= 0;
const isNonNegativeInteger = (value: string) => isNonNegativeNumber(value) && Number.isInteger(toNumber(value));

export function dataUrlBytes(values: string[]): number {
  return values.reduce((sum, v) => sum + (v.startsWith("data:") ? Math.floor((v.length - v.indexOf(",") - 1) * 0.75) : 0), 0);
}

export function validateProductForm(values: ProductFormValues, sections: ProductSection[], mode: FormMode): FormErrors {
  const errors: FormErrors = {};
  const has = (s: ProductSection) => sections.includes(s);

  if (has("general") && isBlank(values.name)) errors.name = "Title is required.";

  if (has("pricing")) {
    if (isBlank(values.price)) errors.price = "Price is required.";
    else if (!isNonNegativeNumber(values.price)) errors.price = "Enter a price of 0 or more.";

    if (!isBlank(values.discountPercentage)) {
      const pct = toNumber(values.discountPercentage);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) errors.discountPercentage = "Enter a value between 0 and 100.";
    }
    if (!isBlank(values.discountPrice)) {
      if (!isNonNegativeNumber(values.discountPrice)) errors.discountPrice = "Enter a sale price of 0 or more.";
      else if (!errors.price && toNumber(values.discountPrice) >= toNumber(values.price))
        errors.discountPrice = "Sale price must be lower than the price, or it is ignored at checkout.";
    }
    if (!isBlank(values.costPrice) && !isNonNegativeNumber(values.costPrice)) errors.costPrice = "Enter a cost of 0 or more.";
  }

  if (has("inventory")) {
    if (mode === "edit" && isBlank(values.sku)) errors.sku = "SKU is required for existing products.";
    if (!isBlank(values.stock) && !isNonNegativeInteger(values.stock)) errors.stock = "Stock must be a whole number of 0 or more.";
  }

  if (has("variants")) {
    values.variants.forEach((v, i) => {
      if (isBlank(v.size) && isBlank(v.color)) errors[`variants.${i}.size`] = "Add a size or a color.";
      if (isBlank(v.stock) || !isNonNegativeInteger(v.stock)) errors[`variants.${i}.stock`] = "Whole number, 0 or more.";
      if (!isBlank(v.priceOverride) && !isNonNegativeNumber(v.priceOverride))
        errors[`variants.${i}.priceOverride`] = "Enter 0 or more.";
    });
  }

  if (has("media") && dataUrlBytes([...values.images, ...values.videos]) > MAX_INLINE_MEDIA_BYTES)
    errors.media = "Media is too large to save. Remove some files (limit is about 15 MB per product).";

  if (has("organization") && isBlank(values.categoryId)) errors.categoryId = "Choose a category, or click New category to create one.";

  return errors;
}

/** Builds the API payload for the given sections only, so drawers update just their own fields. */
export function formToPayload(values: ProductFormValues, sections: ProductSection[], mode: FormMode): ProductPayload {
  const payload: ProductPayload = {};
  const has = (s: ProductSection) => sections.includes(s);

  if (has("general")) {
    payload.name = values.name.trim();
    payload.description = values.description;
    payload.status = values.status;
  }
  if (has("media")) {
    payload.images = values.images;
    payload.videos = values.videos;
  }
  if (has("pricing")) {
    payload.price = toNumber(values.price);
    payload.discountPercentage = isBlank(values.discountPercentage) ? 0 : toNumber(values.discountPercentage);
    payload.discountPrice = optionalNumber(values.discountPrice);
    payload.costPrice = optionalNumber(values.costPrice);
  }
  if (has("inventory")) {
    // A blank SKU on create lets the backend generate one.
    if (!(mode === "create" && isBlank(values.sku))) payload.sku = values.sku.trim();
    payload.barcode = values.barcode.trim();
    payload.stock = isBlank(values.stock) ? 0 : toNumber(values.stock);
  }
  if (has("variants")) {
    // Always send the array so removing every variant is persisted.
    payload.variants = values.variants.map((v) => ({
      ...(v._id ? { _id: v._id } : {}),
      size: v.size.trim(),
      color: v.color.trim(),
      sku: v.sku.trim(),
      stock: toNumber(v.stock),
      priceOverride: optionalNumber(v.priceOverride),
    }));
  }
  if (has("organization")) {
    payload.categoryId = values.categoryId;
    payload.collectionId = values.collectionId || null;
    payload.taxClassId = values.taxClassId || "Default";
    payload.tags = values.tags;
    payload.isDigital = values.isDigital;
  }
  if (has("seo")) {
    payload.metaTitle = values.metaTitle.trim();
    payload.metaDescription = values.metaDescription.trim();
  }
  return payload;
}

export function totalInventory(p: Pick<Product, "stock" | "variants">): number {
  if (p.variants && p.variants.length > 0) return p.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  return Number(p.stock) || 0;
}

export function categoryPath(categoryId: string | undefined, categories: { _id: string; name: string; parentId?: string | null }[]): string {
  if (!categoryId) return "";
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const parts: string[] = [];
  let current = byId.get(String(categoryId));
  const seen = new Set<string>();
  while (current && !seen.has(String(current._id))) {
    seen.add(String(current._id));
    parts.unshift(current.name);
    current = current.parentId ? byId.get(String(current.parentId)) : undefined;
  }
  return parts.join(" › ");
}
