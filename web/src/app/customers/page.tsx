'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon, Download04Icon, Search01Icon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { SelectField, controlClass, type SelectOption } from '@/components/admin/fields';
import { AdminToaster, toast } from '@/components/admin/toast';
import { CustomerAvatar, SEGMENT_HINT, SegmentBadge } from '@/components/customers/CustomerBits';
import { downloadText, toCsv } from '@/lib/csv';
import { CUSTOMER_SEGMENTS, listCustomers, type Customer, type CustomerListQuery, type CustomerSummary } from '@/lib/customers';
import { formatDate, formatMoney } from '@/lib/format';
import { cartUrl, customerUrls } from '@/lib/products/urls';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const SEGMENT_OPTIONS: SelectOption[] = [{ value: 'all', label: 'All customers' }, ...CUSTOMER_SEGMENTS.filter((s) => s !== 'No purchases').map((s) => ({ value: s, label: s }))];
const SORT_OPTIONS: SelectOption[] = [
  { value: 'lastOrderAt:desc', label: 'Last order, newest' },
  { value: 'totalSpent:desc', label: 'Total spent, high to low' },
  { value: 'orders:desc', label: 'Most orders' },
  { value: 'firstOrderAt:desc', label: 'Newest customers' },
  { value: 'name:asc', label: 'Name, A–Z' },
];

type Filters = { q: string; segment: string; sort: string; page: number };
const OWN_PARAMS = ['q', 'segment', 'sort', 'page'];

