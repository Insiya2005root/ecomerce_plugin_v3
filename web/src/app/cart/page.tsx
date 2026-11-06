'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete02Icon, MinusSignIcon, Search01Icon, ShoppingCart01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AddressFields } from '@/components/admin/AddressFields';
import { Field, SelectField, TextInput, controlClass } from '@/components/admin/fields';
import { SectionCard } from '@/components/admin/SectionCard';
import { EmptyState, InlineError } from '@/components/admin/StateViews';
import { AdminToaster, toast } from '@/components/admin/toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { LineItem, PricingBreakdown } from '@/components/orders/OrderBits';
import { ProductStatusBadge, ProductThumbnail } from '@/components/products/ProductBits';
import { formatMoney } from '@/lib/format';
import { calculateCart, placeOrder } from '@/lib/orders/api';
import { CART_STORAGE_KEY } from '@/lib/orders/cartStorage';
import type { Address, CartCalculation, CartLine, OrderItem } from '@/lib/orders/types';
import { listProducts } from '@/lib/products/api';
import type { Product } from '@/lib/products/types';
import { orderUrls } from '@/lib/products/urls';
import { cn } from '@/lib/utils';
import { navigate } from '@/lib/router';

const API_BASE = '/api/plugins/ecommerce-plugin';
const STORAGE_KEY = CART_STORAGE_KEY;

type Customer = { name: string; email: string; phone: string };
type CartState = { lines: CartLine[]; coupon: string; customer: Customer; address: Address; locationId: string };

// Same defaults the old cart simulator used, so tax/shipping rules can be tested straight away.
const EMPTY_CART: CartState = {
  lines: [],
  coupon: '',
  customer: { name: '', email: '', phone: '' },
  address: { addressLine1: '', addressLine2: '', city: 'Surat', state: 'Gujarat', postalCode: '395007', country: 'India' },
  locationId: '',
};

const lineKey = (l: { productId: string; variantId?: string }) => `${l.productId}:${l.variantId ?? ''}`;

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function parseStored(raw: string | null): CartState | null {
  if (raw === null) return null;
  try {
    const data = JSON.parse(raw);
    return { ...EMPTY_CART, ...data, customer: { ...EMPTY_CART.customer, ...data.customer }, address: { ...EMPTY_CART.address, ...data.address } };
  } catch {
    return { ...EMPTY_CART };
  }
}

const noSubscribe = () => () => {};

function variantLabel(v: NonNullable<Product['variants']>[number]) {
  return [v.size, v.color].filter(Boolean).join(' / ') || 'Variant';
}

