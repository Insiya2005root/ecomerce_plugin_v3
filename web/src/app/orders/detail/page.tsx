'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from '@/lib/router';
import { Cancel01Icon, ShoppingCart01Icon } from '@hugeicons/core-free-icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionMenu } from '@/components/admin/ActionMenu';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { TextArea } from '@/components/admin/fields';
import { Muted, SectionCard, SectionRow } from '@/components/admin/SectionCard';
import { EmptyState, ErrorState, InlineError } from '@/components/admin/StateViews';
import { AdminToaster, toast } from '@/components/admin/toast';
import { OrderActionDrawers, type OrderDrawer } from '@/components/orders/OrderActionDrawers';
import { CancelledBadge, FulfillmentBadge, LineItem, PaymentBadge, PricingBreakdown, sourceLabel } from '@/components/orders/OrderBits';
import { formatDateTime, formatMoney } from '@/lib/format';
import { getOrder, orderActions } from '@/lib/orders/api';
import type { Order } from '@/lib/orders/types';
import { ApiError } from '@/lib/products/api';
import { customerUrls, orderUrls } from '@/lib/products/urls';
import { cn } from '@/lib/utils';

const API_BASE = '/api/plugins/ecommerce-plugin';

/** Product thumbnails for the order lines (orders store a snapshot of name/price, not images). */
function useLineImages(order: Order | null) {
  const [images, setImages] = React.useState<Record<string, string | undefined>>({});
  const ids = order ? [...new Set(order.items.map((i) => String(i.productId)))].join(',') : '';
  React.useEffect(() => {
    if (!ids) return;
    let active = true;
    fetch(`${API_BASE}/products?ids=${ids}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!active || !d.success) return;
        setImages(Object.fromEntries((d.products as { _id: string; images?: string[] }[]).map((p) => [p._id, p.images?.[0]])));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ids]);
  return images;
}

const EVENT_DOT: Record<string, string> = {
  placed: 'bg-sky-500',
  payment: 'bg-emerald-500',
  refund: 'bg-amber-500',
  fulfillment: 'bg-sky-500',
  canceled: 'bg-red-500',
  note: 'bg-zinc-400',
  status: 'bg-zinc-400',
};

function OrderDetail() {
  const id = useSearchParams().get('id') ?? '';
  const [order, setOrder] = React.useState<Order | null>(null);
  const [loadError, setLoadError] = React.useState<Error | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [drawer, setDrawer] = React.useState<OrderDrawer>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const images = useLineImages(order);

  React.useEffect(() => {
    if (!id) return;
    let active = true;
    getOrder(id)
      .then((o) => active && (setOrder(o), setLoadError(null)))
      .catch((err) => active && setLoadError(err));
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const crumbs = [{ label: 'Orders', href: orderUrls.list() }, { label: order ? `#${order.orderNumber}` : loadError ? 'Order' : 'Loading…' }];

  if (!order) {
    const notFound = !id || (loadError instanceof ApiError && (loadError.status === 404 || loadError.status === 400));
    return (
      <div className="space-y-5">
        <AdminPageHeader breadcrumbs={crumbs} />
        {loadError || !id ? (
          <div className="rounded-lg border bg-card">
            {notFound ? (
              <EmptyState
                icon={ShoppingCart01Icon}
                title="Order not found"
                action={<a href={orderUrls.list()} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md')}>Back to orders</a>}
              />
            ) : (
              <ErrorState message={loadError?.message ?? 'Could not load the order.'} onRetry={() => setAttempt((n) => n + 1)} />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-busy="true">
            <div className="space-y-4">
              <Skeleton className="h-72 rounded-lg" />
              <Skeleton className="h-36 rounded-lg" />
            </div>
            <Skeleton className="h-56 rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  const cancelled = order.status === 'Cancelled';
  const captured = order.payment?.capturedAmount ?? 0;
  const refunded = order.payment?.refundedAmount ?? 0;
  const outstanding = order.paymentStatus === 'Not paid' && !cancelled ? order.pricing.totalAmount : 0;
  const canCancel = !cancelled && order.fulfillmentStatus !== 'Shipped' && order.fulfillmentStatus !== 'Delivered';

  const runAction = async (fn: () => Promise<Order>, message: string) => {
    setBusy(true);
    try {
      setOrder(await fn());
      toast.success(message, `#${order.orderNumber}`);
    } catch (err) {
      toast.error('Action failed', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () =>
    confirm({
      title: 'Cancel order?',
      description: (
        <>
          Order <span className="font-medium text-foreground">#{order.orderNumber}</span> will be cancelled and its items returned to stock.
          {order.paymentStatus === 'Paid' ? ' The payment is not refunded automatically — record a refund afterwards.' : ''}
        </>
      ),
      confirmLabel: 'Cancel order',
      destructive: true,
      onConfirm: () => runAction(() => orderActions.cancel(order._id), 'Order cancelled'),
    });

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return setNoteError('Write a note first.');
    setNoteError(null);
    await runAction(() => orderActions.addNote(order._id, note), 'Note added');
    setNote('');
  };

  const fulfillmentAction =
    cancelled ? null
    : order.fulfillmentStatus === 'Not fulfilled' ? { label: 'Mark as fulfilled', onClick: () => runAction(() => orderActions.fulfill(order._id), 'Marked as fulfilled') }
    : order.fulfillmentStatus === 'Fulfilled' ? { label: 'Mark as shipped', onClick: () => setDrawer('ship') }
    : order.fulfillmentStatus === 'Shipped' ? { label: 'Mark as delivered', onClick: () => runAction(() => orderActions.deliver(order._id), 'Marked as delivered') }
    : null;

  const address = order.shippingAddress;
  const addressLines = address
    ? [address.addressLine1, address.addressLine2, [address.city, address.state, address.postalCode].filter(Boolean).join(', '), address.country].filter(Boolean)
    : [order.customerDetails.address];

  return (
    <div className="space-y-5">
      <AdminPageHeader breadcrumbs={crumbs} />

      {cancelled && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px]">
          <span className="font-medium text-destructive">This order was cancelled</span>
          {order.canceledAt && <span className="text-muted-foreground"> on {formatDateTime(order.canceledAt)}</span>}
          <span className="text-muted-foreground">. Items were returned to stock.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <SectionCard
            title={
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-base">#{order.orderNumber}</span>
                <span className="text-xs font-normal text-muted-foreground">{formatDateTime(order.createdAt)}</span>
              </span>
            }
            actions={
              <>
                {cancelled ? <CancelledBadge /> : <><PaymentBadge status={order.paymentStatus} /><FulfillmentBadge status={order.fulfillmentStatus} /></>}
                <ActionMenu
                  label="Order actions"
                  groups={[[{ label: 'Cancel order', icon: Cancel01Icon, destructive: true, disabled: !canCancel || busy, onSelect: cancel }]]}
                />
              </>
            }
          >
            <div className="divide-y">
              {order.items.map((item, i) => (
                <LineItem key={item._id ?? i} item={item} image={images[String(item.productId)]} />
              ))}
            </div>
            <div className="space-y-3 px-5 py-4">
              <PricingBreakdown pricing={order.pricing} />
              {(captured > 0 || outstanding > 0) && (
                <div className="space-y-1.5 border-t pt-2 text-[13px]">
                  {captured > 0 && <Row label="Paid" value={formatMoney(captured)} />}
                  {refunded > 0 && <Row label="Refunded" value={`−${formatMoney(refunded)}`} muted />}
                  {captured > 0 && refunded > 0 && <Row label="Net payment" value={formatMoney(captured - refunded)} strong />}
                  {outstanding > 0 && <Row label="Outstanding" value={formatMoney(outstanding)} strong />}
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Payment"
            actions={
              <>
                {order.paymentStatus === 'Not paid' && !cancelled && (
                  <Button size="sm" className="rounded-md" disabled={busy} onClick={() => setDrawer('capture')}>
                    Mark as paid
                  </Button>
                )}
                {captured - refunded > 0.004 && (
                  <Button variant="outline" size="sm" className="rounded-md" disabled={busy} onClick={() => setDrawer('refund')}>
                    Refund
                  </Button>
                )}
              </>
            }
          >
            <dl className="divide-y">
              <SectionRow label="Status"><PaymentBadge status={order.paymentStatus} /></SectionRow>
              <SectionRow label="Method">{order.payment?.method || <Muted />}</SectionRow>
              <SectionRow label="Reference">{order.payment?.reference ? <span className="font-mono text-xs">{order.payment.reference}</span> : <Muted />}</SectionRow>
              <SectionRow label="Paid on">{order.payment?.capturedAt ? formatDateTime(order.payment.capturedAt) : <Muted />}</SectionRow>
              {order.refunds.length > 0 && (
                <SectionRow label="Refunds">
                  <ul className="space-y-1">
                    {order.refunds.map((r, i) => (
                      <li key={i}>
                        <span className="tabular-nums">{formatMoney(r.amount)}</span>
                        <span className="text-xs text-muted-foreground"> · {formatDateTime(r.at)}{r.reason ? ` · ${r.reason}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </SectionRow>
              )}
            </dl>
          </SectionCard>

          <SectionCard
            title="Fulfillment"
            actions={
              fulfillmentAction && (
                <Button size="sm" className="rounded-md" disabled={busy} onClick={fulfillmentAction.onClick}>
                  {fulfillmentAction.label}
                </Button>
              )
            }
          >
            <dl className="divide-y">
              <SectionRow label="Status">{cancelled ? <Muted>Cancelled</Muted> : <FulfillmentBadge status={order.fulfillmentStatus} />}</SectionRow>
              <SectionRow label="Carrier">{order.fulfillment?.carrier || <Muted />}</SectionRow>
              <SectionRow label="Tracking number">{order.fulfillment?.trackingNumber ? <span className="font-mono text-xs">{order.fulfillment.trackingNumber}</span> : <Muted />}</SectionRow>
              <SectionRow label="Progress">
                <ol className="space-y-0.5 text-xs">
                  {([
                    ['Fulfilled', order.fulfillment?.fulfilledAt],
                    ['Shipped', order.fulfillment?.shippedAt],
                    ['Delivered', order.fulfillment?.deliveredAt],
                  ] as const).map(([label, at]) => (
                    <li key={label} className={at ? 'text-foreground' : 'text-muted-foreground'}>
                      {at ? '●' : '○'} {label}
                      {at ? ` · ${formatDateTime(at)}` : ''}
                    </li>
                  ))}
                </ol>
              </SectionRow>
            </dl>
          </SectionCard>

          <SectionCard title="Activity">
            <form onSubmit={addNote} className="space-y-2 px-5 py-4">
              <TextArea
                id="order-note"
                rows={2}
                value={note}
                placeholder="Add an internal note (only visible to staff)…"
                onChange={(e) => {
                  setNote(e.target.value);
                  setNoteError(null);
                }}
              />
              {noteError && <InlineError message={noteError} />}
              <div className="flex justify-end">
                <Button type="submit" variant="outline" size="sm" className="rounded-md" disabled={busy}>
                  Add note
                </Button>
              </div>
            </form>
            <ol className="space-y-3 border-t px-5 py-4">
              {[...order.events].reverse().map((ev, i) => (
                <li key={i} className="flex gap-3 text-[13px]">
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', EVENT_DOT[ev.type] ?? 'bg-zinc-400')} aria-hidden />
                  <div className="min-w-0">
                    <p className={cn(ev.type === 'note' && 'whitespace-pre-line rounded-md bg-muted/50 px-2.5 py-1.5')}>{ev.message}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(ev.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-4">
          <SectionCard
            title="Customer"
            actions={
              <a href={customerUrls.detail(order.customerDetails.email)} className="text-xs text-muted-foreground hover:text-foreground">
                View customer
              </a>
            }
          >
            <div className="space-y-3 px-5 py-4 text-[13px]">
              <div>
                <a href={customerUrls.detail(order.customerDetails.email)} className="font-medium hover:underline">
                  {order.customerDetails.name}
                </a>
                <p className="text-muted-foreground">{order.customerDetails.email}</p>
                {order.customerDetails.phone && <p className="text-muted-foreground">{order.customerDetails.phone}</p>}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Shipping address</p>
                {addressLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Order details">
            <dl className="divide-y">
              <SectionRow label="Source">{sourceLabel[order.source]}</SectionRow>
              <SectionRow label="Coupon">{order.couponCode ? <span className="font-mono text-xs uppercase">{order.couponCode}</span> : <Muted />}</SectionRow>
              <SectionRow label="Ships from">{order.pricing.shippingSnapshot?.originName || <Muted />}</SectionRow>
              <SectionRow label="Last updated">{formatDateTime(order.updatedAt)}</SectionRow>
            </dl>
          </SectionCard>
        </div>
      </div>

      <OrderActionDrawers
        order={order}
        open={drawer}
        onClose={() => setDrawer(null)}
        onDone={(updated, message) => {
          setOrder(updated);
          setDrawer(null);
          toast.success(message, `#${updated.orderNumber}`);
        }}
      />
      {dialog}
    </div>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between', muted && 'text-muted-foreground', strong && 'font-semibold')}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <AdminToaster>
      <Suspense fallback={null}>
        <OrderDetail />
      </Suspense>
    </AdminToaster>
  );
}
