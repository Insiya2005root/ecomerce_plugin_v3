export const PRODUCT_STATUSES = ["Draft", "Published", "Archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type ProductVariant = {
  _id?: string;
  size?: string;
  color?: string;
  sku?: string;
  stock?: number;
  priceOverride?: number | null;
};

/** Read-only catalog pricing resolved by the backend DiscountEngine. */
export type ProductPricing = {
  basePrice: number;
  catalogPrice: number;
  compareAtPrice: number | null;
  discountPercentage: number;
};

export type Product = {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  discountPrice?: number | null;
  discountPercentage?: number;
  costPrice?: number | null;
  sku?: string;
  barcode?: string;
  stock?: number;
  images?: string[];
  videos?: string[];
  categoryId?: string;
  collectionId?: string | null;
  status: ProductStatus;
  taxClassId?: string;
  isDigital?: boolean;
  tags?: string[];
  metaTitle?: string;
  metaDescription?: string;
  variants?: ProductVariant[];
  pricing?: ProductPricing;
  createdAt?: string;
  updatedAt?: string;
};

export type ProductPayload = Partial<Omit<Product, "_id" | "pricing" | "createdAt" | "updatedAt" | "slug">>;

export type Category = {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  parentId?: string | null;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CategoryPayload = { name: string; slug: string; description: string; parentId: string | null };

export type Collection = {
  _id: string;
  title: string;
  handle?: string;
  description?: string;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CollectionPayload = { title?: string; handle?: string; description?: string };

export type ImportRowResult = {
  row: number;
  action: "create" | "update" | "error";
  name: string;
  sku: string;
  errors: string[];
  productId?: string;
};

export type ImportResponse = {
  dryRun: boolean;
  summary: { create: number; update: number; error: number };
  results: ImportRowResult[];
};

export type TaxClass = {
  _id: string;
  name: string;
  status?: string;
};

export const PRODUCT_SORT_FIELDS = ["createdAt", "updatedAt", "name", "price", "stock"] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export type ProductListQuery = {
  search?: string;
  categoryId?: string;
  collectionId?: string;
  status?: ProductStatus | "";
  sort?: ProductSortField;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
};

export type ProductListResult = {
  products: Product[];
  total: number;
  page: number;
  limit: number;
};
