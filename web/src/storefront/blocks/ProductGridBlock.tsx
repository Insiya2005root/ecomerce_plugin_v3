import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  EditorHint,
  ProductGridSkeleton,
  SectionHeading,
  StorefrontEmptyState,
  StorefrontErrorState,
  StorefrontShell,
} from '../components/StorefrontState';
import { ProductCard } from '../components/ProductCard';
import { storefrontApiClient } from '../services/storefrontApiClient';
import { addProductToCart } from '../cart/cartStore';
import { storefrontLinks } from '../cart/links';
import { priceBounds, shopFilters, useShopFilters } from '../cart/shopFilters';
import { useCategories } from '../cart/storeData';
import type { BlockSettingsMap, PublicProductDTO, StorefrontBlockComponentProps, StorefrontProductsQuery } from '../types/storefront';

/**
 * Columns follow the width of the block itself (container queries), so a grid placed in a narrow page
 * builder column steps down instead of squeezing four cards into it.
 */
const COLS_MOBILE: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2' };
const COLS_TABLET: Record<number, string> = { 1: '@xl:grid-cols-1', 2: '@xl:grid-cols-2', 3: '@xl:grid-cols-3', 4: '@xl:grid-cols-4' };
const COLS_DESKTOP: Record<number, string> = { 2: '@4xl:grid-cols-2', 3: '@4xl:grid-cols-3', 4: '@4xl:grid-cols-4', 5: '@4xl:grid-cols-5', 6: '@4xl:grid-cols-6' };

export function gridColumns(desktop: number, tablet: number, mobile: number): string {
  return cn('grid gap-4 sm:gap-6', COLS_MOBILE[mobile] || COLS_MOBILE[2], COLS_TABLET[tablet] || COLS_TABLET[2], COLS_DESKTOP[desktop] || COLS_DESKTOP[4]);
}

function visiblePages(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 'gap', total];
  if (current >= total - 3) return [1, 'gap', total - 4, total - 3, total - 2, total - 1, total];
  return [1, 'gap', current - 1, current, current + 1, 'gap', total];
}

const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  return Math.min(max, Math.max(min, Number.isFinite(n) && n > 0 ? n : fallback));
};

