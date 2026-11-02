'use client';

import * as React from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { Alert02Icon, ArrowDownRight01Icon, ArrowUpRight01Icon, DeliveryTruck01Icon, Invoice01Icon, PackageIcon, ShoppingCart01Icon } from '@hugeicons/core-free-icons';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { CancelledBadge, FulfillmentBadge, PaymentBadge } from '@/components/orders/OrderBits';
import { ProductStatusBadge, ProductThumbnail } from '@/components/products/ProductBits';
import { getDashboardStats, type DashboardRange, type DashboardStats } from '@/lib/dashboard';
import { promotionUrls } from '@/lib/discounts/describe';
import { formatDate, formatMoney } from '@/lib/format';
import type { ProductStatus } from '@/lib/products/types';
import { cartUrl, categoryUrls, collectionUrls, customerUrls, orderUrls, productUrls } from '@/lib/products/urls';
import { cn } from '@/lib/utils';

// Single-series charts use one validated hue (dataviz reference blue; dark step for the dark surface).
const VIZ = '[--series-1:#2a78d6] dark:[--series-1:#3987e5] [--viz-grid:#ececec] dark:[--viz-grid:#2a2a2a] [--viz-ink:#6b6b68] dark:[--viz-ink:#a3a29b]';

const compactMoney = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr` : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : `₹${Math.round(n)}`;
const shortDay = (iso: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

function Delta({ now, before, lowerIsBetter = false }: { now: number; before: number; lowerIsBetter?: boolean }) {
  if (!before) return <span className="text-xs text-muted-foreground">{now ? 'New this period' : 'No data yet'}</span>;
  const pct = ((now - before) / before) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-xs text-muted-foreground">No change vs previous period</span>;
  const up = pct > 0;
  const good = lowerIsBetter ? !up : up;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      <HugeiconsIcon icon={up ? ArrowUpRight01Icon : ArrowDownRight01Icon} strokeWidth={2} className="size-3.5" />
      {up ? '+' : '−'}
      {Math.abs(pct).toFixed(Math.abs(pct) >= 10 ? 0 : 1)}%<span className="font-normal text-muted-foreground"> vs previous period</span>
    </span>
  );
}

function StatTile({ label, value, delta }: { label: string; value: string; delta: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-xs">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      <div className="mt-0.5">{delta}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, kind }: { active?: boolean; payload?: { value: number }[]; label?: string; kind: 'revenue' | 'orders' }) {
  if (!active || !payload?.length || !label) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="text-muted-foreground">{shortDay(label)}</p>
      <p className="mt-0.5 flex items-center gap-1.5 font-medium text-foreground">
        <span className="size-2 rounded-full bg-[var(--series-1)]" aria-hidden />
        {kind === 'revenue' ? formatMoney(v) : `${v} order${v === 1 ? '' : 's'}`}
      </p>
    </div>
  );
}

function DataTable({ rows, kind }: { rows: DashboardStats['series']; kind: 'revenue' | 'orders' }) {
  return (
    <details className="border-t px-5 py-2 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View as table</summary>
      <div className="mt-2 max-h-56 overflow-y-auto">
        <table className="w-full">
          <thead className="text-left text-muted-foreground">
            <tr><th className="py-1 font-medium">Date</th><th className="py-1 text-right font-medium">{kind === 'revenue' ? 'Revenue' : 'Orders'}</th></tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.date} className="border-t"><td className="py-1">{shortDay(r.date)}</td><td className="py-1 text-right">{kind === 'revenue' ? formatMoney(r.revenue) : r.orders}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Horizontal magnitude bars as plain HTML: thin bar, 4px rounded data-end, value in text ink at the side. */
function BarList({ items, empty }: { items: { key: string; label: React.ReactNode; value: number; display: string; sub?: string }[]; empty: string }) {
  const max = Math.max(...items.map((i) => i.value), 0);
  if (!items.length) return <p className="px-5 py-4 text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-3 px-5 py-4">
      {items.map((i) => (
        <li key={i.key} className="text-[13px]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate">{i.label}</span>
            <span className="shrink-0 tabular-nums">
              {i.display}
              {i.sub && <span className="ml-1.5 text-xs text-muted-foreground">{i.sub}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full" title={`${i.display}${i.sub ? ` · ${i.sub}` : ''}`}>
            <div className="h-full rounded-r-[4px] bg-[var(--series-1)]" style={{ width: `${max ? Math.max(2, (i.value / max) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AttentionTile({ href, icon, count, label, hint, tone }: { href: string; icon: IconSvgElement; count: number; label: string; hint: string; tone: string }) {
  return (
    <a href={href} className="group flex items-center gap-3 rounded-lg border bg-card p-3.5 shadow-xs transition-colors hover:bg-muted/30">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', count ? tone : 'bg-muted text-muted-foreground')}>
        <HugeiconsIcon icon={icon} strokeWidth={1.75} className="size-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-lg leading-tight font-semibold">{count}</span>
        <span className="block text-xs text-muted-foreground">{label} · {hint}</span>
      </span>
    </a>
  );
}

/** Active customers split into first-time and returning: two figures plus a single-hue share meter. */
function CustomerMix({ customers }: { customers: DashboardStats['customers'] }) {
  const share = customers.active ? Math.round((customers.returning / customers.active) * 100) : 0;
  return (
    <div className="space-y-4 px-5 py-4 text-[13px]">
      <div className="flex items-baseline justify-between gap-3">
        <span>
          <span className="text-2xl font-semibold tabular-nums">{customers.active.toLocaleString('en-IN')}</span>
          <span className="ml-1.5 text-muted-foreground">ordered</span>
        </span>
        <span className="text-xs text-muted-foreground">{customers.total.toLocaleString('en-IN')} all time</span>
      </div>
      <div>
        <div className="h-2 w-full overflow-hidden rounded-[4px] bg-[var(--viz-grid)]" role="img" aria-label={`${share}% of customers this period were returning`}>
          <div className="h-full rounded-r-[4px] bg-[var(--series-1)]" style={{ width: `${share}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{customers.active ? `${share}% were returning customers` : 'No customer orders in this period.'}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-md border px-3 py-2">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-[var(--series-1)]" aria-hidden />Returning</dt>
          <dd className="mt-0.5 text-base font-semibold tabular-nums">{customers.returning.toLocaleString('en-IN')}</dd>
        </div>
        <div className="rounded-md border px-3 py-2">
          <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-[var(--viz-grid)] ring-1 ring-border" aria-hidden />First order</dt>
          <dd className="mt-0.5 text-base font-semibold tabular-nums">{customers.newCustomers.toLocaleString('en-IN')}</dd>
        </div>
      </dl>
    </div>
  );
}

function Dashboard() {
  // null until the admin picks a range: the server then applies their saved default.
  const [days, setDays] = React.useState<DashboardRange | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [result, setResult] = React.useState<{ key: string; stats: DashboardStats | null; error: string | null } | null>(null);
  const key = `${days ?? 'default'}#${attempt}`;

  React.useEffect(() => {
    const controller = new AbortController();
    getDashboardStats(days, controller.signal)
      .then((stats) => setResult({ key, stats, error: null }))
      .catch((err) => {
        if (!controller.signal.aborted) setResult({ key, stats: null, error: err instanceof Error ? err.message : 'Could not load the dashboard.' });
      });
    return () => controller.abort();
  }, [days, key]);

  const loading = !result || result.key !== key;
  const s = result?.stats ?? null;
  const shownDays = days ?? s?.range.days ?? 30;
  const rangeLabel = `${shownDays} days`;

  const rangeSwitch = (
    <div role="radiogroup" aria-label="Date range" className="inline-flex rounded-md border bg-card p-0.5 shadow-xs">
      {([7, 30, 90] as DashboardRange[]).map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={shownDays === d}
          onClick={() => setDays(d)}
          className={cn('h-7 rounded px-3 text-[13px] font-medium transition-colors', shownDays === d ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
        >
          {d === 7 ? '7 days' : d === 30 ? '30 days' : '90 days'}
        </button>
      ))}
    </div>
  );

  if (result?.error && !s) {
    return (
      <div className="space-y-5">
        <AdminPageHeader title="Dashboard" description="How your store is doing." actions={rangeSwitch} />
        <div className="rounded-lg border bg-card"><ErrorState message={result.error} onRetry={() => setAttempt((n) => n + 1)} /></div>
      </div>
    );
  }

  const noSales = s && s.sales.orders === 0;

  return (
    <div className={cn('space-y-5', VIZ)}>
      <AdminPageHeader title="Dashboard" description={`How your store is doing over the last ${rangeLabel}.`} actions={rangeSwitch} />

      {!s ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-28 rounded-lg" />
          <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
          <Skeleton className="h-72 rounded-lg" />
        </div>
      ) : (
        <div className={cn('space-y-4 transition-opacity', loading && 'opacity-60')}>
          {/* Hero figure + supporting tiles */}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
            <div className="rounded-lg border bg-card p-5 shadow-xs">
              <p className="text-xs text-muted-foreground">Revenue · last {rangeLabel}</p>
              <p className="mt-1 text-5xl font-semibold tracking-tight">{formatMoney(s.sales.revenue)}</p>
              <div className="mt-2"><Delta now={s.sales.revenue} before={s.sales.previous.revenue} /></div>
              <p className="mt-3 text-xs text-muted-foreground">Order totals including shipping and tax. Cancelled orders excluded.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Orders" value={s.sales.orders.toLocaleString('en-IN')} delta={<Delta now={s.sales.orders} before={s.sales.previous.orders} />} />
              <StatTile label="Average order value" value={formatMoney(s.sales.averageOrderValue)} delta={<Delta now={s.sales.averageOrderValue} before={s.sales.previous.averageOrderValue} />} />
              <StatTile label="Discount given" value={formatMoney(s.sales.discountGiven)} delta={<Delta now={s.sales.discountGiven} before={s.sales.previous.discountGiven} lowerIsBetter />} />
              <StatTile label="Items sold" value={s.sales.itemsSold.toLocaleString('en-IN')} delta={<span className="text-xs text-muted-foreground">Excluding free gifts</span>} />
            </div>
          </div>

          {/* Needs attention */}
          <div className="grid gap-3 sm:grid-cols-3">
            <AttentionTile href={`${orderUrls.list()}?payment=${encodeURIComponent('Not paid')}`} icon={Invoice01Icon} count={s.attention.unpaid} label="Unpaid orders" hint="record payment" tone="bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" />
            <AttentionTile href={`${orderUrls.list()}?fulfillment=${encodeURIComponent('Not fulfilled')}`} icon={PackageIcon} count={s.attention.toFulfill} label="To fulfil" hint="pack items" tone="bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" />
            <AttentionTile href={`${orderUrls.list()}?fulfillment=Fulfilled`} icon={DeliveryTruck01Icon} count={s.attention.toShip} label="Ready to ship" hint="add tracking" tone="bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" />
          </div>

          {/* Revenue and orders: two charts, one axis each */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <SectionCard title="Revenue over time" description={`Per day, last ${rangeLabel}`}>
              {noSales ? (
                <EmptyState icon={ShoppingCart01Icon} title="No sales in this period" description="Place an order from the Cart to see it here." action={<a href={cartUrl()} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md')}>Open cart</a>} />
              ) : (
                <>
                  <div className="h-64 px-2 pt-4" role="img" aria-label={`Revenue per day over the last ${rangeLabel}, total ${formatMoney(s.sales.revenue)}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={s.series} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
                        <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />
                        <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: 'var(--viz-ink)' }} tickLine={false} axisLine={false} minTickGap={24} />
                        <YAxis tickFormatter={compactMoney} tick={{ fontSize: 11, fill: 'var(--viz-ink)' }} tickLine={false} axisLine={false} width={52} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip kind="revenue" />} cursor={{ stroke: 'var(--viz-ink)', strokeWidth: 1 }} />
                        <Area type="monotone" dataKey="revenue" stroke="var(--series-1)" strokeWidth={2} strokeLinecap="round" fill="var(--series-1)" fillOpacity={0.1} activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2, fill: 'var(--series-1)' }} dot={false} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <DataTable rows={s.series} kind="revenue" />
                </>
              )}
            </SectionCard>

            <SectionCard title="Orders per day" description={`${s.sales.orders} in the last ${rangeLabel}`}>
              {noSales ? (
                <p className="px-5 py-4 text-[13px] text-muted-foreground">No orders yet.</p>
              ) : (
                <>
                  <div className="h-64 px-2 pt-4" role="img" aria-label={`Orders per day over the last ${rangeLabel}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={s.series} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap={2}>
                        <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />
                        <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: 'var(--viz-ink)' }} tickLine={false} axisLine={false} minTickGap={24} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--viz-ink)' }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip kind="orders" />} cursor={{ fill: 'var(--viz-grid)', fillOpacity: 0.6 }} />
                        <Bar dataKey="orders" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <DataTable rows={s.series} kind="orders" />
                </>
              )}
            </SectionCard>
          </div>

          {/* Demand */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Top sellers" description={`By units sold, last ${rangeLabel}`}>
              <BarList
                empty="No products sold in this period."
                items={s.topProducts.map((p) => ({
                  key: p.productId,
                  value: p.quantity,
                  display: `${p.quantity} sold`,
                  sub: formatMoney(p.revenue),
                  label: (
                    <span className="flex min-w-0 items-center gap-2">
                      <ProductThumbnail src={p.image ?? undefined} className="size-6" />
                      {p.exists ? <a href={productUrls.detail(p.productId)} className="truncate hover:underline">{p.name}</a> : <span className="truncate">{p.name}</span>}
                    </span>
                  ),
                }))}
              />
            </SectionCard>
            <SectionCard title="Sales by category" description={`Product sales, last ${rangeLabel}`}>
              <BarList
                empty="No category sales in this period."
                items={s.salesByCategory.map((c) => ({
                  key: String(c.categoryId ?? 'none'),
                  value: c.revenue,
                  display: formatMoney(c.revenue),
                  label: c.categoryId ? <a href={categoryUrls.detail(String(c.categoryId))} className="hover:underline">{c.name}</a> : c.name,
                }))}
              />
            </SectionCard>
          </div>

          {/* Customers */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <SectionCard title="Customers" description={`Who ordered in the last ${rangeLabel}`} actions={<a href={customerUrls.list()} className="text-xs text-muted-foreground hover:text-foreground">View all</a>}>
              <CustomerMix customers={s.customers} />
            </SectionCard>
            <SectionCard title="Top customers" description={`By amount spent, last ${rangeLabel}`}>
              <BarList
                empty="No customer orders in this period."
                items={s.customers.top.map((c) => ({
                  key: c.email,
                  value: c.spent,
                  display: formatMoney(c.spent),
                  sub: `${c.orders} order${c.orders === 1 ? '' : 's'}`,
                  label: <a href={customerUrls.detail(c.email)} className="hover:underline">{c.name}</a>,
                }))}
              />
            </SectionCard>
          </div>

          {/* Catalog */}
          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard title="Newest products" actions={<a href={productUrls.list()} className="text-xs text-muted-foreground hover:text-foreground">View all</a>}>
              {s.newestProducts.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-muted-foreground">No products yet.</p>
              ) : (
                <ul className="divide-y">
                  {s.newestProducts.map((p) => (
                    <li key={p._id}>
                      <a href={productUrls.detail(p._id)} className="flex items-center gap-3 px-5 py-2.5 text-[13px] hover:bg-muted/40">
                        <ProductThumbnail src={p.image ?? undefined} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="block text-xs text-muted-foreground">Added {formatDate(p.createdAt)}</span>
                        </span>
                        <ProductStatusBadge status={p.status as ProductStatus} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Low stock" description={`${s.lowStockThreshold} or fewer left (published)`}>
              {s.lowStock.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-muted-foreground">Everything is well stocked.</p>
              ) : (
                <ul className="divide-y">
                  {s.lowStock.map((p) => (
                    <li key={p._id}>
                      <a href={productUrls.detail(p._id)} className="flex items-center gap-3 px-5 py-2.5 text-[13px] hover:bg-muted/40">
                        <ProductThumbnail src={p.image ?? undefined} />
                        <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                        <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs font-medium', p.stock === 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-300')}>
                          <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3.5" />
                          {p.stock === 0 ? 'Out of stock' : `${p.stock} left`}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Recent orders" actions={<a href={orderUrls.list()} className="text-xs text-muted-foreground hover:text-foreground">View all</a>}>
              {s.recentOrders.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-muted-foreground">No orders yet.</p>
              ) : (
                <ul className="divide-y">
                  {s.recentOrders.map((o) => (
                    <li key={o._id}>
                      <a href={orderUrls.detail(o._id)} className="flex items-center gap-3 px-5 py-2.5 text-[13px] hover:bg-muted/40">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">#{o.orderNumber}</span>
                          <span className="block truncate text-xs text-muted-foreground">{o.customerName ?? '—'} · {formatDate(o.createdAt)}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="tabular-nums">{formatMoney(o.total)}</span>
                          {o.status === 'Cancelled' ? <CancelledBadge /> : o.paymentStatus === 'Paid' ? <FulfillmentBadge status={o.fulfillmentStatus} /> : <PaymentBadge status={o.paymentStatus} />}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Products', value: s.catalog.products, sub: `${s.catalog.published} published · ${s.catalog.draft} draft`, href: productUrls.list() },
              { label: 'Categories', value: s.catalog.categories, sub: 'Organise your catalog', href: categoryUrls.list() },
              { label: 'Collections', value: s.catalog.collections, sub: 'Merchandising groups', href: collectionUrls.list() },
              { label: 'Live promotions', value: s.catalog.activePromotions, sub: 'Discounts, coupons, campaigns', href: promotionUrls.overview() },
            ].map((t) => (
              <a key={t.label} href={t.href} className="rounded-lg border bg-card p-4 shadow-xs transition-colors hover:bg-muted/30">
                <p className="text-xs text-muted-foreground">{t.label}</p>
                <p className="mt-1 text-xl font-semibold">{t.value.toLocaleString('en-IN')}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.sub}</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return <Dashboard />;
}
