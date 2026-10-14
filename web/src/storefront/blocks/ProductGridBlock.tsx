import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StorefrontShell, StorefrontLoadingState, StorefrontErrorState, StorefrontEmptyState } from '../components/StorefrontState';
import { ProductCard } from '../components/ProductCard';
import { storefrontApiClient } from '../services/storefrontApiClient';
import type {
  BlockSettingsMap,
  PublicCategoryDTO,
  PublicProductDTO,
  StorefrontBlockComponentProps,
  StorefrontProductsQuery,
} from '../types/storefront';

function getVisiblePageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('ellipsis');
    pages.push(total);
  } else if (current >= total - 3) {
    pages.push(1);
    pages.push('ellipsis');
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push('ellipsis');
    pages.push(current - 1);
    pages.push(current);
    pages.push(current + 1);
    pages.push('ellipsis');
    pages.push(total);
  }
  return pages;
}

export function ProductGridBlock({
  block,
  settings,
  isEditing,
}: StorefrontBlockComponentProps<BlockSettingsMap>) {
  // Extract and normalize settings
  const source = String(settings.source || 'all').toLowerCase();
  const categoryId = typeof settings.categoryId === 'string' ? settings.categoryId.trim() : '';
  const selectedProductIds =
    typeof settings.selectedProductIds === 'string' ? settings.selectedProductIds.trim() : '';
  const sort = (typeof settings.sort === 'string' ? settings.sort : 'newest') as StorefrontProductsQuery['sort'];

  const pageSize = Math.min(
    48,
    Math.max(1, typeof settings.pageSize === 'number' && Number.isFinite(settings.pageSize) ? settings.pageSize : 12)
  );

  const rawColsDesktop = Number(settings.columnsDesktop);
  const columnsDesktop = Math.min(
    6,
    Math.max(1, Number.isFinite(rawColsDesktop) && rawColsDesktop > 0 ? rawColsDesktop : 4)
  );

  const rawColsTablet = Number(settings.columnsTablet);
  const columnsTablet = Math.min(
    4,
    Math.max(1, Number.isFinite(rawColsTablet) && rawColsTablet > 0 ? rawColsTablet : 2)
  );

  const rawColsMobile = Number(settings.columnsMobile);
  const columnsMobile = Math.min(
    2,
    Math.max(1, Number.isFinite(rawColsMobile) && rawColsMobile > 0 ? rawColsMobile : 1)
  );

  // Card display toggles (supporting both new keys and Milestone 2 blueprint aliases)
  const showCategory = settings.showCategory !== undefined ? Boolean(settings.showCategory) : true;
  const showSku = Boolean(settings.showSku);
  const showComparePrice =
    settings.showComparePrice !== undefined
      ? Boolean(settings.showComparePrice)
      : settings.showCompareAtPrice !== undefined
        ? Boolean(settings.showCompareAtPrice)
        : true;
  const showDiscountBadge =
    settings.showDiscountBadge !== undefined ? Boolean(settings.showDiscountBadge) : true;
  const showStock =
    settings.showStock !== undefined
      ? Boolean(settings.showStock)
      : settings.showStockBadge !== undefined
        ? Boolean(settings.showStockBadge)
        : true;
  const showAddToCart =
    settings.showAddToCart !== undefined
      ? Boolean(settings.showAddToCart)
      : settings.cardAction !== undefined
        ? settings.cardAction !== 'view_only'
        : true;

  // Component states
  const [products, setProducts] = useState<PublicProductDTO[]>([]);
  const [categoryMap, setCategoryMap] = useState<Map<string, string>>(new Map());
  const [currencySymbol, setCurrencySymbol] = useState<string>('₹');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [pageChanging, setPageChanging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Track latest request token and AbortController to prevent race conditions / stale responses
  const activeRequestRef = useRef<number>(0);
  const activeAbortRef = useRef<AbortController | null>(null);

  // 1. Fetch metadata (categories & store currency) once on mount
  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    Promise.all([
      storefrontApiClient.getCategories({ signal: controller.signal }).catch(() => null),
      storefrontApiClient.getSettings({ signal: controller.signal }).catch(() => null),
    ]).then(([catRes, setRes]) => {
      if (isCancelled) return;
      if (catRes?.categories && Array.isArray(catRes.categories)) {
        const map = new Map<string, string>();
        for (const c of catRes.categories) {
          map.set(c.id, c.name);
        }
        setCategoryMap(map);
      }
      if (setRes?.settings?.currencySymbol) {
        setCurrencySymbol(setRes.settings.currencySymbol);
      }
    });

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, []);

  // 2. Fetch products based on settings and target page
  const fetchProducts = useCallback(
    (targetPage: number, isInitial: boolean = false) => {
      // Cancel previous in-flight products request
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
      const controller = new AbortController();
      activeAbortRef.current = controller;

      const requestId = ++activeRequestRef.current;
      if (isInitial) {
        setLoading(true);
      } else {
        setPageChanging(true);
      }
      setError(null);

      const query: StorefrontProductsQuery = {
        page: targetPage,
        limit: pageSize,
      };

      // Source routing
      if (source === 'category') {
        if (!categoryId) {
          // No category configured
          if (activeRequestRef.current === requestId) {
            setProducts([]);
            setTotalCount(0);
            setTotalPages(0);
            setLoading(false);
            setPageChanging(false);
          }
          return;
        }
        query.categoryId = categoryId;
        query.sort = sort || 'newest';
      } else if (source === 'selected') {
        const ids = selectedProductIds
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length === 24);

        if (ids.length === 0) {
          if (activeRequestRef.current === requestId) {
            setProducts([]);
            setTotalCount(0);
            setTotalPages(0);
            setLoading(false);
            setPageChanging(false);
          }
          return;
        }
        query.ids = ids;
        // Only attach sort if it's explicitly non-default (e.g. price_asc, price_desc, name_asc, name_desc)
        // This prevents the default 'newest' sort from silently overriding configured selected product order!
        if (sort && ['price_asc', 'price_desc', 'name_asc', 'name_desc'].includes(sort)) {
          query.sort = sort;
        }
      } else if (source === 'latest') {
        query.sort = 'newest';
      } else {
        // 'all' or fallback
        query.sort = sort || 'newest';
      }

      storefrontApiClient
        .getProducts(query, { signal: controller.signal })
        .then((res) => {
          if (activeRequestRef.current !== requestId) return; // Stale response ignored
          setProducts(res.products || []);
          setTotalCount(res.pagination?.total ?? 0);
          setTotalPages(Math.max(1, res.pagination?.totalPages ?? 1));
          setCurrentPage(res.pagination?.page ?? targetPage);
          setLoading(false);
          setPageChanging(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (activeRequestRef.current !== requestId) return;
          const msg =
            err instanceof Error && err.message
              ? err.message
              : 'Unable to load products. Please try again.';
          setError(msg);
          setLoading(false);
          setPageChanging(false);
        });
    },
    [source, categoryId, selectedProductIds, sort, pageSize]
  );

  // Trigger initial fetch or re-fetch when query settings change
  useEffect(() => {
    setCurrentPage(1);
    fetchProducts(1, true);
    return () => {
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
    };
  }, [fetchProducts]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage || pageChanging) {
      return;
    }
    fetchProducts(newPage, false);
  };

  // Reusable Add to Cart contract (infrastructure-ready for Milestone 11)
  const handleAddToCart = (productId: string) => {
    // In Milestone 5, ProductGrid satisfies the callback contract.
    // Real cart drawer/order state will be wired in Milestone 11.
    if (typeof window !== 'undefined' && (window as any).__ECOMMERCE_CART_HANDLER__) {
      (window as any).__ECOMMERCE_CART_HANDLER__(productId);
    }
  };

  // ----------------------------------------------------
  // Render States
  // ----------------------------------------------------

  // A. Initial Loading State
  if (loading) {
    return (
      <StorefrontShell>
        <StorefrontLoadingState label="Loading catalog products..." />
      </StorefrontShell>
    );
  }

  // B. Error State
  if (error) {
    return (
      <StorefrontShell>
        <StorefrontErrorState
          title="Catalog Error"
          message="Unable to display products at this time."
          onRetry={() => fetchProducts(currentPage, true)}
        />
      </StorefrontShell>
    );
  }

  // C. Empty Catalog State
  if (products.length === 0) {
    let emptyTitle = 'No Products Found';
    let emptyDesc = 'Check back soon once new items are published in the catalog.';

    if (source === 'category' && !categoryId) {
      emptyTitle = isEditing ? 'No Category Selected' : 'No Products Available';
      emptyDesc = isEditing
        ? 'Please configure a valid Category ID in the block settings.'
        : 'There are currently no products available in this section.';
    } else if (source === 'selected' && !selectedProductIds) {
      emptyTitle = isEditing ? 'No Products Selected' : 'No Products Available';
      emptyDesc = isEditing
        ? 'Please enter one or more product IDs in block settings.'
        : 'There are currently no featured items available.';
    }

    return (
      <StorefrontShell>
        {isEditing && (
          <div className="ecom-sf-grid-editor-bar mb-4">
            <span className="font-semibold">Product Grid Block ({block.label})</span>
            <div className="ecom-sf-grid-editor-tags">
              <span className="ecom-sf-grid-editor-tag">source: {source}</span>
              <span className="ecom-sf-grid-editor-tag">status: empty</span>
            </div>
          </div>
        )}
        <StorefrontEmptyState title={emptyTitle} description={emptyDesc} />
      </StorefrontShell>
    );
  }

  // D. Populated Product Grid
  const gridStyle = {
    '--grid-cols-desktop': columnsDesktop,
    '--grid-cols-tablet': columnsTablet,
    '--grid-cols-mobile': columnsMobile,
  } as React.CSSProperties;

  return (
    <StorefrontShell>
      <div className="ecom-sf-product-grid-wrap" data-block-id={block.id}>
        {/* Editor Mode Guidance Bar */}
        {isEditing && (
          <aside className="ecom-sf-grid-editor-bar" aria-label="Editor block settings">
            <span className="font-semibold">{block.label}</span>
            <div className="ecom-sf-grid-editor-tags">
              <span className="ecom-sf-grid-editor-tag">source: {source}</span>
              <span className="ecom-sf-grid-editor-tag">sort: {sort || 'newest'}</span>
              <span className="ecom-sf-grid-editor-tag">{totalCount} total products</span>
              <span className="ecom-sf-grid-editor-tag">
                grid: {columnsDesktop}D / {columnsTablet}T / {columnsMobile}M
              </span>
            </div>
          </aside>
        )}

        {/* Results Header */}
        <div className="ecom-sf-product-grid-header">
          <p className="ecom-sf-product-grid-count">
            Showing {products.length} of {totalCount} {totalCount === 1 ? 'product' : 'products'}
          </p>
          {totalPages > 1 && (
            <span className="text-xs text-muted-foreground font-medium">
              Page {currentPage} of {totalPages}
            </span>
          )}
        </div>

        {/* Responsive Grid of ProductCards */}
        <div
          className={`ecom-sf-product-grid ${pageChanging ? 'ecom-sf-product-grid-loading-overlay' : ''}`}
          style={gridStyle}
          role="region"
          aria-label="Products catalog grid"
          aria-busy={pageChanging}
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categoryName={product.categoryId ? categoryMap.get(product.categoryId) : undefined}
              currencySymbol={currencySymbol}
              showCategory={showCategory}
              showSku={showSku}
              showComparePrice={showComparePrice}
              showDiscountBadge={showDiscountBadge}
              showStock={showStock}
              showAddToCart={showAddToCart}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>

        {/* Bounded Pagination Controls */}
        {totalPages > 1 && (
          <nav className="ecom-sf-pagination" aria-label="Product catalog navigation">
            <button
              type="button"
              className="ecom-sf-pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || pageChanging}
              aria-label="Go to previous page"
            >
              Previous
            </button>

            {getVisiblePageNumbers(currentPage, totalPages).map((p, idx) =>
              p === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="ecom-sf-pagination-ellipsis" aria-hidden="true">
                  &hellip;
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`ecom-sf-pagination-btn ${p === currentPage ? 'ecom-sf-pagination-btn-active' : ''}`}
                  onClick={() => handlePageChange(p)}
                  disabled={pageChanging}
                  aria-current={p === currentPage ? 'page' : undefined}
                  aria-label={`Go to page ${p}`}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              className="ecom-sf-pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || pageChanging}
              aria-label="Go to next page"
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </StorefrontShell>
  );
}
