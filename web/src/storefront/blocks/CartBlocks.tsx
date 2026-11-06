import React, { useEffect, useState } from 'react';
import { Gift, Minus, MoveRight, Package, Plus, Shield, ShoppingBag, Store, Tag, Trash2, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { EditorHint, LinkButton, StorefrontShell } from '../components/StorefrontState';
import { SpinningCounter } from '../components/SpinningCounter';
import { cart, useCart, type CartLine } from '../cart/cartStore';
import { formatInr, storefrontLinks } from '../cart/links';
import { useCartQuote, type CartQuote } from '../cart/pricing';
import { useStoreInfo } from '../cart/storeData';
import type { BlockSettingsMap, StorefrontBlockComponentProps } from '../types/storefront';

type Props = StorefrontBlockComponentProps<BlockSettingsMap>;

export const itemCount = (lines: { quantity: number }[]) => lines.reduce((n, l) => n + l.quantity, 0);

function usePricedLine(quote: CartQuote | undefined) {
  return {
    price: (l: CartLine) =>
      quote?.items.find((i) => i.productId === l.productId && (i.variantId || '') === (l.variantId || '') && !i.isFreeGift && !i.isAutoAddedGift),
    issue: (l: CartLine) => quote?.stockIssues.find((s) => s.productId === l.productId && (s.variantId || '') === (l.variantId || '')),
    gifts: quote?.items.filter((i) => i.isFreeGift || i.isAutoAddedGift) ?? [],
  };
}

function Thumb({ line, className }: { line: { image?: string | null; name: string }; className?: string }) {
  return line.image ? (
    <img src={line.image} alt="" className={cn('object-cover', className)} />
  ) : (
    <span className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)}>
      <ShoppingBag className="size-6" aria-hidden="true" />
    </span>
  );
}

function QuantityStepper({ line, size = 'default' }: { line: CartLine; size?: 'default' | 'sm' }) {
  const btn = size === 'sm' ? 'size-7' : 'size-8';
  return (
    <div className="flex items-center gap-2" aria-label={`Quantity of ${line.name}`}>
      <Button
        variant="outline"
        size="icon"
        className={cn(btn, 'cursor-pointer')}
        onClick={() => cart.setQuantity(line, line.quantity - 1)}
        disabled={line.quantity <= 1}
        aria-label={`Decrease quantity of ${line.name}`}
      >
        <Minus />
      </Button>
      <span className="w-8 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {line.quantity}
      </span>
      <Button
        variant="outline"
        size="icon"
        className={cn(btn, 'cursor-pointer')}
        onClick={() => cart.setQuantity(line, line.quantity + 1)}
        disabled={line.quantity >= 99}
        aria-label={`Increase quantity of ${line.name}`}
      >
        <Plus />
      </Button>
    </div>
  );
}

/**
 * The cart lines. Full: one card per item (shadcn shopping-cart-1) with quantity, remove and delivery note.
 * Compact: small rows for the mini cart. Prices always come from the server quote.
 */
