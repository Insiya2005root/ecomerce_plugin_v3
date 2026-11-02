'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon, Download04Icon, Edit02Icon, PackageIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { SelectField, controlClass, type SelectOption } from '@/components/admin/fields';
import { AdminToaster, toast } from '@/components/admin/toast';
import { AvailableCell, ItemFlags } from '@/components/inventory/InventoryBits';
import { ProductThumbnail } from '@/components/products/ProductBits';
import { downloadText, toCsv } from '@/lib/csv';
import { UNASSIGNED_LOCATION, listInventory, type InventoryItemRow, type InventoryQuery, type InventorySummary } from '@/lib/inventory';
import { inventoryUrls } from '@/lib/products/urls';
import { listLocations, type Location } from '@/lib/settings';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const STOCK_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All stock' },
  { value: 'in', label: 'In stock' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
  { value: 'reserved', label: 'Has reservations' },
];
const SORT_OPTIONS: SelectOption[] = [
  { value: 'title:asc', label: 'Name, A–Z' },
  { value: 'available:asc', label: 'Available, low to high' },
  { value: 'available:desc', label: 'Available, high to low' },
  { value: 'reserved:desc', label: 'Most reserved' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
];

type Filters = { q: string; location: string; stock: string; sort: string; page: number };
const OWN_PARAMS = ['q', 'location', 'stock', 'sort', 'page'];

function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  const page = Number(p.get('page'));
  const sort = p.get('sort') ?? 'title:asc';
  const stock = p.get('stock') ?? '';
  return {
    q: p.get('q') ?? '',
    location: p.get('location') ?? '',
    stock: STOCK_OPTIONS.some((o) => o.value === stock) ? stock : '',
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? sort : 'title:asc',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function writeFilters(f: Filters) {
  const p = new URLSearchParams(window.location.search);
  OWN_PARAMS.forEach((k) => p.delete(k));
  if (f.q) p.set('q', f.q);
  if (f.location) p.set('location', f.location);
  if (f.stock) p.set('stock', f.stock);
  if (f.sort !== 'title:asc') p.set('sort', f.sort);
  if (f.page > 1) p.set('page', String(f.page));
  const qs = p.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

function toQuery(f: Filters, page: number, limit: number): InventoryQuery {
  const [sort, order] = f.sort.split(':') as [InventoryQuery['sort'], 'asc' | 'desc'];
  return { search: f.q.trim() || undefined, locationId: f.location || undefined, stock: (f.stock || undefined) as InventoryQuery['stock'], sort, order, page, limit };
}

const noSubscribe = () => () => {};
const readSearch = () => window.location.search;

function SummaryTile({ label, value, hint, tone, active, onClick, href }: { label: string; value: number; hint: string; tone?: string; active?: boolean; onClick?: () => void; href?: string }) {
  const body = (
    <>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', value > 0 && tone)}>{value.toLocaleString('en-IN')}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </>
  );
  const cls = cn('rounded-lg border bg-card p-4 text-left shadow-xs transition-colors hover:bg-muted/30', active && 'border-foreground/40 ring-1 ring-foreground/10');
  return href ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
      {body}
    </button>
  );
}

function InventoryList() {
  const initialSearch = React.useSyncExternalStore(noSubscribe, readSearch, () => null);
  const initialFilters = React.useMemo(() => (initialSearch === null ? null : readFilters()), [initialSearch]);
  const [edited, setEdited] = React.useState<Filters | null>(null);
  const filters = edited ?? initialFilters;
  const [searchDraft, setSearchDraft] = React.useState<string | null>(null);
  const searchValue = searchDraft ?? filters?.q ?? '';
  const [reloadKey, setReloadKey] = React.useState(0);
  const [exporting, setExporting] = React.useState(false);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [result, setResult] = React.useState<{ key: string; items: InventoryItemRow[]; total: number; page: number; summary: InventorySummary | null; low: number; error: string | null } | null>(null);
  const requestKey = filters ? `${JSON.stringify(filters)}#${reloadKey}` : null;

  React.useEffect(() => {
    listLocations()
      .then(setLocations)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!filters || !requestKey) return;
    writeFilters(filters);
    const controller = new AbortController();
    listInventory(toQuery(filters, filters.page, PAGE_SIZE), controller.signal)
      .then((res) => setResult({ key: requestKey, items: res.items, total: res.total, page: filters.page, summary: res.summary, low: res.lowStockThreshold, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setResult((prev) => ({ key: requestKey, items: prev?.items ?? [], total: prev?.total ?? 0, page: prev?.page ?? 1, summary: prev?.summary ?? null, low: prev?.low ?? 5, error: err instanceof Error ? err.message : 'Could not load inventory.' }));
      });
    return () => controller.abort();
  }, [filters, requestKey]);

  React.useEffect(() => {
    if (!filters || searchDraft === null || searchDraft === filters.q) return;
    const t = window.setTimeout(() => setEdited({ ...filters, q: searchDraft, page: 1 }), 300);
    return () => window.clearTimeout(t);
  }, [searchDraft, filters]);

  const update = (patch: Partial<Filters>) => filters && setEdited({ ...filters, page: 1, ...patch });
  const clearFilters = () => {
    setSearchDraft('');
    update({ q: '', location: '', stock: '' });
  };

  const exportCsv = async () => {
    if (!filters) return;
    setExporting(true);
    try {
      const rows: InventoryItemRow[] = [];
      for (let page = 1; ; page++) {
        const res = await listInventory(toQuery(filters, page, 100));
        rows.push(...res.items);
        if (rows.length >= res.total || res.items.length === 0) break;
      }
      downloadText(
        `inventory-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv([
          ['Item', 'Variant', 'SKU', 'Stocked', 'Reserved', 'Available', 'Incoming', 'Locations', 'Track inventory', 'Allow backorders'],
          ...rows.map((r) => [r.productName, r.variantLabel ?? '', r.sku ?? '', String(r.stocked), String(r.reserved), String(r.available), String(r.incoming), String(r.locations), r.trackInventory ? 'Yes' : 'No', r.allowBackorder ? 'Yes' : 'No']),
        ])
      );
      toast.success('Export ready', `${rows.length} item${rows.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error('Export failed', err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(false);
    }
  };

  const loading = result === null || result.key !== requestKey;
  const error = loading ? null : result?.error ?? null;
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const summary = result?.summary ?? null;
  const shownPage = result?.page ?? 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstLoad = loading && result === null;
  const hasFilters = Boolean(filters && (filters.q || filters.location || filters.stock));
  const locationOptions: SelectOption[] = [
    { value: 'all', label: 'All locations' },
    ...locations.map((l) => ({ value: l._id, label: l.name })),
    ...(locations.length === 0 ? [{ value: UNASSIGNED_LOCATION, label: 'Unassigned' }] : []),
  ];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Inventory' }]}
        title="Inventory"
        description="Stock for every product and variant, per location."
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-md" onClick={exportCsv} disabled={exporting || total === 0}>
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
              {exporting ? 'Exporting…' : 'Export'}
            </Button>
            <a href={inventoryUrls.stock()} className={cn(buttonVariants({ size: 'sm' }), 'rounded-md')}>
              <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} data-icon="inline-start" />
              Edit stock levels
            </a>
          </>
        }
      />

      {locations.length === 0 && !firstLoad && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-50 px-4 py-3 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          Your stock is not at any location yet. Add your store or warehouse under Settings → Locations and it will move there automatically.
        </div>
      )}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Items" value={summary.items} hint={`${summary.stockedUnits.toLocaleString('en-IN')} units on the shelf`} active={!filters?.stock} onClick={() => update({ stock: '' })} />
          <SummaryTile label="Low stock" value={summary.lowStock} hint={`${result?.low ?? 5} or fewer available`} tone="text-amber-700 dark:text-amber-300" active={filters?.stock === 'low'} onClick={() => update({ stock: 'low' })} />
          <SummaryTile label="Out of stock" value={summary.outOfStock} hint="Nothing left to sell" tone="text-red-600 dark:text-red-400" active={filters?.stock === 'out'} onClick={() => update({ stock: 'out' })} />
          <SummaryTile label="Reserved" value={summary.reservedUnits} hint="Units held for orders" href={inventoryUrls.reservations()} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[86px] rounded-lg" />)}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="relative w-full sm:w-64">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" aria-label="Search inventory" placeholder="Name or SKU" value={searchValue} onChange={(e) => setSearchDraft(e.target.value)} className={cn(controlClass, 'pl-8')} />
          </div>
          <SelectField id="filter-location" value={filters?.location || 'all'} options={locationOptions} onChange={(v) => update({ location: v === 'all' ? '' : v })} className="w-full sm:w-44" />
          <SelectField id="filter-stock" value={filters?.stock || 'all'} options={STOCK_OPTIONS} onChange={(v) => update({ stock: v === 'all' ? '' : v })} className="w-full sm:w-44" />
          {hasFilters && (
            <Button variant="ghost" size="sm" className="rounded-md text-muted-foreground" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          <div className="w-full sm:ml-auto sm:w-52">
            <SelectField id="sort" value={filters?.sort ?? 'title:asc'} options={SORT_OPTIONS} onChange={(v) => update({ sort: v || 'title:asc' })} />
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !loading && total === 0 ? (
          hasFilters ? (
            <EmptyState icon={Search01Icon} title="Nothing matches your filters" action={<Button variant="outline" size="sm" className="rounded-md" onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState icon={PackageIcon} title="No inventory yet" description="Inventory items are created for every product and variant automatically." />
          )
        ) : (
          <>
            <Table className={cn('text-[13px]', loading && !firstLoad && 'opacity-60 transition-opacity')}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 pl-4 text-xs font-medium text-muted-foreground">Item</TableHead>
                  <TableHead className="h-9 text-right text-xs font-medium text-muted-foreground">Reserved</TableHead>
                  <TableHead className="h-9 text-right text-xs font-medium text-muted-foreground">In stock</TableHead>
                  <TableHead className="h-9 pr-4 text-right text-xs font-medium text-muted-foreground">Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firstLoad
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i} className="hover:bg-transparent">
                        {[48, 12, 20, 16].map((w, j) => (
                          <TableCell key={j} className={cn('py-3', j === 0 && 'pl-4', j === 3 && 'pr-4')}>
                            <Skeleton className="h-3 rounded" style={{ width: `${w * 4}px` }} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : items.map((r) => (
                      <TableRow
                        key={r._id}
                        className="cursor-pointer"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('a,button')) return;
                          window.location.href = inventoryUrls.detail(r._id);
                        }}
                      >
                        <TableCell className="max-w-[24rem] py-2.5 pl-4">
                          <span className="flex min-w-0 items-center gap-3">
                            <ProductThumbnail src={r.image ?? undefined} />
                            <span className="min-w-0">
                              <a href={inventoryUrls.detail(r._id)} className="block truncate font-medium hover:underline">
                                {r.productName}
                                {r.variantLabel && <span className="font-normal text-muted-foreground"> · {r.variantLabel}</span>}
                              </a>
                              <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                {r.sku && <span className="font-mono">{r.sku}</span>}
                                <ItemFlags item={r} />
                              </span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-right tabular-nums">{r.reserved || <span className="text-muted-foreground">0</span>}</TableCell>
                        <TableCell className="py-2.5 text-right tabular-nums">
                          {r.stocked.toLocaleString('en-IN')}
                          <span className="block text-xs text-muted-foreground">
                            {r.locations} location{r.locations === 1 ? '' : 's'}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 pr-4 text-right">
                          <AvailableCell item={r} low={result?.low ?? 5} />
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
              <span className="tabular-nums">{firstLoad ? 'Loading…' : `${total === 0 ? 0 : (shownPage - 1) * PAGE_SIZE + 1}–${Math.min(shownPage * PAGE_SIZE, total)} of ${total.toLocaleString('en-IN')} items`}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  Page {shownPage} of {pageCount}
                </span>
                <Button variant="outline" size="icon-sm" className="rounded-md" aria-label="Previous page" disabled={(filters?.page ?? 1) <= 1 || loading} onClick={() => filters && setEdited({ ...filters, page: filters.page - 1 })}>
                  <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                </Button>
                <Button variant="outline" size="icon-sm" className="rounded-md" aria-label="Next page" disabled={(filters?.page ?? 1) >= pageCount || loading} onClick={() => filters && setEdited({ ...filters, page: filters.page + 1 })}>
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">In stock = units on the shelf. Reserved = held for orders that aren&apos;t packed yet. Available = what can still be sold.</p>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <AdminToaster>
      <InventoryList />
    </AdminToaster>
  );
}
