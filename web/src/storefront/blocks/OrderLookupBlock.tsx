import React, { useState } from 'react';
import { CalendarDays, MapPin, PackageCheck, Search, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { LinkButton, StorefrontShell } from '../components/StorefrontState';
import { formatInr, storefrontLinks } from '../cart/links';
import type { BlockSettingsMap, StorefrontBlockComponentProps } from '../types/storefront';

interface LookedUpOrder {
  orderNumber: string;
  placedAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentStatus: string;
  carrier: string;
  trackingNumber: string;
  deliverTo: string;
  items: { productId: string; name: string; quantity: number; price: number; isFreeGift: boolean }[];
  pricing: { subtotal: number; discount: number; shipping: number; tax: number; totalAmount: number };
}

async function lookupOrder(orderNumber: string, email: string): Promise<LookedUpOrder> {
  const res = await fetch('/api/plugins/ecommerce-plugin/storefront/order-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ orderNumber, email }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) throw new Error(body?.message || 'Could not look up the order. Please try again.');
  return body.order;
}

const STAGES = ['Placed', 'Processing', 'Shipped', 'Delivered'];
function stageIndex(o: LookedUpOrder) {
  if (o.status === 'Delivered' || o.fulfillmentStatus === 'Delivered') return 3;
  if (o.status === 'Shipped' || o.fulfillmentStatus === 'Shipped') return 2;
  if (o.status === 'Processing' || o.fulfillmentStatus === 'Fulfilled') return 1;
  return 0;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

function OrderResult({ order, settings, onReset }: { order: LookedUpOrder; settings: BlockSettingsMap; onReset: () => void }) {
  const cancelled = order.status === 'Cancelled';
  const stage = stageIndex(order);
  const units = order.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <Card className="ecom-sf-order">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-x-6">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="flex flex-wrap items-center gap-2 text-2xl">
            Order {order.orderNumber}
            <Badge variant={cancelled ? 'destructive' : 'secondary'}>{order.status}</Badge>
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden="true" />
              Placed {formatDate(order.placedAt)}
            </span>
            {order.deliverTo && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden="true" />
                {order.deliverTo}
              </span>
            )}
          </CardDescription>
        </div>
        <div className="text-end text-sm text-muted-foreground max-md:text-start">
          <p>
            {units} item{units === 1 ? '' : 's'} · {formatInr(order.pricing.totalAmount)}
          </p>
          <p>
            {order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod} · {order.paymentStatus}
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {!cancelled && (
          <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
            {STAGES.map((label, i) => (
              <li key={label} className="flex flex-col gap-2" aria-current={i === stage ? 'step' : undefined}>
                <span className={cn('h-1.5 rounded-full', i <= stage ? 'bg-primary' : 'bg-muted')} />
                <span className={cn('text-xs', i === stage ? 'font-semibold' : 'text-muted-foreground')}>{label}</span>
              </li>
            ))}
          </ol>
        )}
        {(order.carrier || order.trackingNumber) && (
          <p className="flex items-center gap-2 rounded-2xl bg-muted/50 px-4 py-3 text-sm">
            <Truck className="size-4 shrink-0" aria-hidden="true" />
            {order.carrier && <span>Shipped with {order.carrier}</span>}
            {order.trackingNumber && <span className="text-muted-foreground">· Tracking {order.trackingNumber}</span>}
          </p>
        )}
        {settings.showItems !== false && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Item</TableHead>
                <TableHead className="hidden text-end font-semibold sm:table-cell">Quantity</TableHead>
                <TableHead className="text-end font-semibold">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item, i) => (
                <TableRow key={`${item.productId}-${i}`}>
                  <TableCell className="py-3">
                    <p className="font-medium whitespace-normal">{item.name}</p>
                    {item.isFreeGift && <Badge variant="secondary" className="mt-1">Free gift</Badge>}
                    <p className="mt-1 text-xs text-muted-foreground sm:hidden">Qty {item.quantity}</p>
                  </TableCell>
                  <TableCell className="hidden text-end sm:table-cell">{item.quantity}</TableCell>
                  <TableCell className="text-end">{formatInr(item.price * item.quantity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-transparent">
              {order.pricing.discount > 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell className="text-muted-foreground">Discount</TableCell>
                  <TableCell className="hidden sm:table-cell" />
                  <TableCell className="text-end text-success">− {formatInr(order.pricing.discount)}</TableCell>
                </TableRow>
              )}
              <TableRow className="hover:bg-transparent">
                <TableCell className="text-muted-foreground">Shipping{order.pricing.tax > 0 ? ' & tax' : ''}</TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="text-end">{formatInr(order.pricing.shipping + order.pricing.tax)}</TableCell>
              </TableRow>
              <TableRow className="font-semibold hover:bg-transparent">
                <TableCell>Total</TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="text-end">{formatInr(order.pricing.totalAmount)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3 border-t-0 bg-transparent pt-0">
        <Button variant="secondary" className="h-9 cursor-pointer px-4" onClick={onReset}>
          Look up another order
        </Button>
        {settings.showContinueShopping !== false && (
          <LinkButton href={storefrontLinks.shop()} size="default" className="h-9 px-4">
            Continue shopping
          </LinkButton>
        )}
      </CardFooter>
    </Card>
  );
}

/**
 * Order status for shoppers (shadcn order-history-1). There are no customer accounts yet, so the shopper
 * enters the order number and the email used at checkout. ?order=ORD-123 fills in the number.
 */
export function OrderLookupBlock({ settings, isEditing }: StorefrontBlockComponentProps<BlockSettingsMap>) {
  const [orderNumber, setOrderNumber] = useState(() => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('order') || ''));
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'error'; message?: string }>({ status: 'idle' });
  const [order, setOrder] = useState<LookedUpOrder | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) return;
    if (!orderNumber.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setState({ status: 'error', message: 'Enter your order number and the email you used at checkout.' });
      return;
    }
    setState({ status: 'loading' });
    try {
      setOrder(await lookupOrder(orderNumber.trim(), email.trim()));
      setState({ status: 'idle' });
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not look up the order.' });
    }
  };

  if (order) {
    return (
      <StorefrontShell>
        <OrderResult order={order} settings={settings} onReset={() => setOrder(null)} />
      </StorefrontShell>
    );
  }

  return (
    <StorefrontShell>
      <Card className="ecom-sf-order-lookup mx-auto max-w-lg">
        <CardHeader>
          <span className="mb-2 flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground" aria-hidden="true">
            <PackageCheck className="size-6" />
          </span>
          <CardTitle className="text-2xl">{String(settings.heading || 'Track your order')}</CardTitle>
          <CardDescription className="text-balance">
            {String(settings.description || 'Enter your order number and the email you used at checkout to see its status.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ecom-sf-lookup-order">Order number</FieldLabel>
                <Input id="ecom-sf-lookup-order" className="h-9" placeholder="ORD-123456789" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="ecom-sf-lookup-email">Email</FieldLabel>
                <Input id="ecom-sf-lookup-email" className="h-9" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </Field>
              {state.status === 'error' && <FieldError>{state.message}</FieldError>}
              <Button type="submit" className="h-9 w-full cursor-pointer" disabled={state.status === 'loading' || isEditing}>
                <Search data-icon="inline-start" />
                {state.status === 'loading' ? 'Looking up…' : String(settings.buttonLabel || 'Find my order')}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </StorefrontShell>
  );
}