function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  const page = Number(p.get('page'));
  const sort = p.get('sort') ?? 'lastOrderAt:desc';
  const segment = p.get('segment') ?? '';
  return {
    q: p.get('q') ?? '',
    segment: SEGMENT_OPTIONS.some((o) => o.value === segment) ? segment : '',
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? sort : 'lastOrderAt:desc',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function writeFilters(f: Filters) {
  const p = new URLSearchParams(window.location.search);
  OWN_PARAMS.forEach((k) => p.delete(k));
  if (f.q) p.set('q', f.q);
  if (f.segment) p.set('segment', f.segment);
  if (f.sort !== 'lastOrderAt:desc') p.set('sort', f.sort);
  if (f.page > 1) p.set('page', String(f.page));
  const qs = p.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

function toQuery(f: Filters, page: number, limit: number): CustomerListQuery {
  const [sort, order] = f.sort.split(':') as [CustomerListQuery['sort'], 'asc' | 'desc'];
  return { search: f.q.trim() || undefined, segment: f.segment || undefined, sort, order, page, limit };
}

const noSubscribe = () => () => {};
const readSearch = () => window.location.search;

function SummaryTile({ label, value, hint, active, onClick }: { label: string; value: string; hint: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('rounded-lg border bg-card p-4 text-left shadow-xs transition-colors hover:bg-muted/30', active && 'border-foreground/40 ring-1 ring-foreground/10')}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </button>
  );
}

function CustomersList() {
  const initialSearch = React.useSyncExternalStore(noSubscribe, readSearch, () => null);
  const initialFilters = React.useMemo(() => (initialSearch === null ? null : readFilters()), [initialSearch]);
  const [edited, setEdited] = React.useState<Filters | null>(null);
  const filters = edited ?? initialFilters;
  const [searchDraft, setSearchDraft] = React.useState<string | null>(null);
  const searchValue = searchDraft ?? filters?.q ?? '';
  const [reloadKey, setReloadKey] = React.useState(0);
  const [exporting, setExporting] = React.useState(false);
  const [result, setResult] = React.useState<{ key: string; customers: Customer[]; total: number; page: number; summary: CustomerSummary | null; error: string | null } | null>(null);
  const requestKey = filters ? `${JSON.stringify(filters)}#${reloadKey}` : null;

  React.useEffect(() => {
    if (!filters || !requestKey) return;
    writeFilters(filters);
    const controller = new AbortController();
    listCustomers(toQuery(filters, filters.page, PAGE_SIZE), controller.signal)
      .then((res) => setResult({ key: requestKey, customers: res.customers, total: res.total, page: filters.page, summary: res.summary, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setResult((prev) => ({
          key: requestKey,
          customers: prev?.customers ?? [],
          total: prev?.total ?? 0,
          page: prev?.page ?? 1,
          summary: prev?.summary ?? null,
          error: err instanceof Error ? err.message : 'Could not load customers.',
        }));
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
    update({ q: '', segment: '' });
  };

  const exportCsv = async () => {
    if (!filters) return;
    setExporting(true);
    try {
      const rows: Customer[] = [];
      for (let page = 1; ; page++) {
        const res = await listCustomers(toQuery(filters, page, 100));
        rows.push(...res.customers);
        if (rows.length >= res.total || res.customers.length === 0) break;
      }
      const csv = toCsv([
        ['Name', 'Email', 'Phone', 'City', 'Orders', 'Cancelled orders', 'Total spent', 'Average order value', 'First order', 'Last order', 'Segment'],
        ...rows.map((c) => [
          c.name,
          c.email,
          c.phone ?? '',
          c.city ?? '',
          String(c.orders),
          String(c.cancelledOrders),
          c.totalSpent.toFixed(2),
          c.averageOrderValue.toFixed(2),
          c.firstOrderAt?.slice(0, 10) ?? '',
          c.lastOrderAt?.slice(0, 10) ?? '',
          c.segment,
        ]),
      ]);
      downloadText(`customers-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast.success('Export ready', `${rows.length} customer${rows.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error('Export failed', err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(false);
    }
  };

  const loading = result === null || result.key !== requestKey;
  const error = loading ? null : result?.error ?? null;
  const customers = result?.customers ?? [];
  const total = result?.total ?? 0;
  const summary = result?.summary ?? null;
  const shownPage = result?.page ?? 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstLoad = loading && result === null;
  const hasFilters = Boolean(filters && (filters.q || filters.segment));
  const repeatRate = summary && summary.customers ? Math.round((summary.returning / summary.customers) * 100) : 0;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Customers' }]}
        title="Customers"
        description="Everyone who has placed an order, grouped by email address."
        actions={
          <Button variant="outline" size="sm" className="rounded-md" onClick={exportCsv} disabled={exporting || total === 0}>
            <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        }
      />

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile label="Customers" value={summary.customers.toLocaleString('en-IN')} hint="With at least one order" active={!filters?.segment} onClick={() => update({ segment: '' })} />
          <SummaryTile
            label="Returning"
            value={summary.returning.toLocaleString('en-IN')}
            hint={`${repeatRate}% ordered more than once`}
            active={filters?.segment === 'Returning'}
            onClick={() => update({ segment: 'Returning' })}
          />
          <SummaryTile
            label={`New in the last ${summary.newCustomerDays} days`}
            value={summary.newCustomers.toLocaleString('en-IN')}
            hint="First order in this period"
            active={filters?.segment === 'New'}
            onClick={() => update({ segment: 'New' })}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[86px] rounded-lg" />)}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="relative w-full sm:w-64">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search customers"
              placeholder="Name, email, phone or city"
              value={searchValue}
              onChange={(e) => setSearchDraft(e.target.value)}
              className={cn(controlClass, 'pl-8')}
            />
          </div>
          <SelectField id="filter-segment" value={filters?.segment || 'all'} options={SEGMENT_OPTIONS} onChange={(v) => update({ segment: v === 'all' ? '' : v })} className="w-full sm:w-44" />
          {hasFilters && (
            <Button variant="ghost" size="sm" className="rounded-md text-muted-foreground" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
          <div className="w-full sm:ml-auto sm:w-52">
            <SelectField id="sort" value={filters?.sort ?? 'lastOrderAt:desc'} options={SORT_OPTIONS} onChange={(v) => update({ sort: v || 'lastOrderAt:desc' })} />
          </div>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !loading && total === 0 ? (
          hasFilters ? (
            <EmptyState icon={Search01Icon} title="No customers match your filters" action={<Button variant="outline" size="sm" className="rounded-md" onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState
              icon={UserGroupIcon}
              title="No customers yet"
              description="Customers appear here as soon as they place an order, from the storefront or the Admin cart."
              action={<a href={cartUrl()} className={cn(buttonVariants({ size: 'sm' }), 'rounded-md')}>Open cart</a>}
            />
          )
        ) : (
          <>
            <Table className={cn('text-[13px]', loading && !firstLoad && 'opacity-60 transition-opacity')}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 pl-4 text-xs font-medium text-muted-foreground">Customer</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Segment</TableHead>
                  <TableHead className="h-9 text-right text-xs font-medium text-muted-foreground">Orders</TableHead>
                  <TableHead className="h-9 text-right text-xs font-medium text-muted-foreground">Total spent</TableHead>
                  <TableHead className="h-9 pr-4 text-xs font-medium text-muted-foreground">Last order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {firstLoad
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i} className="hover:bg-transparent">
                        {[44, 18, 10, 18, 20].map((w, j) => (
                          <TableCell key={j} className={cn('py-3', j === 0 && 'pl-4', j === 4 && 'pr-4')}>
                            <Skeleton className="h-3 rounded" style={{ width: `${w * 4}px` }} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : customers.map((c) => (
                      <TableRow
                        key={c.key}
                        className="cursor-pointer"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('a,button')) return;
                          window.location.href = customerUrls.detail(c.email);
                        }}
                      >
                        <TableCell className="max-w-[20rem] py-2.5 pl-4">
                          <span className="flex min-w-0 items-center gap-3">
                            <CustomerAvatar name={c.name} email={c.email} />
                            <span className="min-w-0">
                              <a href={customerUrls.detail(c.email)} className="block truncate font-medium hover:underline">
                                {c.name}
                              </a>
                              <span className="block truncate text-xs text-muted-foreground">
                                {c.email}
                                {c.city ? ` · ${c.city}` : ''}
                              </span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <SegmentBadge segment={c.segment} />
                        </TableCell>
                        <TableCell className="py-2.5 text-right tabular-nums">
                          {c.validOrders}
                          {c.cancelledOrders > 0 && <span className="block text-xs text-muted-foreground">+{c.cancelledOrders} cancelled</span>}
                        </TableCell>
                        <TableCell className="py-2.5 text-right font-medium tabular-nums">{formatMoney(c.totalSpent)}</TableCell>
                        <TableCell className="py-2.5 pr-4 text-muted-foreground">{formatDate(c.lastOrderAt)}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
              <span className="tabular-nums">
                {firstLoad ? 'Loading…' : `${total === 0 ? 0 : (shownPage - 1) * PAGE_SIZE + 1}–${Math.min(shownPage * PAGE_SIZE, total)} of ${total.toLocaleString('en-IN')} customers`}
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
      <p className="text-xs text-muted-foreground">
        Segments: {CUSTOMER_SEGMENTS.filter((s) => s !== 'No purchases').map((s) => `${s} — ${SEGMENT_HINT[s].toLowerCase()}`).join(' · ')}. Total spent leaves out cancelled orders and refunds.
      </p>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <AdminToaster>
      <CustomersList />
    </AdminToaster>
  );
}