export function CartLines({ settings, compact = false }: { settings: BlockSettingsMap; compact?: boolean }) {
  const c = useCart();
  const { quote } = useCartQuote();
  const { price, issue, gifts } = usePricedLine(quote);
  const showThumbs = settings.showThumbnails !== false;
  const showVariant = settings.showVariantDetails !== false;
  const canAdjust = settings.allowQuantityAdjust !== false;
  const showStockWarning = settings.showStockLimitWarning !== false;
  const deliveryNote = String(settings.deliveryNote ?? 'Delivered in 3–7 business days');
  const [removing, setRemoving] = useState<string | null>(null);
  const keyOf = (l: { productId: string; variantId?: string }) => `${l.productId}:${l.variantId || ''}`;

  const remove = (line: CartLine) => {
    setRemoving(keyOf(line));
    window.setTimeout(() => {
      cart.remove(line);
      setRemoving(null);
    }, 200);
  };

  if (compact) {
    return (
      <ul className="flex flex-col divide-y">
        {c.lines.map((line) => {
          const p = price(line);
          const href = line.slug ? storefrontLinks.product(line.slug) : undefined;
          return (
            <li key={keyOf(line)} className="ecom-sf-line flex gap-3 py-3">
              {showThumbs && (
                <a href={href} className="shrink-0 overflow-hidden rounded-xl">
                  <Thumb line={line} className="size-16" />
                </a>
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <a href={href} className="truncate text-sm font-medium hover:underline">
                  {line.name}
                </a>
                {showVariant && line.variantLabel && <span className="text-xs text-muted-foreground">{line.variantLabel}</span>}
                <div className="flex items-center justify-between gap-2">
                  <QuantityStepper line={line} size="sm" />
                  <span className="text-sm font-semibold">{p ? formatInr(p.price * line.quantity) : '…'}</span>
                </div>
                {showStockWarning && issue(line) && <span className="text-xs text-destructive">Only {issue(line)!.available} available.</span>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 cursor-pointer text-muted-foreground hover:text-destructive"
                onClick={() => cart.remove(line)}
                aria-label={`Remove ${line.name}`}
              >
                <Trash2 />
              </Button>
            </li>
          );
        })}
        {gifts.map((g) => (
          <li key={`gift-${keyOf(g)}`} className="ecom-sf-line flex items-center gap-3 py-3">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Gift className="size-6 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{g.name}</p>
              <Badge variant="secondary" className="mt-1">
                Free gift × {g.quantity}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {c.lines.map((line) => {
        const p = price(line);
        const stock = showStockWarning ? issue(line) : undefined;
        const href = line.slug ? storefrontLinks.product(line.slug) : undefined;
        return (
          <Card key={keyOf(line)} className={cn('ecom-sf-line gap-0 overflow-hidden py-0 transition-opacity', removing === keyOf(line) && 'opacity-50')}>
            <div className="flex flex-col sm:flex-row">
              {showThumbs && (
                <a href={href} className="relative block w-full shrink-0 sm:w-40">
                  <Thumb line={line} className="h-40 w-full sm:h-full sm:min-h-36" />
                </a>
              )}
              <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a href={href} className="text-lg font-medium hover:underline underline-offset-4">
                      {line.name}
                    </a>
                    {showVariant && line.variantLabel && <p className="mt-1 text-sm text-muted-foreground">{line.variantLabel}</p>}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {p ? formatInr(p.price) : '…'} each
                      {p?.originalPrice && p.originalPrice > p.price ? <span className="ml-2 line-through">{formatInr(p.originalPrice)}</span> : null}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 cursor-pointer text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => remove(line)}
                    aria-label={`Remove ${line.name}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {stock && (
                  <p className="text-sm text-destructive" role="alert">
                    Only {stock.available} available. Reduce the quantity to continue.
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between gap-3">
                  {canAdjust ? <QuantityStepper line={line} /> : <span className="text-sm text-muted-foreground">Qty {line.quantity}</span>}
                  <div className="text-end">
                    <p className="text-lg font-semibold">{p ? formatInr(p.price * line.quantity) : ''}</p>
                    {p?.originalPrice && p.originalPrice > p.price ? (
                      <p className="text-xs text-muted-foreground line-through">{formatInr(p.originalPrice * line.quantity)}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            {deliveryNote && (
              <CardFooter className="border-t bg-muted/20 px-4 py-2!">
                <p className="flex items-center text-sm text-muted-foreground">
                  <Package className="me-2 size-4" aria-hidden="true" />
                  {deliveryNote}
                </p>
              </CardFooter>
            )}
          </Card>
        );
      })}
      {gifts.map((g) => (
        <Card key={`gift-${keyOf(g)}`} className="ecom-sf-line flex-row items-center gap-4 border-dashed px-4 py-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
            <Gift className="size-5" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="font-medium">{g.name}</p>
            <p className="text-sm text-muted-foreground">Free gift × {g.quantity}</p>
          </div>
          <span className="font-semibold">{formatInr(0)}</span>
        </Card>
      ))}
    </div>
  );
}

function appliedCoupon(quote: CartQuote, code: string) {
  return (quote.pricing.appliedDiscounts ?? []).find((d) => String(d.code || '').toUpperCase() === code.toUpperCase());
}

/** Coupon code box. The discount engine checks the code when the cart is priced. */
export function CouponForm({ settings }: { settings: BlockSettingsMap }) {
  const c = useCart();
  const { quote, loading } = useCartQuote();
  const [code, setCode] = useState(c.coupon);
  useEffect(() => setCode(c.coupon), [c.coupon]);
  const applied = c.coupon && quote ? appliedCoupon(quote, c.coupon) : undefined;
  const rejected = Boolean(c.coupon && quote && !loading && !applied);
  const clear = () => cart.setCoupon('');

  return (
    <form
      className="ecom-sf-coupon flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        cart.setCoupon(code);
      }}
    >
      <label htmlFor="ecom-sf-coupon-code" className="text-sm font-medium">
        Coupon code
      </label>
      <div className="flex gap-2">
        <Input
          id="ecom-sf-coupon-code"
          className="h-9"
          value={code}
          placeholder={String(settings.inputPlaceholder || 'Enter code')}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoComplete="off"
        />
        <Button type="submit" variant="outline" className="h-9 cursor-pointer px-4" disabled={!code.trim()}>
          Apply
        </Button>
      </div>
      {applied && settings.showAppliedRuleBadges !== false && (
        <p className="text-sm text-success" role="status">
          <Tag className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
          <strong>{c.coupon}</strong> applied{applied.name ? ` · ${applied.name}` : ''}.{' '}
          <button type="button" className="cursor-pointer text-muted-foreground underline underline-offset-4" onClick={clear}>
            Remove
          </button>
        </p>
      )}
      {rejected && (
        <p className="text-sm text-destructive" role="alert">
          {c.coupon} can't be used with this cart.{' '}
          <button type="button" className="cursor-pointer underline underline-offset-4" onClick={clear}>
            Clear
          </button>
        </p>
      )}
    </form>
  );
}

/** Subtotal, discount, shipping, tax and the (spinning) total. */
export function TotalsRows({
  quote,
  showDiscount = true,
  showShipping = true,
  showTax = true,
  totalNote,
}: {
  quote: CartQuote;
  showDiscount?: boolean;
  showShipping?: boolean;
  showTax?: boolean;
  totalNote?: string;
}) {
  const p = quote.pricing;
  const row = (label: React.ReactNode, value: React.ReactNode, className?: string) => (
    <div className={cn('flex justify-between gap-4 text-sm', className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  return (
    <dl className="ecom-sf-totals flex flex-col gap-3">
      {row('Subtotal', formatInr(p.subtotal))}
      {showDiscount && p.discount > 0 && row(<span className="flex items-center gap-1 text-success"><Tag className="size-3" aria-hidden="true" />Discount</span>, <span className="text-success">− {formatInr(p.discount)}</span>)}
      {showShipping &&
        row(
          <span className="flex items-center gap-1">
            <Truck className="size-3" aria-hidden="true" />
            Shipping
          </span>,
          p.shipping > 0 ? formatInr(p.shipping) : <span className="text-success">Free</span>
        )}
      {showTax && p.tax > 0 && row('Tax', formatInr(p.tax))}
      <Separator className="my-1" />
      <div className="is-total flex items-center justify-between gap-4">
        <dt className="text-base font-medium">Total</dt>
        <dd className="text-end">
          <span className="text-xl font-bold">
            <SpinningCounter text={formatInr(p.totalAmount)} />
          </span>
          {totalNote && <span className="block text-xs text-muted-foreground">{totalNote}</span>}
        </dd>
      </div>
    </dl>
  );
}

/** "Add ₹X more for free shipping", from the free-shipping amount in Settings → Shipping. */
export function FreeShippingProgress({ quote }: { quote?: CartQuote }) {
  const { freeShippingThreshold } = useStoreInfo();
  if (!quote || freeShippingThreshold <= 0) return null;
  const spent = Math.max(0, quote.pricing.subtotal - quote.pricing.discount);
  const remaining = Math.max(0, freeShippingThreshold - spent);
  const pct = Math.min(100, Math.round((spent / freeShippingThreshold) * 100));
  return (
    <div className="ecom-sf-progress flex flex-col gap-2 rounded-2xl bg-muted/50 p-3" role="status">
      <p className="flex items-center gap-2 text-sm">
        <Truck className="size-4 shrink-0" aria-hidden="true" />
        {remaining > 0 ? (
          <span>
            Add <strong>{formatInr(remaining)}</strong> more for free shipping
          </span>
        ) : (
          <strong>You've unlocked free shipping</strong>
        )}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CheckoutButton({ label, blocked }: { label: string; blocked: boolean }) {
  return (
    <LinkButton href={storefrontLinks.checkout()} disabled={blocked} className="ecom-sf-btn-primary h-10 w-full text-base">
      <ShoppingBag data-icon="inline-start" />
      {label}
    </LinkButton>
  );
}

/** Empty-cart card. */
export function EmptyCart({ message, isEditing, title = 'Your cart is empty' }: { message: string; isEditing?: boolean; title?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ShoppingBag className="mb-4 size-12 text-muted-foreground/50" aria-hidden="true" />
          <h1 className="text-lg font-medium">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{message === 'Your cart is empty.' ? 'Add some items to get started.' : message}</p>
          <LinkButton href={storefrontLinks.shop()} variant="outline" size="default" className="mt-4">
            Continue shopping
          </LinkButton>
        </CardContent>
      </Card>
      {isEditing && <EditorHint>Shoppers see their cart here once they add products.</EditorHint>}
    </div>
  );
}

/** "Secure checkout" reassurance card. */
function TrustCard({ text }: { text: string }) {
  return (
    <Card className="border-dashed py-4">
      <CardContent className="px-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <Shield className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h4 className="font-medium">Secure checkout</h4>
            <p className="mt-1 text-xs text-muted-foreground">{text}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Cart page (shadcn shopping-cart-1): items on the left, sticky order summary on the right.
// ---------------------------------------------------------------------------------------------------------
export function CartPageBlock({ settings, isEditing }: Props) {
  const c = useCart();
  const { quote, error } = useCartQuote();
  const heading = String(settings.heading ?? 'Your shopping cart');
  if (c.lines.length === 0) {
    return (
      <StorefrontShell>
        <EmptyCart message={String(settings.emptyCartMessage || 'Your cart is empty.')} isEditing={isEditing} />
      </StorefrontShell>
    );
  }
  const blocked = Boolean(quote?.stockIssues.length);
  const count = itemCount(c.lines);
  return (
    <StorefrontShell>
      {heading && (
        <div className="mb-8 flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{heading}</h1>
          <p className="text-muted-foreground">
            {count} {count === 1 ? 'item' : 'items'} in your cart
            {quote && (
              <>
                {' '}
                • <span className="font-semibold text-foreground">{formatInr(quote.pricing.subtotal)}</span>
              </>
            )}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <section className="flex flex-1 flex-col gap-6" aria-label="Items in your cart">
          <CartLines settings={settings} />
        </section>
        <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-24 lg:w-96" aria-label="Order summary">
          <Card className="ecom-sf-summary gap-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Order summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {settings.showFreeShippingProgress !== false && <FreeShippingProgress quote={quote} />}
              {settings.showCoupon !== false && <CouponForm settings={settings} />}
              {settings.showCoupon !== false && <Separator />}
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              {quote ? <TotalsRows quote={quote} totalNote="Shipping is confirmed at checkout" /> : !error && <p className="text-sm text-muted-foreground">Calculating…</p>}
              {quote?.pricing.progressNotices?.map((n) => (
                <p key={n} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                  {n}
                </p>
              ))}
              <CheckoutButton label={String(settings.proceedButtonText || 'Proceed to checkout')} blocked={blocked} />
              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Shield className="size-3.5" aria-hidden="true" />
                Secure checkout · Cash on Delivery
              </p>
            </CardContent>
          </Card>
          {settings.showTrustCard !== false && <TrustCard text={String(settings.trustText || 'Your details are only used to deliver your order. Pay when it arrives.')} />}
          {settings.showContinueShopping !== false && (
            <LinkButton href={storefrontLinks.shop()} variant="outline" size="default" className="h-9 w-full">
              <Store data-icon="inline-start" />
              Continue shopping
              <MoveRight data-icon="inline-end" />
            </LinkButton>
          )}
        </aside>
      </div>
    </StorefrontShell>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Separate cart blocks (older pages and hand-built pages).
// ---------------------------------------------------------------------------------------------------------
export function CartItemsBlock({ settings, isEditing }: Props) {
  const c = useCart();
  if (c.lines.length === 0) {
    return (
      <StorefrontShell>
        <EmptyCart message={String(settings.emptyCartMessage || 'Your cart is empty.')} isEditing={isEditing} />
      </StorefrontShell>
    );
  }
  return (
    <StorefrontShell>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        Your cart <span className="font-normal text-muted-foreground">({itemCount(c.lines)})</span>
      </h1>
      <CartLines settings={settings} />
    </StorefrontShell>
  );
}

export function CartCouponBlock({ settings, isEditing }: Props) {
  const c = useCart();
  if (c.lines.length === 0) return isEditing ? <StorefrontShell><EditorHint>Coupon box (shows when the cart has items).</EditorHint></StorefrontShell> : null;
  return (
    <StorefrontShell>
      <Card>
        <CardContent>
          <CouponForm settings={settings} />
        </CardContent>
      </Card>
    </StorefrontShell>
  );
}

export function CartSummaryBlock({ settings, isEditing }: Props) {
  const c = useCart();
  const { quote, error } = useCartQuote();
  if (c.lines.length === 0) return isEditing ? <StorefrontShell><EditorHint>Cart totals (show when the cart has items).</EditorHint></StorefrontShell> : null;
  return (
    <StorefrontShell>
      <Card className="ecom-sf-summary">
        <CardHeader>
          <CardTitle className="text-xl">Order summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {quote ? (
            <TotalsRows
              quote={quote}
              showDiscount={settings.showDiscountBreakdown !== false}
              showShipping={settings.showShippingEstimate !== false}
              showTax={settings.showTaxBreakdown !== false}
            />
          ) : (
            !error && <p className="text-sm text-muted-foreground">Calculating…</p>
          )}
          <p className="text-xs text-muted-foreground">Shipping is confirmed at checkout once you enter your PIN code.</p>
          <CheckoutButton label={String(settings.proceedButtonText || 'Proceed to checkout')} blocked={Boolean(quote?.stockIssues.length)} />
        </CardContent>
      </Card>
    </StorefrontShell>
  );
}