function CartPage() {
  // Cart survives refreshes (browser storage). Server snapshot is null so static HTML and hydration match.
  const storedRaw = React.useSyncExternalStore(noSubscribe, readStored, () => null);
  const initial = React.useMemo(() => parseStored(storedRaw), [storedRaw]);
  const [edited, setEdited] = React.useState<CartState | null>(null);
  const cart = edited ?? initial;
  const { confirm, dialog } = useConfirm();

  const setCart = (patch: Partial<CartState>) => {
    if (!cart) return;
    const next = { ...cart, ...patch };
    setEdited(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the cart still works for this visit.
    }
  };

  // Product details for the lines (name, image, variants, stock).
  const [products, setProducts] = React.useState<Record<string, Product>>({});
  const missingIds = (cart?.lines ?? []).map((l) => l.productId).filter((id) => !products[id]);
  const missingKey = [...new Set(missingIds)].join(',');
  React.useEffect(() => {
    if (!missingKey) return;
    let active = true;
    fetch(`${API_BASE}/products?ids=${missingKey}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (active && d.success) setProducts((prev) => ({ ...prev, ...Object.fromEntries((d.products as Product[]).map((p) => [p._id, p])) }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [missingKey]);

  // Product search
  const [search, setSearch] = React.useState('');
  const [results, setResults] = React.useState<{ q: string; products: Product[] } | null>(null);
  React.useEffect(() => {
    const q = search.trim();
    if (!q) return;
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      listProducts({ search: q, limit: 8, sort: 'name', order: 'asc' }, controller.signal)
        .then((res) => setResults({ q, products: res.products }))
        .catch(() => {});
    }, 250);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [search]);
  const visibleResults = search.trim() && results?.q === search.trim() ? results.products : [];

  // Live pricing through the same pipeline orders use.
  const [couponDraft, setCouponDraft] = React.useState<string | null>(null);
  const couponValue = couponDraft ?? cart?.coupon ?? '';
  const pricingInput = cart
    ? { items: cart.lines, couponCode: cart.coupon || undefined, customerAddress: cart.address, selectedLocationId: cart.locationId || undefined }
    : null;
  const pricingKey = pricingInput && cart!.lines.length ? JSON.stringify(pricingInput) : null;
  const [calc, setCalc] = React.useState<{ key: string; data: CartCalculation | null; error: string | null } | null>(null);
  React.useEffect(() => {
    if (!pricingKey) return;
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      calculateCart(JSON.parse(pricingKey), controller.signal)
        .then((data) => setCalc({ key: pricingKey, data, error: null }))
        .catch((err) => {
          if (!controller.signal.aborted) setCalc({ key: pricingKey, data: null, error: err instanceof Error ? err.message : 'Could not calculate the cart.' });
        });
    }, 350);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [pricingKey]);
  const calcCurrent = calc && calc.key === pricingKey ? calc : null;
  const lastData = calc?.data ?? null;
  const calculating = Boolean(pricingKey) && !calcCurrent;

  const [placing, setPlacing] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [placeError, setPlaceError] = React.useState<string | null>(null);

  if (!cart) return null;

  const addProduct = (p: Product) => {
    setProducts((prev) => ({ ...prev, [p._id]: p }));
    const variants = p.variants ?? [];
    const variant = variants.find((v) => (v.stock ?? 0) > 0) ?? variants[0];
    const line: CartLine = { productId: p._id, ...(variant?._id ? { variantId: String(variant._id) } : {}), quantity: 1 };
    const existing = cart.lines.find((l) => lineKey(l) === lineKey(line));
    setCart({
      lines: existing ? cart.lines.map((l) => (lineKey(l) === lineKey(line) ? { ...l, quantity: l.quantity + 1 } : l)) : [...cart.lines, line],
    });
    setSearch('');
  };

  const updateLine = (key: string, patch: Partial<CartLine>) => {
    const next = cart.lines.map((l) => (lineKey(l) === key ? { ...l, ...patch } : l));
    // Changing a variant can make two lines identical; merge them.
    const merged: CartLine[] = [];
    for (const l of next) {
      const same = merged.find((m) => lineKey(m) === lineKey(l));
      if (same) same.quantity += l.quantity;
      else merged.push({ ...l });
    }
    setCart({ lines: merged.filter((l) => l.quantity > 0) });
  };

  const priced = (line: CartLine): OrderItem | undefined =>
    lastData?.items.find((i) => !i.isAutoAddedGift && String(i.productId) === line.productId && (i.variantId ?? '') === (line.variantId ?? ''));
  const giftLines = (lastData?.items ?? []).filter((i) => i.isAutoAddedGift);
  const stockIssues = calcCurrent?.data?.stockIssues ?? [];
  const locations = lastData?.pricing.availableLocations ?? [];

  const validate = () => {
    const found: Record<string, string> = {};
    if (!cart.customer.name.trim()) found.name = 'Customer name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cart.customer.email.trim())) found.email = 'Enter a valid email.';
    if (!(cart.address.addressLine1 ?? '').trim()) found.addressLine1 = 'Address is required.';
    return found;
  };

  const place = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }
    setPlacing(true);
    setPlaceError(null);
    try {
      const res = await placeOrder({
        items: cart.lines,
        couponCode: cart.coupon || undefined,
        customerDetails: { name: cart.customer.name.trim(), email: cart.customer.email.trim(), phone: cart.customer.phone.trim() || undefined },
        customerAddress: cart.address,
        selectedLocationId: cart.locationId || undefined,
      });
      setCart({ lines: [], coupon: '' });
      toast.flash('Order placed', `#${res.orderNumber}`);
      navigate(orderUrls.detail(String(res.orderId)));
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : 'Could not place the order.');
      setPlacing(false);
    }
  };

  const clearCart = () =>
    confirm({
      title: 'Clear cart?',
      description: 'All items and the discount code will be removed. Customer details are kept.',
      confirmLabel: 'Clear cart',
      destructive: true,
      onConfirm: () => setCart({ lines: [], coupon: '' }),
    });

  const setCustomer = (patch: Partial<Customer>) => {
    setCart({ customer: { ...cart.customer, ...patch } });
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch))));
  };
  const setAddress = (patch: Partial<Address>) => {
    setCart({ address: { ...cart.address, ...patch } });
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch))));
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Orders', href: orderUrls.list() }, { label: 'Cart' }]}
        title="Cart"
        description="Build a cart to check discounts, shipping and tax live, then place it as a real order."
        actions={
          cart.lines.length > 0 && (
            <Button variant="outline" size="sm" className="rounded-md" onClick={clearCart}>
              Clear cart
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <SectionCard title="Items">
            <div className="relative border-b px-5 py-3">
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-7.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cart-product-search"
                type="search"
                aria-label="Search products to add"
                placeholder="Search products by name or SKU to add…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(controlClass, 'pl-8')}
              />
              {visibleResults.length > 0 && (
                <ul className="absolute inset-x-5 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover shadow-lg" role="listbox">
                  {visibleResults.map((p) => (
                    <li key={p._id}>
                      <button type="button" role="option" aria-selected={false} className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-muted/60" onClick={() => addProduct(p)}>
                        <ProductThumbnail src={p.images?.[0]} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {p.sku}
                            {p.variants?.length ? ` · ${p.variants.length} variants` : ` · ${p.stock ?? 0} in stock`}
                          </span>
                        </span>
                        <span className="tabular-nums">{formatMoney(p.pricing?.catalogPrice ?? p.price)}</span>
                        {p.status !== 'Published' && <ProductStatusBadge status={p.status} />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {search.trim() && results?.q === search.trim() && visibleResults.length === 0 && (
                <p className="pt-2 text-xs text-muted-foreground">No products match “{search.trim()}”.</p>
              )}
            </div>

            {cart.lines.length === 0 ? (
              <EmptyState icon={ShoppingCart01Icon} title="Your cart is empty" description="Search for a product above to add it." />
            ) : (
              <div className={cn('divide-y', calculating && 'opacity-70 transition-opacity')}>
                {cart.lines.map((line) => {
                  const key = lineKey(line);
                  const product = products[line.productId];
                  const item = priced(line);
                  const variants = product?.variants ?? [];
                  const stockIssue = stockIssues.find((s) => s.productId === line.productId && (s.variantId ?? '') === (line.variantId ?? ''));
                  const display: OrderItem = item ?? {
                    productId: line.productId,
                    variantId: line.variantId,
                    name: product?.name ?? 'Loading…',
                    sku: product?.sku,
                    price: product?.pricing?.catalogPrice ?? product?.price ?? 0,
                    quantity: line.quantity,
                  };
                  return (
                    <LineItem
                      key={key}
                      item={{ ...display, quantity: line.quantity }}
                      image={product?.images?.[0]}
                      controls={
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {variants.length > 0 && (
                            <SelectField
                              id={`variant-${key}`}
                              value={line.variantId ?? ''}
                              options={variants.map((v) => ({ value: String(v._id), label: `${variantLabel(v)} · ${v.stock ?? 0} in stock` }))}
                              onChange={(v) => updateLine(key, { variantId: v })}
                              className="h-7 w-auto min-w-40"
                            />
                          )}
                          <div className="flex items-center rounded-md border">
                            <Button variant="ghost" size="icon-sm" className="rounded-none rounded-l-md" aria-label="Decrease quantity" onClick={() => updateLine(key, { quantity: line.quantity - 1 })}>
                              <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} />
                            </Button>
                            <input
                              aria-label="Quantity"
                              inputMode="numeric"
                              value={line.quantity}
                              onChange={(e) => {
                                const n = Math.floor(Number(e.target.value));
                                if (Number.isFinite(n) && n >= 1) updateLine(key, { quantity: Math.min(1000, n) });
                              }}
                              className="h-7 w-10 border-x bg-transparent text-center text-[13px] tabular-nums outline-none"
                            />
                            <Button variant="ghost" size="icon-sm" className="rounded-none rounded-r-md" aria-label="Increase quantity" onClick={() => updateLine(key, { quantity: line.quantity + 1 })}>
                              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                            </Button>
                          </div>
                          <Button variant="ghost" size="icon-sm" className="rounded-md text-muted-foreground hover:text-destructive" aria-label={`Remove ${display.name}`} onClick={() => updateLine(key, { quantity: 0 })}>
                            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                          </Button>
                          {stockIssue && <span className="text-xs text-destructive">Only {stockIssue.available} in stock</span>}
                        </div>
                      }
                    />
                  );
                })}
                {giftLines.map((g, i) => (
                  <LineItem key={`gift-${i}`} item={g} image={products[String(g.productId)]?.images?.[0]} />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Customer" bodyClassName="grid gap-4 p-5 sm:grid-cols-2">
            <Field id="name" label="Name" error={errors.name}>
              <TextInput id="name" value={cart.customer.name} error={errors.name} onChange={(e) => setCustomer({ name: e.target.value })} />
            </Field>
            <Field id="email" label="Email" error={errors.email}>
              <TextInput id="email" type="email" value={cart.customer.email} error={errors.email} onChange={(e) => setCustomer({ email: e.target.value })} />
            </Field>
            <Field id="phone" label="Phone" optional>
              <TextInput id="phone" type="tel" value={cart.customer.phone} onChange={(e) => setCustomer({ phone: e.target.value })} />
            </Field>
          </SectionCard>

          <SectionCard title="Shipping address" description="Used for shipping and tax rules." bodyClassName="space-y-4 p-5">
            <AddressFields
              idPrefix="ship"
              line1Label="Address"
              errors={{ addressLine1: errors.addressLine1 }}
              value={{
                addressLine1: cart.address.addressLine1 ?? '',
                addressLine2: cart.address.addressLine2 ?? '',
                city: cart.address.city ?? '',
                state: cart.address.state ?? '',
                postalCode: cart.address.postalCode ?? '',
                country: cart.address.country ?? '',
              }}
              onChange={setAddress}
            />
            {locations.length > 0 && (
              <Field id="location" label="Ship from" hint="Locations that can deliver to this address, nearest first.">
                <SelectField
                  id="location"
                  value={cart.locationId || String(locations[0].locationId)}
                  options={locations.map((l) => ({ value: String(l.locationId), label: `${l.name} · ${l.distanceKm.toFixed(1)} km · ${formatMoney(l.shippingCost)}` }))}
                  onChange={(v) => setCart({ locationId: v })}
                />
              </Field>
            )}
          </SectionCard>
        </div>

        <div className="min-w-0">
          <div className="space-y-4 lg:sticky lg:top-4">
            <SectionCard title="Summary" description={calculating ? 'Recalculating…' : undefined}>
              <form
                className="flex gap-2 border-b px-5 py-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setCart({ coupon: couponValue.trim() });
                  setCouponDraft(null);
                }}
              >
                <TextInput id="coupon" aria-label="Discount code" placeholder="Discount code" value={couponValue} onChange={(e) => setCouponDraft(e.target.value)} className="uppercase" />
                {cart.coupon && couponValue.trim().toLowerCase() === cart.coupon.toLowerCase() ? (
                  <Button type="button" variant="outline" size="sm" className="h-8 rounded-md" onClick={() => { setCart({ coupon: '' }); setCouponDraft(''); }}>
                    Remove
                  </Button>
                ) : (
                  <Button type="submit" variant="outline" size="sm" className="h-8 rounded-md" disabled={!couponValue.trim()}>
                    Apply
                  </Button>
                )}
              </form>

              <div className="space-y-3 px-5 py-4">
                {cart.lines.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">Add items to see discounts, shipping and tax.</p>
                ) : calc?.error && !calcCurrent?.data ? (
                  <InlineError message={calc.error} />
                ) : lastData ? (
                  <PricingBreakdown pricing={lastData.pricing} />
                ) : (
                  <p className="text-[13px] text-muted-foreground">Calculating…</p>
                )}

                {(lastData?.pricing.progressNotices?.length ?? 0) > 0 && (
                  <ul className="space-y-1 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                    {lastData!.pricing.progressNotices!.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
                {(lastData?.pricing.taxSnapshot?.configurationErrors?.length ?? 0) > 0 && (
                  <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    {lastData!.pricing.taxSnapshot!.configurationErrors!.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
                {lastData?.pricing.shippingSnapshot?.error && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">Shipping: {lastData.pricing.shippingSnapshot.error}</p>
                )}
                {stockIssues.length > 0 && <InlineError message="Some items don't have enough stock. Lower the quantity to place the order." />}
                {placeError && <InlineError message={placeError} />}

                <Button
                  className="h-9 w-full rounded-md"
                  disabled={placing || cart.lines.length === 0 || calculating || stockIssues.length > 0 || !calcCurrent?.data}
                  onClick={place}
                >
                  {placing ? 'Placing order…' : lastData && cart.lines.length ? `Place order · ${formatMoney(lastData.pricing.totalAmount)}` : 'Place order'}
                </Button>
                <p className="text-xs text-muted-foreground">Creates a real order (marked “Admin cart”) and reduces stock. You can cancel it from the order page.</p>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
      {dialog}
    </div>
  );
}

export default function Page() {
  return (
    <AdminToaster>
      <CartPage />
    </AdminToaster>
  );
}
