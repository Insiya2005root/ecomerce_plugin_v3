'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, ArrowLeft01Icon, ArrowRight01Icon, Search01Icon, ShoppingCart01Icon } from '@hugeicons/core-free-icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { SelectField, controlClass, type SelectOption } from '@/components/admin/fields';
import { AdminToaster } from '@/components/admin/toast';
import { CancelledBadge, FulfillmentBadge, PaymentBadge, sourceLabel } from '@/components/orders/OrderBits';
import { formatDateTime, formatMoney } from '@/lib/format';
import { listOrders } from '@/lib/orders/api';
import { FULFILLMENT_STATUSES, PAYMENT_STATUSES, type Order } from '@/lib/orders/types';
import { cartUrl, orderUrls } from '@/lib/products/urls';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const PAYMENT_OPTIONS: SelectOption[] = [{ value: 'all', label: 'All payments' }, ...PAYMENT_STATUSES.map((s) => ({ value: s, label: s }))];
const FULFILLMENT_OPTIONS: SelectOption[] = [{ value: 'all', label: 'All fulfillment' }, ...FULFILLMENT_STATUSES.map((s) => ({ value: s, label: s }))];
const SORT_OPTIONS: SelectOption[] = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'total:desc', label: 'Total, high to low' },
  { value: 'total:asc', label: 'Total, low to high' },
];

type Filters = { q: string; payment: string; fulfillment: string; cancelled: boolean; sort: string; page: number };
const OWN_PARAMS = ['q', 'payment', 'fulfillment', 'cancelled', 'sort', 'page'];

