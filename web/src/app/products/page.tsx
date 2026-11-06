'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, ArrowLeft01Icon, ArrowRight01Icon, Download04Icon, PackageIcon, Search01Icon, Upload04Icon } from '@hugeicons/core-free-icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ActionMenu } from '@/components/admin/ActionMenu';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { AdminToaster, toast } from '@/components/admin/toast';
import { SelectField, controlClass, type SelectOption } from '@/components/admin/fields';
import { ProductInventory, ProductPrice, ProductStatusBadge, ProductThumbnail } from '@/components/products/ProductBits';
import { useCategoryOptions, useCollectionOptions } from '@/components/products/ProductFormSections';
import { ProductImportDialog } from '@/components/products/ProductImportDialog';
import { useProductActions } from '@/components/products/useProductActions';
import { useProductReferenceData } from '@/components/products/useProductReferenceData';
import { Input } from '@/components/ui/input';
import { downloadText } from '@/lib/csv';
import { formatDate } from '@/lib/format';
import { buildProductsCsv } from '@/lib/products/csv';
import { listProducts } from '@/lib/products/api';
import { categoryPath } from '@/lib/products/form';
import {
  PRODUCT_SORT_FIELDS,
  PRODUCT_STATUSES,
  type Product,
  type ProductListQuery,
  type ProductSortField,
  type ProductStatus,
} from '@/lib/products/types';
import { productUrls, rememberListQuery } from '@/lib/products/urls';
import { cn } from '@/lib/utils';
import { navigate } from '@/lib/router';

const PAGE_SIZE = 20;

const SORT_OPTIONS: SelectOption[] = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'name:asc', label: 'Name, A–Z' },
  { value: 'name:desc', label: 'Name, Z–A' },
  { value: 'price:asc', label: 'Price, low to high' },
  { value: 'price:desc', label: 'Price, high to low' },
  { value: 'stock:asc', label: 'Stock, low to high' },
  { value: 'stock:desc', label: 'Stock, high to low' },
];
const DEFAULT_SORT = 'createdAt:desc';

const STATUS_OPTIONS: SelectOption[] = [{ value: 'all', label: 'All statuses' }, ...PRODUCT_STATUSES.map((s) => ({ value: s, label: s }))];

type Filters = { q: string; category: string; collection: string; status: string; sort: string; page: number };

// The OpenExt host appends its own params (e.g. __cms_role); only touch ours.
const OWN_PARAMS = ['q', 'category', 'collection', 'status', 'sort', 'page'];