export function ProductGridBlock({ block, settings, isEditing }: StorefrontBlockComponentProps<BlockSettingsMap>) {
  const source = String(settings.source || 'all').toLowerCase();
  const categoryId = String(settings.categoryId || '').trim();
  const selectedProductIds = String(settings.selectedProductIds || '').trim();
  const sort = (String(settings.sort || 'newest') || 'newest') as StorefrontProductsQuery['sort'];
  const pageSize = num(settings.pageSize, 12, 1, 48);
  const columnsDesktop = num(settings.columnsDesktop, 4, 2, 6);
  const columnsTablet = num(settings.columnsTablet, 2, 1, 4);
  const columnsMobile = num(settings.columnsMobile, 2, 1, 2);
  const showPagination = settings.showPagination !== false;
  const heading = String(settings.heading || '');
  const description = String(settings.description || '');
  const flag = (key: string, alias?: string) =>
    settings[key] !== undefined ? Boolean(settings[key]) : alias && settings[alias] !== undefined ? Boolean(settings[alias]) : true;
  const showAddToCart = settings.showAddToCart !== undefined ? Boolean(settings.showAddToCart) : settings.cardAction !== 'view_only';

  const filters = useShopFilters();
  const followsFilter = source !== 'category' && source !== 'selected' && source !== 'latest';
  const filterCategory = followsFilter ? filters.category : '';
  const filterQuery = followsFilter ? filters.q : '';
  const filterSort = followsFilter ? filters.sort : '';
  const filterPrice = followsFilter ? filters.price : '';

  const categories = useCategories();
  const categoryName = (id: string | null) => (id ? categories.find((c) => c.id === id)?.name : undefined);

  const [products, setProducts] = useState<PublicProductDTO[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageChanging, setPageChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const fetchProducts = useCallback(
    (targetPage: number, initial = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestRef.current;
      if (initial) setLoading(true);
      else setPageChanging(true);
      setError(null);

      const finishEmpty = () => {
        setProducts([]);
        setTotalCount(0);
        setTotalPages(0);
        setLoading(false);
        setPageChanging(false);
      };

      const query: StorefrontProductsQuery = { page: targetPage, limit: pageSize };
      if (source === 'category') {
        if (!categoryId) return finishEmpty();
        query.categoryId = categoryId;
        query.sort = sort;
      } else if (source === 'selected') {
        const ids = selectedProductIds.split(',').map((id) => id.trim()).filter((id) => /^[a-f0-9]{24}$/i.test(id));
        if (ids.length === 0) return finishEmpty();
        query.ids = ids;
        // Keep the order the merchant typed unless another sort was chosen.
        if (sort && sort !== 'newest') query.sort = sort;
      } else if (source === 'latest') {
        query.sort = 'newest';
      } else {
        query.sort = filterSort || sort;
        if (filterCategory) query.categoryId = filterCategory;
        if (filterQuery) query.search = filterQuery;
        Object.assign(query, priceBounds(filterPrice));
      }

      storefrontApiClient
        .getProducts(query, { signal: controller.signal })
        .then((res) => {
          if (requestRef.current !== requestId) return;
          setProducts(res.products || []);
          setTotalCount(res.pagination?.total ?? 0);
          if (followsFilter) shopFilters.setTotal(res.pagination?.total ?? 0);
          setTotalPages(Math.max(1, res.pagination?.totalPages ?? 1));
          setPage(res.pagination?.page ?? targetPage);
          setLoading(false);
          setPageChanging(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (requestRef.current !== requestId) return;
          setError(err instanceof Error && err.message ? err.message : 'Unable to load products.');
          setLoading(false);
          setPageChanging(false);
        });
    },
    [source, categoryId, selectedProductIds, sort, pageSize, filterCategory, filterQuery, filterSort, filterPrice, followsFilter]
  );

  useEffect(() => {
    setPage(1);
    fetchProducts(1, true);
    return () => abortRef.current?.abort();
  }, [fetchProducts]);

  const goTo = (target: number) => {
    if (target < 1 || target > totalPages || target === page || pageChanging) return;
    fetchProducts(target);
    const top = wrapRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onAdd = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product && !isEditing) addProductToCart(product);
  };

  const grid = gridColumns(columnsDesktop, columnsTablet, columnsMobile);
  const filtered = Boolean(filterCategory || filterQuery || filterPrice);

  let body: React.ReactNode;
  if (loading) {
    body = <ProductGridSkeleton count={Math.min(pageSize, columnsDesktop * 2)} className={grid} />;
  } else if (error) {
    body = <StorefrontErrorState title="Products couldn't load" message="Please try again in a moment." onRetry={() => fetchProducts(page, true)} />;
  } else if (products.length === 0 && filtered) {
    body = (
      <StorefrontEmptyState
        title="No products match"
        description={filterQuery ? `Nothing found for "${filterQuery}". Try another word or remove a filter.` : 'Try another category or price range.'}
        action={
          <Button variant="outline" className="cursor-pointer" onClick={() => shopFilters.clear()}>
            Show all products
          </Button>
        }
      />
    );
  } else if (products.length === 0) {
    const unset = (source === 'category' && !categoryId) || (source === 'selected' && !selectedProductIds);
    body =
      isEditing && unset ? (
        <EditorHint>{source === 'category' ? 'Choose a category for this grid in its settings.' : 'Enter product IDs for this grid in its settings.'}</EditorHint>
      ) : (
        <StorefrontEmptyState title="No products yet" description="New products will appear here once they're published." />
      );
  } else {
    body = (
      <>
        <div className={cn(grid, 'transition-opacity', pageChanging && 'pointer-events-none opacity-50')} aria-busy={pageChanging}>
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categoryName={categoryName(product.categoryId)}
              showCategory={flag('showCategory')}
              showSku={Boolean(settings.showSku)}
              showComparePrice={flag('showComparePrice', 'showCompareAtPrice')}
              showDiscountBadge={flag('showDiscountBadge')}
              showStock={flag('showStock', 'showStockBadge')}
              showAddToCart={showAddToCart}
              imageAspect={String(settings.imageAspect || 'square')}
              onAddToCart={onAdd}
              href={storefrontLinks.product(product.slug || product.id)}
            />
          ))}
        </div>
        {showPagination && totalPages > 1 && (
          <Pagination className="mt-10" aria-label="Product pages">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  className={cn('ecom-sf-pagination-btn', page <= 1 && 'pointer-events-none opacity-50')}
                  onClick={(e) => {
                    e.preventDefault();
                    goTo(page - 1);
                  }}
                />
              </PaginationItem>
              {visiblePages(page, totalPages).map((p, i) =>
                p === 'gap' ? (
                  <PaginationItem key={`gap-${i}`} className="hidden sm:block">
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p} className={cn(p !== page && 'hidden sm:block')}>
                    <PaginationLink
                      href="#"
                      isActive={p === page}
                      className="ecom-sf-pagination-btn"
                      aria-label={`Page ${p}`}
                      onClick={(e) => {
                        e.preventDefault();
                        goTo(p);
                      }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  className={cn('ecom-sf-pagination-btn', page >= totalPages && 'pointer-events-none opacity-50')}
                  onClick={(e) => {
                    e.preventDefault();
                    goTo(page + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </>
    );
  }

  return (
    <StorefrontShell>
      <div ref={wrapRef} className="@container scroll-mt-24" data-block-id={block.id} id={followsFilter ? 'ecom-sf-catalog' : undefined}>
        <SectionHeading title={heading} description={description} />
        {!loading && !error && products.length > 0 && settings.showResultCount !== false && (
          <p className="mb-4 text-sm text-muted-foreground">
            Showing {products.length} of {totalCount} {totalCount === 1 ? 'product' : 'products'}
            {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ''}
          </p>
        )}
        {body}
      </div>
    </StorefrontShell>
  );
}