function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  const page = Number(p.get('page'));
  const sort = p.get('sort') ?? 'createdAt:desc';
  return {
    q: p.get('q') ?? '',
    payment: (PAYMENT_STATUSES as readonly string[]).includes(p.get('payment') ?? '') ? p.get('payment')! : '',
    fulfillment: (FULFILLMENT_STATUSES as readonly string[]).includes(p.get('fulfillment') ?? '') ? p.get('fulfillment')! : '',
    cancelled: p.get('cancelled') === '1',
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? sort : 'createdAt:desc',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function writeFilters(f: Filters) {
  const p = new URLSearchParams(window.location.search);
  OWN_PARAMS.forEach((k) => p.delete(k));
  if (f.q) p.set('q', f.q);
  if (f.payment) p.set('payment', f.payment);
  if (f.fulfillment) p.set('fulfillment', f.fulfillment);
  if (f.cancelled) p.set('cancelled', '1');
  if (f.sort !== 'createdAt:desc') p.set('sort', f.sort);
  if (f.page > 1) p.set('page', String(f.page));
  const qs = p.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

const noSubscribe = () => () => {};
const readSearch = () => window.location.search;

function OrdersList() {
  const initialSearch = React.useSyncExternalStore(noSubscribe, readSearch, () => null);
  const initialFilters = React.useMemo(() => (initialSearch === null ? null : readFilters()), [initialSearch]);
  const [edited, setEdited] = React.useState<Filters | null>(null);
  const filters = edited ?? initialFilters;
  const [searchDraft, setSearchDraft] = React.useState<string | null>(null);
  const searchValue = searchDraft ?? filters?.q ?? '';
  const [reloadKey, setReloadKey] = React.useState(0);
  const [result, setResult] = React.useState<{ key: string; orders: Order[]; total: number; page: number; error: string | null } | null>(null);
  const requestKey = filters ? `${JSON.stringify(filters)}#${reloadKey}` : null;

  React.useEffect(() => {
    if (!filters || !requestKey) return;
    writeFilters(filters);
    const controller = new AbortController();
    const [sort, order] = filters.sort.split(':') as ['createdAt' | 'total', 'asc' | 'desc'];
    listOrders(
      {
        search: filters.q.trim() || undefined,
        paymentStatus: filters.payment || undefined,
        fulfillmentStatus: filters.fulfillment || undefined,
        status: filters.cancelled ? 'Cancelled' : undefined,
        sort,
        order,
        page: filters.page,
        limit: PAGE_SIZE,
      },
      controller.signal
    )
      .then((res) => setResult({ key: requestKey, orders: res.orders, total: res.total, page: filters.page, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setResult((prev) => ({ key: requestKey, orders: prev?.orders ?? [], total: prev?.total ?? 0, page: prev?.page ?? 1, error: err instanceof Error ? err.message : 'Could not load orders.' }));
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
    update({ q: '', payment: '', fulfillment: '', cancelled: false });
  };

  const loading = result === null || result.key !== requestKey;
  const error = loading ? null : result?.error ?? null;
  const orders = result?.orders ?? [];
  const total = result?.total ?? 0;
  const shownPage = result?.page ?? 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstLoad = loading && result === null;
  const hasFilters = Boolean(filters && (filters.q || filters.payment || filters.fulfillment || filters.cancelled));

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Orders' }]}
        title="Orders"
        description="Track payments and fulfillment for every order."
        actions={
          <a href={cartUrl()} className={cn(buttonVariants({ size: 'sm' }), 'rounded-md')}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            Create order
          </a>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="relative w-full sm:w-64">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search orders"
              placeholder="Order #, customer or email"
              value={searchValue}
              onChange={(e) => setSearchDraft(e.target.value)}
              className={cn(controlClass, 'pl-8')}
            />
          </div>
          <SelectField id="filter-payment" value={filters?.payment || 'all'} options={PAYMENT_OPTIONS} onChange={(v) => update({ payment: v === 'all' ? '' : v })} className="w-full sm:w-44" />
          <SelectField id="filter-fulfillment" value={filters?.fulfillment || 'all'} options={FULFILLMENT_OPTIONS} onChange={(v) => update({ fulfillment: v === 'all' ? '' : v })} className="w-full sm:w-44" />
          <label className="flex h-8 items-center gap-2 rounded-md border px-2.5 text-[13px]">
            <input type="checkbox" checked={Boolean(filters?.cancelled)} onChange={(e) => update({ cancelled: e.target.checked })} className="accent-foreground" />
            Cancelled only
          </label>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="rounded-md text-muted-foreground" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          <div className="w-full sm:ml-auto sm:w-44">
            <SelectField id="sort" value={filters?.sort ?? 'createdAt:desc'} options={SORT_OPTIONS} onChange={(v) => update({ sort: v || 'createdAt:desc' })} />
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !loading && total === 0 ? (
          hasFilters ? (
            <EmptyState icon={Search01Icon} title="No orders match your filters" action={<Button variant="outline" size="sm" className="rounded-md" onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState
              icon={ShoppingCart01Icon}
              title="No orders yet"
              description="Build a cart to test your products, discounts, shipping and tax, then place it as an order."
              action={<a href={cartUrl()} className={cn(buttonVariants({ size: 'sm' }), 'rounded-md')}>Open cart</a>}
            />
          )
        ) : (
          <>
            <Table className={cn('text-[13px]', loading && !firstLoad && 'opacity-60 transition-opacity')}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 pl-4 text-xs font-medium text-muted-foreground">Order</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Date</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Customer</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Payment</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Fulfillment</TableHead>
                  <TableHead className="h-9 pr-4 text-right text-xs font-medium text-muted-foreground">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firstLoad
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i} className="hover:bg-transparent">
                        {[20, 28, 36, 18, 22, 16].map((w, j) => (
                          <TableCell key={j} className={cn('py-3', j === 0 && 'pl-4', j === 5 && 'pr-4')}>
                            <Skeleton className="h-3 rounded" style={{ width: `${w * 4}px` }} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : orders.map((o) => (
                      <TableRow
                        key={o._id}
                        className="cursor-pointer"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('a,button')) return;
                          window.location.href = orderUrls.detail(o._id);
                        }}
                      >
                        <TableCell className="py-2.5 pl-4">
                          <a href={orderUrls.detail(o._id)} className="font-medium hover:underline">
                            #{o.orderNumber}
                          </a>
                          <span className="block text-xs text-muted-foreground">{sourceLabel[o.source]}</span>
                        </TableCell>
                        <TableCell className="py-2.5 text-muted-foreground">{formatDateTime(o.createdAt)}</TableCell>
                        <TableCell className="max-w-[16rem] py-2.5">
                          <span className="block truncate">{o.customerDetails?.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{o.customerDetails?.email}</span>
                        </TableCell>
                        <TableCell className="py-2.5">{o.status === 'Cancelled' ? <CancelledBadge /> : <PaymentBadge status={o.paymentStatus} />}</TableCell>
                        <TableCell className="py-2.5">{o.status === 'Cancelled' ? <span className="text-muted-foreground">—</span> : <FulfillmentBadge status={o.fulfillmentStatus} />}</TableCell>
                        <TableCell className="py-2.5 pr-4 text-right font-medium tabular-nums">{formatMoney(o.pricing?.totalAmount)}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
              <span className="tabular-nums">
                {firstLoad ? 'Loading…' : `${total === 0 ? 0 : (shownPage - 1) * PAGE_SIZE + 1}–${Math.min(shownPage * PAGE_SIZE, total)} of ${total.toLocaleString('en-IN')} orders`}
              </span>
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
    </div>
  );
}

export default function OrdersPage() {
  return (
    <AdminToaster>
      <OrdersList />
    </AdminToaster>
  );
}
