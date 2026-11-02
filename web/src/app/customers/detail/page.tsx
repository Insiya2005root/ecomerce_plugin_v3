'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Call02Icon, Mail01Icon, UserIcon } from '@hugeicons/core-free-icons';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Muted, SectionCard } from '@/components/admin/SectionCard';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { AdminToaster } from '@/components/admin/toast';
import { CustomerAvatar, SegmentBadge } from '@/components/customers/CustomerBits';
import { CancelledBadge, FulfillmentBadge, PaymentBadge } from '@/components/orders/OrderBits';
import { getCustomer, type CustomerDetail } from '@/lib/customers';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { ApiError } from '@/lib/products/api';
import { promotionUrls } from '@/lib/discounts/describe';
import { customerUrls, orderUrls, productUrls } from '@/lib/products/urls';
import { cn } from '@/lib/utils';

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CustomerDetailView() {
  const email = useSearchParams().get('email') ?? '';
  const [customer, setCustomer] = React.useState<CustomerDetail | null>(null);
  const [loadError, setLoadError] = React.useState<Error | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!email) return;
    let active = true;
    getCustomer(email)
      .then((c) => active && (setCustomer(c), setLoadError(null)))
      .catch((err) => active && setLoadError(err));
    return () => {
      active = false;
    };
  }, [email, attempt]);

  const crumbs = [{ label: 'Customers', href: customerUrls.list() }, { label: customer ? customer.name : loadError || !email ? 'Customer' : 'Loading…' }];

  if (!customer) {
    const notFound = !email || (loadError instanceof ApiError && (loadError.status === 404 || loadError.status === 400));
    return (
      <div className="space-y-5">
        <AdminPageHeader breadcrumbs={crumbs} />
        {loadError || !email ? (
          <div className="rounded-lg border bg-card">
            {notFound ? (
              <EmptyState
                icon={UserIcon}
                title="Customer not found"
                description="Customers come from orders. This email has no orders."
                action={<a href={customerUrls.list()} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md')}>Back to customers</a>}
              />
            ) : (
              <ErrorState message={loadError?.message ?? 'Could not load the customer.'} onRetry={() => setAttempt((n) => n + 1)} />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-busy="true">
            <div className="space-y-4">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-72 rounded-lg" />
            </div>
            <Skeleton className="h-56 rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader breadcrumbs={crumbs} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <SectionCard>
            <div className="flex flex-wrap items-center gap-4 px-5 py-4">
              <CustomerAvatar name={customer.name} email={customer.email} className="size-12 text-base" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold">{customer.name}</h2>
                <p className="truncate text-[13px] text-muted-foreground">
                  {customer.email} · Customer since {formatDate(customer.firstOrderAt)}
                </p>
              </div>
              <SegmentBadge segment={customer.segment} />
            </div>
            <div className="grid grid-cols-2 divide-x divide-y border-t sm:grid-cols-4 sm:divide-y-0">
              <Stat label="Total spent" value={formatMoney(customer.totalSpent)} sub={customer.refunded > 0 ? `after ${formatMoney(customer.refunded)} refunded` : 'Cancelled orders excluded'} />
              <Stat
                label="Orders"
                value={String(customer.validOrders)}
                sub={customer.cancelledOrders ? `${customer.cancelledOrders} cancelled` : `Last on ${formatDate(customer.lastOrderAt)}`}
              />
              <Stat label="Average order" value={formatMoney(customer.averageOrderValue)} />
              <Stat
                label={customer.outstanding > 0 ? 'Awaiting payment' : 'Discounts received'}
                value={formatMoney(customer.outstanding > 0 ? customer.outstanding : customer.discountTotal)}
                sub={customer.outstanding > 0 ? <span className="text-amber-700 dark:text-amber-300">Unpaid orders</span> : undefined}
              />
            </div>
          </SectionCard>

          <SectionCard title="Orders" description={customer.orders > customer.recentOrders.length ? `Latest ${customer.recentOrders.length} of ${customer.orders}` : undefined}>
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 pl-5 text-xs font-medium text-muted-foreground">Order</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Date</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Payment</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Fulfillment</TableHead>
                  <TableHead className="h-9 pr-5 text-right text-xs font-medium text-muted-foreground">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customer.recentOrders.map((o) => (
                  <TableRow
                    key={o._id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a,button')) return;
                      window.location.href = orderUrls.detail(o._id);
                    }}
                  >
                    <TableCell className="py-2.5 pl-5">
                      <a href={orderUrls.detail(o._id)} className="font-medium hover:underline">
                        #{o.orderNumber}
                      </a>
                      <span className="block text-xs text-muted-foreground">
                        {o.items} item{o.items === 1 ? '' : 's'}
                        {o.couponCode ? ` · ${o.couponCode.toUpperCase()}` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-muted-foreground">{formatDateTime(o.createdAt)}</TableCell>
                    <TableCell className="py-2.5">{o.status === 'Cancelled' ? <CancelledBadge /> : <PaymentBadge status={o.paymentStatus} />}</TableCell>
                    <TableCell className="py-2.5">{o.status === 'Cancelled' ? <Muted /> : <FulfillmentBadge status={o.fulfillmentStatus} />}</TableCell>
                    <TableCell className={cn('py-2.5 pr-5 text-right tabular-nums', o.status === 'Cancelled' ? 'text-muted-foreground line-through' : 'font-medium')}>{formatMoney(o.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Contact">
            <div className="space-y-2 px-5 py-4 text-[13px]">
              <a href={`mailto:${customer.email}`} className="flex items-center gap-2 hover:underline">
                <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                <span className="truncate">{customer.email}</span>
              </a>
              {customer.phone ? (
                <a href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 hover:underline">
                  <HugeiconsIcon icon={Call02Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                  {customer.phone}
                </a>
              ) : (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <HugeiconsIcon icon={Call02Icon} strokeWidth={2} className="size-3.5" />
                  No phone number
                </p>
              )}
              {customer.otherNames.length > 0 && <p className="pt-1 text-xs text-muted-foreground">Also ordered as {customer.otherNames.join(', ')}</p>}
            </div>
          </SectionCard>

          <SectionCard title="Addresses">
            {customer.addresses.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-muted-foreground">No saved shipping address.</p>
            ) : (
              <ul className="divide-y">
                {customer.addresses.map((a, i) => (
                  <li key={i} className="px-5 py-3 text-[13px]">
                    {[a.addressLine1, a.addressLine2, [a.city, a.state, a.postalCode].filter(Boolean).join(', '), a.country].filter(Boolean).map((line, j) => (
                      <p key={j}>{line}</p>
                    ))}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {i === 0 ? 'Most recent · ' : ''}
                      Used on {a.orders} order{a.orders === 1 ? '' : 's'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Most bought">
            {customer.topProducts.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-muted-foreground">Nothing bought yet.</p>
            ) : (
              <ul className="divide-y">
                {customer.topProducts.map((p) => (
                  <li key={p.productId} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                    <a href={productUrls.detail(p.productId)} className="min-w-0 truncate hover:underline">
                      {p.name}
                    </a>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {p.quantity} × · {formatMoney(p.spent)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Discounts used">
            {customer.discounts.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-muted-foreground">No discounts on their orders.</p>
            ) : (
              <ul className="divide-y">
                {customer.discounts.map((d) => {
                  const label = (
                    <>
                      <span className="block truncate">{d.name}</span>
                      {d.code && <span className="font-mono text-xs text-muted-foreground uppercase">{d.code}</span>}
                    </>
                  );
                  return (
                    <li key={d.ruleId ?? d.name} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                      {d.ruleId ? (
                        <a href={promotionUrls.detail(d.ruleId)} className="min-w-0 hover:underline">
                          {label}
                        </a>
                      ) : (
                        <span className="min-w-0">{label}</span>
                      )}
                      <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {d.uses}× · −{formatMoney(d.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <AdminToaster>
      <Suspense fallback={null}>
        <CustomerDetailView />
      </Suspense>
    </AdminToaster>
  );
}