function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  const sort = p.get('sort') ?? DEFAULT_SORT;
  const status = p.get('status') ?? '';
  const page = Number(p.get('page'));
  return {
    q: p.get('q') ?? '',
    category: p.get('category') ?? '',
    collection: p.get('collection') ?? '',
    status: (PRODUCT_STATUSES as readonly string[]).includes(status) ? status : '',
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? sort : DEFAULT_SORT,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function writeFilters(f: Filters) {
  const p = new URLSearchParams(window.location.search);
  OWN_PARAMS.forEach((k) => p.delete(k));
  if (f.q) p.set('q', f.q);
  if (f.category) p.set('category', f.category);
  if (f.collection) p.set('collection', f.collection);
  if (f.status) p.set('status', f.status);
  if (f.sort !== DEFAULT_SORT) p.set('sort', f.sort);
  if (f.page > 1) p.set('page', String(f.page));
  const qs = p.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  const own = new URLSearchParams();
  OWN_PARAMS.forEach((k) => p.get(k) && own.set(k, p.get(k)!));
  rememberListQuery(own.toString());
}

function toQuery(f: Filters): ProductListQuery {
  const [sort, order] = f.sort.split(':') as [ProductSortField, 'asc' | 'desc'];
  return {
    search: f.q.trim() || undefined,
    categoryId: f.category || undefined,
    collectionId: f.collection || undefined,
    status: (f.status as ProductStatus) || undefined,
    sort: PRODUCT_SORT_FIELDS.includes(sort) ? sort : undefined,
    order,
    page: f.page,
    limit: PAGE_SIZE,
  };
}

/** Result of one request, tagged with the request it answers so loading can be derived instead of stored. */
type ListResult = { key: string; products: Product[]; total: number; page: number; error: string | null };

const noSubscribe = () => () => {};
const readSearch = () => window.location.search;

function ProductsList() {
  const { categories, collections, taxClasses } = useProductReferenceData();
  const categoryOptions = useCategoryOptions(categories);
  const collectionOptions = useCollectionOptions(collections);
  const [importOpen, setImportOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState<string | null>(null);

  // The URL is only readable in the browser (static export); the server snapshot is null so hydration matches.
  const initialSearch = React.useSyncExternalStore(noSubscribe, readSearch, () => null);
  const initialFilters = React.useMemo(() => (initialSearch === null ? null : readFilters()), [initialSearch]);
  const [edited, setEdited] = React.useState<Filters | null>(null);
  const filters = edited ?? initialFilters;
  const [searchDraft, setSearchDraft] = React.useState<string | null>(null);
  const searchValue = searchDraft ?? filters?.q ?? '';

  const [reloadKey, setReloadKey] = React.useState(0);
  const [result, setResult] = React.useState<ListResult | null>(null);
  const requestKey = filters ? `${JSON.stringify(filters)}#${reloadKey}` : null;

  React.useEffect(() => {
    if (!filters || !requestKey) return;
    writeFilters(filters);
    const controller = new AbortController();
    listProducts(toQuery(filters), controller.signal)
      .then((res) => {
        // A deletion can leave the current page empty; step back instead of showing a blank page.
        if (res.products.length === 0 && res.total > 0 && filters.page > 1) {
          setEdited({ ...filters, page: Math.max(1, Math.ceil(res.total / PAGE_SIZE)) });
          return;
        }
        setResult({ key: requestKey, products: res.products, total: res.total, page: filters.page, error: null });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setResult((prev) => ({
          key: requestKey,
          products: prev?.products ?? [],
          total: prev?.total ?? 0,
          page: prev?.page ?? 1,
          error: err instanceof Error ? err.message : 'Could not load products.',
        }));
      });
    return () => controller.abort();
  }, [filters, requestKey]);

  // Debounce typing into the search box.
  React.useEffect(() => {
    if (!filters || searchDraft === null || searchDraft === filters.q) return;
    const t = window.setTimeout(() => setEdited({ ...filters, q: searchDraft, page: 1 }), 300);
    return () => window.clearTimeout(t);
  }, [searchDraft, filters]);

  const update = (patch: Partial<Filters>) => filters && setEdited({ ...filters, page: 1, ...patch });
  const goToPage = (page: number) => filters && setEdited({ ...filters, page });
  const clearFilters = () => {
    setSearchDraft('');
    update({ q: '', category: '', collection: '', status: '' });
  };
  const reload = () => setReloadKey((k) => k + 1);

  // Exports every product matching the current filters (all pages), in the same format Import reads.
  const exportCsv = async () => {
    if (!filters) return;
    setExporting('Preparing…');
    try {
      const { search, categoryId, collectionId, status, sort, order } = toQuery(filters);
      const { csv, count } = await buildProductsCsv(
        { search, categoryId, collectionId, status, sort, order },
        { categories, collections, taxClasses },
        (done, total) => setExporting(`${done} of ${total}…`)
      );
      downloadText(`products-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast.success('Export ready', `${count} product${count === 1 ? '' : 's'} exported.`);
    } catch (err) {
      toast.error('Export failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const { menuFor, dialog } = useProductActions({
    includeView: true,
    onUpdated: (p) => {
      // A status change can move the product out of the active status filter.
      if (filters?.status && p.status !== filters.status) reload();
      else setResult((r) => r && { ...r, products: r.products.map((x) => (x._id === p._id ? { ...x, ...p } : x)) });
    },
    onDeleted: (p) => {
      toast.success('Product deleted', p.name);
      reload();
    },
  });

  const loading = result === null || result.key !== requestKey;
  const products = result?.products ?? [];
  const total = result?.total ?? 0;
  const error = loading ? null : result?.error ?? null;
  const state = { products, total, loading, error };

  const hasFilters = Boolean(filters && (filters.q || filters.category || filters.collection || filters.status));
  const page = filters?.page ?? 1;
  // The footer describes the rows currently on screen, not the page still loading.
  const shownPage = result?.page ?? page;
  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  const from = state.total === 0 ? 0 : (shownPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(shownPage * PAGE_SIZE, state.total);
  const firstLoad = state.loading && result === null;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Products' }]}
        title="Products"
        description="Manage the products available in your store."
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-md" onClick={exportCsv} disabled={!filters || exporting !== null}>
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
              {exporting ? `Exporting ${exporting}` : 'Export'}
            </Button>
            <Button variant="outline" size="sm" className="rounded-md" onClick={() => setImportOpen(true)}>
              <HugeiconsIcon icon={Upload04Icon} strokeWidth={2} data-icon="inline-start" />
              Import
            </Button>
            <a href={productUrls.create()} className={cn(buttonVariants({ size: 'sm' }), 'rounded-md')}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
              Create
            </a>
          </>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="relative w-full sm:w-64">
            <HugeiconsIcon
              icon={Search01Icon}
              strokeWidth={2}
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search products by name or SKU"
              placeholder="Search name or SKU"
              value={searchValue}
              onChange={(e) => setSearchDraft(e.target.value)}
              className={cn(controlClass, 'pl-8')}
            />
          </div>
          <SelectField
            id="filter-category"
            value={filters?.category || 'all'}
            options={[{ value: 'all', label: 'All categories' }, ...categoryOptions]}
            onChange={(v) => update({ category: v === 'all' ? '' : v })}
            className="w-full sm:w-48"
          />
          {collectionOptions.length > 0 && (
            <SelectField
              id="filter-collection"
              value={filters?.collection || 'all'}
              options={[{ value: 'all', label: 'All collections' }, ...collectionOptions]}
              onChange={(v) => update({ collection: v === 'all' ? '' : v })}
              className="w-full sm:w-44"
            />
          )}
          <SelectField
            id="filter-status"
            value={filters?.status || 'all'}
            options={STATUS_OPTIONS}
            onChange={(v) => update({ status: v === 'all' ? '' : v })}
            className="w-full sm:w-40"
          />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-md text-muted-foreground"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          )}
          <div className="w-full sm:ml-auto sm:w-48">
            <SelectField
              id="sort"
              value={filters?.sort ?? DEFAULT_SORT}
              options={SORT_OPTIONS}
              onChange={(v) => update({ sort: v || DEFAULT_SORT })}
            />
          </div>
        </div>

        {state.error ? (
          <ErrorState message={state.error} onRetry={reload} />
        ) : !state.loading && state.total === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={Search01Icon}
              title="No products match your filters"
              description="Try a different search term, or clear the filters to see all products."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-md"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={PackageIcon}
              title="No products yet"
              description="Create your first product to start selling."
              action={
                <a href={productUrls.create()} className={cn(buttonVariants({ size: 'sm' }), 'rounded-md')}>
                  Create product
                </a>
              }
            />
          )
        ) : (
          <>
            <Table className={cn('text-[13px]', state.loading && !firstLoad && 'opacity-60 transition-opacity')}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 pl-4 text-xs font-medium text-muted-foreground">Product</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Category</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Price</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Inventory</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Status</TableHead>
                  <TableHead className="hidden h-9 text-xs font-medium text-muted-foreground md:table-cell">Updated</TableHead>
                  <TableHead className="h-9 w-12 pr-4"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firstLoad
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i} className="hover:bg-transparent">
                        <TableCell className="py-2.5 pl-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="size-8 rounded" />
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-40 rounded" />
                              <Skeleton className="h-2.5 w-20 rounded" />
                            </div>
                          </div>
                        </TableCell>
                        {[24, 16, 20, 16, 16].map((w, j) => (
                          <TableCell key={j} className={cn('py-2.5', j === 4 && 'hidden md:table-cell')}>
                            <Skeleton className="h-3 rounded" style={{ width: `${w * 4}px` }} />
                          </TableCell>
                        ))}
                        <TableCell className="pr-4" />
                      </TableRow>
                    ))
                  : state.products.map((p) => (
                      <TableRow
                        key={p._id}
                        className="cursor-pointer"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('a,button,[role="menu"]')) return;
                          navigate(productUrls.detail(p._id));
                        }}
                      >
                        <TableCell className="max-w-[18rem] py-2.5 pl-4">
                          <div className="flex items-center gap-3">
                            <ProductThumbnail src={p.images?.[0]} />
                            <div className="min-w-0">
                              <a
                                href={productUrls.detail(p._id)}
                                className="block truncate font-medium text-foreground hover:underline"
                              >
                                {p.name}
                              </a>
                              {p.sku && <span className="block truncate font-mono text-xs text-muted-foreground">{p.sku}</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[12rem] truncate py-2.5 text-muted-foreground">
                          {categoryPath(p.categoryId, categories) || (p.categoryId ? '—' : 'Uncategorized')}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <ProductPrice product={p} />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <ProductInventory product={p} />
                        </TableCell>
                        <TableCell className="py-2.5">
                          <ProductStatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="hidden py-2.5 text-muted-foreground md:table-cell">{formatDate(p.updatedAt)}</TableCell>
                        <TableCell className="py-2.5 pr-4 text-right">
                          <ActionMenu groups={menuFor(p)} label={`Actions for ${p.name}`} />
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
              <span className="tabular-nums">
                {firstLoad ? 'Loading…' : `${from}–${to} of ${state.total.toLocaleString('en-IN')} results`}
              </span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  Page {shownPage} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="rounded-md"
                  aria-label="Previous page"
                  disabled={page <= 1 || state.loading}
                  onClick={() => goToPage(page - 1)}
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="rounded-md"
                  aria-label="Next page"
                  disabled={page >= pageCount || state.loading}
                  onClick={() => goToPage(page + 1)}
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      {dialog}
      <ProductImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={(r) => {
          if (r.summary.create + r.summary.update > 0) reload();
        }}
      />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <AdminToaster>
      <ProductsList />
    </AdminToaster>
  );
}
