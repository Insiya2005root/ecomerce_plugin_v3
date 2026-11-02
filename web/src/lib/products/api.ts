import type {
  Category,
  CategoryPayload,
  Collection,
  CollectionPayload,
  ImportResponse,
  Product,
  ProductListQuery,
  ProductListResult,
  ProductPayload,
  TaxClass,
} from "./types";

const API_BASE = "/api/plugins/ecommerce-plugin";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }

  let data: { success?: boolean; message?: string } & Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(`Unexpected response from the server (${res.status}).`, res.status);
  }

  if (!res.ok || data.success === false) {
    throw new ApiError(data.message || `Request failed (${res.status}).`, res.status);
  }
  return data as T;
}

export async function listProducts(query: ProductListQuery, signal?: AbortSignal): Promise<ProductListResult> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.collectionId) params.set("collectionId", query.collectionId);
  if (query.status) params.set("status", query.status);
  if (query.sort) params.set("sort", query.sort);
  if (query.order) params.set("order", query.order);
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 20));
  return request<ProductListResult>(`/products?${params}`, { signal });
}

export async function getProduct(id: string): Promise<Product> {
  const data = await request<{ product: Product | null }>(`/products/${encodeURIComponent(id)}`);
  if (!data.product) throw new ApiError("This product no longer exists.", 404);
  return data.product;
}

export async function createProduct(payload: ProductPayload): Promise<Product> {
  const data = await request<{ product: Product }>("/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.product;
}

export async function updateProduct(id: string, payload: ProductPayload): Promise<Product> {
  const data = await request<{ product: Product }>(`/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data.product;
}

export async function deleteProduct(id: string): Promise<void> {
  await request(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Copies a product as a new Draft. SKU, slug and barcode are left for the backend to regenerate/blank. */
export async function duplicateProduct(source: Product): Promise<Product> {
  return createProduct({
    name: `${source.name} (Copy)`,
    description: source.description,
    price: source.price,
    discountPrice: source.discountPrice ?? null,
    discountPercentage: source.discountPercentage ?? 0,
    costPrice: source.costPrice ?? null,
    stock: source.stock ?? 0,
    images: source.images ?? [],
    videos: source.videos ?? [],
    categoryId: source.categoryId,
    collectionId: source.collectionId ?? null,
    status: "Draft",
    taxClassId: source.taxClassId,
    isDigital: source.isDigital ?? false,
    tags: source.tags ?? [],
    metaTitle: source.metaTitle,
    metaDescription: source.metaDescription,
    variants: (source.variants ?? []).map((v) => ({
      size: v.size,
      color: v.color,
      stock: v.stock,
      priceOverride: v.priceOverride ?? null,
    })),
  });
}

/** Validates (dryRun) or applies CSV rows. Rows are objects keyed by the CSV header. */
export async function importProducts(rows: Record<string, string>[], dryRun: boolean): Promise<ImportResponse> {
  return request<ImportResponse>("/products/import", { method: "POST", body: JSON.stringify({ rows, dryRun }) });
}

export async function listCategories(): Promise<Category[]> {
  const data = await request<{ categories: Category[] }>("/categories");
  return data.categories ?? [];
}

export async function getCategory(id: string): Promise<Category> {
  const data = await request<{ category: Category }>(`/categories/${encodeURIComponent(id)}`);
  return data.category;
}

export async function createCategory(payload: CategoryPayload): Promise<Category> {
  const data = await request<{ category: Category }>("/categories", { method: "POST", body: JSON.stringify(payload) });
  return data.category;
}

export async function updateCategory(id: string, payload: Partial<CategoryPayload>): Promise<Category> {
  const data = await request<{ category: Category }>(`/categories/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data.category;
}

/** The backend refuses while subcategories or products exist and explains why in the message. */
export async function deleteCategory(id: string): Promise<void> {
  await request(`/categories/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function listCollections(search?: string): Promise<{ collections: Collection[]; total: number }> {
  const params = new URLSearchParams({ limit: "500" });
  if (search) params.set("search", search);
  return request<{ collections: Collection[]; total: number }>(`/collections?${params}`);
}

export async function getCollection(id: string): Promise<Collection> {
  const data = await request<{ collection: Collection }>(`/collections/${encodeURIComponent(id)}`);
  return data.collection;
}

export async function createCollection(payload: CollectionPayload): Promise<Collection> {
  const data = await request<{ collection: Collection }>("/collections", { method: "POST", body: JSON.stringify(payload) });
  return data.collection;
}

export async function updateCollection(id: string, payload: CollectionPayload): Promise<Collection> {
  const data = await request<{ collection: Collection }>(`/collections/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data.collection;
}

export async function deleteCollection(id: string): Promise<{ detachedProducts: number }> {
  return request<{ detachedProducts: number }>(`/collections/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function updateCollectionProducts(
  id: string,
  change: { add?: string[]; remove?: string[] }
): Promise<{ added: number; removed: number; productCount: number }> {
  return request(`/collections/${encodeURIComponent(id)}/products`, { method: "POST", body: JSON.stringify(change) });
}

export async function listTaxClasses(): Promise<TaxClass[]> {
  const data = await request<{ classes: TaxClass[] }>("/taxes/classes");
  return data.classes ?? [];
}
