import type {
  StorefrontAdminPageDetailResponse,
  StorefrontAdminPageMutationResponse,
  StorefrontAdminPagesListResponse,
  StorefrontApiErrorShape,
  StorefrontCategoriesResponse,
  StorefrontHealthResponse,
  StorefrontPageType,
  StorefrontProductDetailResponse,
  StorefrontProductsQuery,
  StorefrontProductsResponse,
  StorefrontPublicPageResponse,
  StorefrontSettingsResponse,
  StorefrontUpdatePagePayload,
} from '../types/storefront';

export const STOREFRONT_API_BASE = '/api/plugins/ecommerce-plugin/storefront';

export class StorefrontRequestError extends Error implements StorefrontApiErrorShape {
  public readonly status: number;
  public readonly isNotFound: boolean;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'StorefrontRequestError';
    this.status = status;
    this.isNotFound = status === 404;
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
}

async function requestStorefront<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { signal, timeoutMs = 10000, method = 'GET', body } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException('Request aborted', 'AbortError');
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${STOREFRONT_API_BASE}${cleanPath}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    });

    let payload: Record<string, unknown> | null = null;
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = null;
    }

    if (!response.ok || (payload && payload.success === false)) {
      const errorMsg =
        (payload && typeof payload.message === 'string' && payload.message) ||
        (response.status === 404
          ? 'Requested storefront resource was not found.'
          : 'Unable to load storefront data.');
      throw new StorefrontRequestError(errorMsg, response.status);
    }

    if (!payload) {
      throw new StorefrontRequestError('Received empty response from storefront API.', 502);
    }

    return payload as unknown as T;
  } catch (error: unknown) {
    if (error instanceof StorefrontRequestError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    const fallbackMessage =
      error instanceof Error && error.message
        ? error.message
        : 'Network error while connecting to storefront service.';
    throw new StorefrontRequestError(fallbackMessage, 503);
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export const storefrontApiClient = {
  getHealth(options?: RequestOptions): Promise<StorefrontHealthResponse> {
    return requestStorefront<StorefrontHealthResponse>('/health', options);
  },

  getSettings(options?: RequestOptions): Promise<StorefrontSettingsResponse> {
    return requestStorefront<StorefrontSettingsResponse>('/settings', options);
  },

  getCategories(options?: RequestOptions): Promise<StorefrontCategoriesResponse> {
    return requestStorefront<StorefrontCategoriesResponse>('/categories', options);
  },

  getProducts(
    query: StorefrontProductsQuery = {},
    options?: RequestOptions
  ): Promise<StorefrontProductsResponse> {
    const params = new URLSearchParams();
    if (query.search && query.search.trim()) params.set('search', query.search.trim());
    if (query.categoryId && query.categoryId.trim()) {
      params.set('categoryId', query.categoryId.trim());
    }
    if (query.sort) params.set('sort', query.sort);
    if (typeof query.page === 'number' && query.page > 0) {
      params.set('page', String(query.page));
    }
    if (typeof query.limit === 'number' && query.limit > 0) {
      params.set('limit', String(query.limit));
    }
    if (Array.isArray(query.ids) && query.ids.length > 0) {
      params.set('ids', query.ids.join(','));
    }
    if (typeof query.minPrice === 'number' && query.minPrice > 0) params.set('minPrice', String(query.minPrice));
    if (typeof query.maxPrice === 'number' && query.maxPrice >= 0) params.set('maxPrice', String(query.maxPrice));

    const qs = params.toString();
    return requestStorefront<StorefrontProductsResponse>(
      qs ? `/products?${qs}` : '/products',
      options
    );
  },

  getProductBySlugOrId(
    slugOrId: string,
    options?: RequestOptions
  ): Promise<StorefrontProductDetailResponse> {
    const encoded = encodeURIComponent(slugOrId.trim());
    return requestStorefront<StorefrontProductDetailResponse>(`/products/${encoded}`, options);
  },

  getPublicPage(
    pageType: StorefrontPageType,
    options?: RequestOptions
  ): Promise<StorefrontPublicPageResponse> {
    const encoded = encodeURIComponent(pageType);
    return requestStorefront<StorefrontPublicPageResponse>(`/pages/${encoded}`, options);
  },

  getAdminPages(options?: RequestOptions): Promise<StorefrontAdminPagesListResponse> {
    return requestStorefront<StorefrontAdminPagesListResponse>('/admin/pages', options);
  },

  getAdminPage(
    pageType: StorefrontPageType,
    options?: RequestOptions
  ): Promise<StorefrontAdminPageDetailResponse> {
    const encoded = encodeURIComponent(pageType);
    return requestStorefront<StorefrontAdminPageDetailResponse>(
      `/admin/pages/${encoded}`,
      options
    );
  },

  provisionAdminPages(options?: RequestOptions): Promise<StorefrontAdminPagesListResponse> {
    return requestStorefront<StorefrontAdminPagesListResponse>('/admin/pages/provision', {
      ...options,
      method: 'POST',
      body: {},
    });
  },

  updateAdminPage(
    pageType: StorefrontPageType,
    payload: StorefrontUpdatePagePayload,
    options?: RequestOptions
  ): Promise<StorefrontAdminPageMutationResponse> {
    const encoded = encodeURIComponent(pageType);
    return requestStorefront<StorefrontAdminPageMutationResponse>(
      `/admin/pages/${encoded}`,
      {
        ...options,
        method: 'PUT',
        body: payload,
      }
    );
  },

  resetAdminPage(
    pageType: StorefrontPageType,
    confirmReset: boolean,
    options?: RequestOptions
  ): Promise<StorefrontAdminPageMutationResponse> {
    const encoded = encodeURIComponent(pageType);
    return requestStorefront<StorefrontAdminPageMutationResponse>(
      `/admin/pages/${encoded}/reset`,
      {
        ...options,
        method: 'POST',
        body: { confirmReset },
      }
    );
  },
};
