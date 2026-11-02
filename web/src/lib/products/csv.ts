import { toCsv } from "@/lib/csv";
import { listProducts } from "./api";
import { categoryPath } from "./form";
import type { Category, Collection, Product, ProductListQuery, TaxClass } from "./types";

/** Export and import share these headers, so an exported file can be edited and re-imported. */
export const PRODUCT_CSV_HEADERS = [
  "Name",
  "SKU",
  "Status",
  "Price",
  "Discount %",
  "Sale price",
  "Cost price",
  "Stock",
  "Barcode",
  "Category",
  "Collection",
  "Tax class",
  "Tags",
  "Digital",
  "Description",
  "Meta title",
  "Meta description",
  "Image URLs",
] as const;

const num = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "" : String(v));

function productRow(
  p: Product,
  lookups: { categories: Category[]; collections: Collection[]; taxClasses: TaxClass[] }
): string[] {
  const collection = lookups.collections.find((c) => c._id === p.collectionId);
  const tax =
    !p.taxClassId || p.taxClassId === "Default"
      ? "Default"
      : p.taxClassId === "NonTaxable"
        ? "Non-taxable"
        : lookups.taxClasses.find((t) => t._id === p.taxClassId)?.name ?? "";
  return [
    p.name,
    p.sku ?? "",
    p.status,
    num(p.price),
    p.discountPercentage ? String(p.discountPercentage) : "",
    num(p.discountPrice),
    num(p.costPrice),
    num(p.stock),
    p.barcode ?? "",
    categoryPath(p.categoryId, lookups.categories).replace(/ › /g, " > "),
    collection?.title ?? "",
    tax,
    (p.tags ?? []).join("|"),
    p.isDigital ? "yes" : "no",
    p.description ?? "",
    p.metaTitle ?? "",
    p.metaDescription ?? "",
    // Uploaded files are stored inline as data URLs and can't round-trip through CSV; only web URLs are exported.
    (p.images ?? []).filter((u) => /^https?:\/\//i.test(u)).join("|"),
  ];
}

/** Fetches every product matching the list filters (all pages) and builds the CSV text. */
export async function buildProductsCsv(
  query: Omit<ProductListQuery, "page" | "limit">,
  lookups: { categories: Category[]; collections: Collection[]; taxClasses: TaxClass[] },
  onProgress?: (done: number, total: number) => void
): Promise<{ csv: string; count: number }> {
  const pageSize = 100;
  const products: Product[] = [];
  let total = Infinity;
  for (let page = 1; products.length < total; page++) {
    const res = await listProducts({ ...query, page, limit: pageSize });
    total = res.total;
    products.push(...res.products);
    onProgress?.(products.length, total);
    if (res.products.length < pageSize) break;
  }
  return { csv: toCsv([[...PRODUCT_CSV_HEADERS], ...products.map((p) => productRow(p, lookups))]), count: products.length };
}

export function productsCsvTemplate(): string {
  return toCsv([
    [...PRODUCT_CSV_HEADERS],
    ["Cotton T-shirt", "TEE-001", "Published", "799", "", "", "350", "25", "", "Apparel > Shirts", "", "Default", "cotton|basics", "no", "Soft cotton tee", "", "", ""],
  ]);
}
