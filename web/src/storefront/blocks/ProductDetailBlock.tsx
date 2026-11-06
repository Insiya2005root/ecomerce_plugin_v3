import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, Check, ImageOff, Minus, Plus, RotateCcw, ShoppingBag, Truck, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { StorefrontErrorState, StorefrontNotFoundState, StorefrontShell } from '../components/StorefrontState';
import { storefrontApiClient, StorefrontRequestError } from '../services/storefrontApiClient';
import { cart, cartDrawer } from '../cart/cartStore';
import { notify } from '../cart/notify';
import { currentProductSlug, formatInr, storefrontLinks } from '../cart/links';
import { useCategories, useStoreInfo } from '../cart/storeData';
import type { BlockSettingsMap, PublicProductDTO, PublicVariantDTO, StorefrontBlockComponentProps } from '../types/storefront';

const variantLabel = (v: PublicVariantDTO) => [v.size, v.color].filter(Boolean).join(' / ') || 'Default';

function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12" role="status" aria-busy="true">
      <span className="sr-only">Loading product…</span>
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

/**
 * Product page: gallery, price and savings, size/colour, live stock, quantity, Add to cart / Buy now,
 * delivery perks and description tabs. Reads the product from ?slug= (address /product?slug=<slug or id>).
 * In the page builder, with no product in the address, it previews the newest product.
 */
export function ProductDetailBlock({ settings, isEditing }: StorefrontBlockComponentProps<BlockSettingsMap>) {
  const showVariantPicker = settings.showVariantPicker !== false;
  const showQuantity = settings.showQuantitySelector !== false;
  const showStock = settings.showStockStatus !== false;
  const showSku = settings.showSku !== false;
  const showDescription = settings.showDescriptionTab !== false;
  const showBuyNow = settings.showBuyNow !== false;
  const showPerks = settings.showPerks !== false;
  const showBreadcrumbs = settings.showBreadcrumbs !== false;
  const galleryRight = settings.galleryPosition === 'right';
  const categories = useCategories();
  const info = useStoreInfo();

  const [slug] = useState(currentProductSlug);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'missing' | 'error'; product?: PublicProductDTO; error?: string }>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState<string | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [tab, setTab] = useState<'description' | 'shipping'>('description');

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    const load = slug
      ? storefrontApiClient.getProductBySlugOrId(slug, { signal: controller.signal }).then((r) => r.product)
      : isEditing
        ? storefrontApiClient.getProducts({ limit: 1 }, { signal: controller.signal }).then((r) => r.products?.[0])
        : Promise.resolve(undefined);
    load
      .then((product) => {
        if (!product) return setState({ status: 'missing' });
        setState({ status: 'ready', product });
        const firstInStock = product.variants.find((v) => v.inStock && v.id) ?? product.variants.find((v) => v.id);
        setVariantId(firstInStock?.id);
        setImageIndex(0);
        if (!isEditing && product.name) document.title = product.metaTitle || product.name;
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof StorefrontRequestError && err.isNotFound) return setState({ status: 'missing' });
        setState({ status: 'error', error: err instanceof Error ? err.message : 'Could not load this product.' });
      });
    return () => controller.abort();
  }, [slug, isEditing, reload]);

  const product = state.product;
  const variant = useMemo(() => product?.variants.find((v) => v.id === variantId), [product, variantId]);

  if (state.status === 'loading') return <StorefrontShell><DetailSkeleton /></StorefrontShell>;
  if (state.status === 'error') return <StorefrontShell><StorefrontErrorState message={state.error || ''} onRetry={() => setReload((n) => n + 1)} /></StorefrontShell>;
  if (state.status === 'missing' || !product) {
    return (
      <StorefrontShell>
        <StorefrontNotFoundState title="Product not found" description="This product isn't available any more." actionLabel="Back to the shop" actionHref={storefrontLinks.shop()} />
      </StorefrontShell>
    );
  }

  const hasVariants = product.variants.length > 0;
  const images = product.images.length ? product.images : product.image ? [product.image] : [];
  const unitPrice = variant?.priceOverride ?? product.catalogPrice;
  const compareAt = variant?.priceOverride != null ? null : product.compareAtPrice;
  const saving = compareAt != null && compareAt > unitPrice ? compareAt - unitPrice : 0;
  const available = hasVariants ? variant?.stock ?? 0 : product.stock;
  const inStock = available > 0;
  const maxQty = Math.max(1, Math.min(99, available));
  const category = categories.find((c) => c.id === product.categoryId);
  const parent = category?.parentId ? categories.find((c) => c.id === category.parentId) : undefined;

  const addToCart = () => {
    if (!inStock || isEditing) return false;
    cart.add({
      productId: product.id,
      variantId: variant?.id,
      quantity: Math.min(quantity, maxQty),
      name: product.name,
      variantLabel: variant ? variantLabel(variant) : undefined,
      image: images[0] ?? null,
      slug: product.slug || product.id,
    });
    return true;
  };

  const perks = [
    { icon: Truck, text: info.freeShippingThreshold > 0 ? `Free shipping on orders over ${formatInr(info.freeShippingThreshold)}` : 'Delivered to your door' },
    { icon: Banknote, text: 'Cash on Delivery available' },
    { icon: RotateCcw, text: String(settings.returnsText || 'Easy returns and exchanges') },
  ];

  return (
    <StorefrontShell>
      {showBreadcrumbs && (
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={storefrontLinks.shop()}>Shop</BreadcrumbLink>
            </BreadcrumbItem>
            {parent && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href={`${storefrontLinks.shop()}?category=${parent.id}`}>{parent.name}</BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            {category && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href={`${storefrontLinks.shop()}?category=${category.id}`}>{category.name}</BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[16rem] truncate">{product.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="ecom-sf-pdp grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className={cn('flex flex-col gap-3', galleryRight && 'lg:order-2')}>
          <div className="relative overflow-hidden rounded-[min(var(--radius-4xl),24px)] border bg-muted">
            {images[imageIndex] ? (
              <img src={images[imageIndex]} alt={product.name} className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center text-muted-foreground/60">
                <ImageOff className="size-12" aria-label="No image" />
              </div>
            )}
            {saving > 0 && product.discountPercentage > 0 && <Badge className="absolute top-4 left-4 rounded-md">−{Math.round(product.discountPercentage)}%</Badge>}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-3" role="list">
              {images.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  role="listitem"
                  className={cn(
                    'cursor-pointer overflow-hidden rounded-xl border-2 transition-colors',
                    i === imageIndex ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
                  )}
                  onClick={() => setImageIndex(i)}
                  aria-label={`Show image ${i + 1}`}
                  aria-current={i === imageIndex || undefined}
                >
                  <img src={src} alt="" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={cn('flex flex-col gap-5', galleryRight && 'lg:order-1')}>
          <div className="flex flex-col gap-2">
            {category && <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{category.name}</span>}
            <h1 className="ecom-sf-pdp-title text-3xl font-bold tracking-tight text-balance sm:text-4xl">{product.name}</h1>
            {showSku && !variant && product.sku && <p className="text-sm text-muted-foreground">SKU {product.sku}</p>}
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-semibold">{formatInr(unitPrice)}</span>
            {saving > 0 && <span className="text-lg text-muted-foreground line-through">MRP {formatInr(compareAt)}</span>}
            {saving > 0 && (
              <Badge variant="secondary" className="text-success">
                You save {formatInr(saving)}
              </Badge>
            )}
          </div>
          {settings.showTaxHint !== false && <p className="-mt-3 text-sm text-muted-foreground">Shipping and taxes calculated at checkout.</p>}

          {showVariantPicker && hasVariants && (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 text-sm">
                Option: <strong>{variant ? variantLabel(variant) : 'Choose one'}</strong>
              </legend>
              <div className="flex flex-wrap gap-2">
                {product.variants
                  .filter((v) => v.id)
                  .map((v) => (
                    <Button
                      key={v.id}
                      variant={v.id === variantId ? 'default' : 'outline'}
                      className={cn('ecom-sf-chip cursor-pointer', !v.inStock && 'text-muted-foreground line-through')}
                      aria-pressed={v.id === variantId}
                      onClick={() => {
                        setVariantId(v.id);
                        setQuantity(1);
                        setAdded(false);
                      }}
                    >
                      {variantLabel(v)}
                    </Button>
                  ))}
              </div>
            </fieldset>
          )}

          {showStock && (
            <p className={cn('flex items-center gap-2 text-sm font-medium', inStock ? 'text-success' : 'text-destructive')}>
              <span className={cn('size-2 rounded-full', inStock ? 'bg-success' : 'bg-destructive')} aria-hidden="true" />
              {inStock ? (available <= 5 ? `Only ${available} left` : 'In stock, ready to ship') : 'Out of stock'}
            </p>
          )}

          <div className="ecom-sf-buy-row flex flex-col gap-3 sm:flex-row">
            {showQuantity && (
              <div className="flex h-10 items-center justify-between gap-1 rounded-2xl border px-1 sm:w-36" aria-label="Quantity">
                <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Decrease quantity">
                  <Minus />
                </Button>
                <span className="w-8 text-center font-medium tabular-nums" aria-live="polite">
                  {quantity}
                </span>
                <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty} aria-label="Increase quantity">
                  <Plus />
                </Button>
              </div>
            )}
            <Button
              size="lg"
              className="ecom-sf-btn-primary h-10 flex-1 cursor-pointer text-base"
              disabled={!inStock}
              onClick={() => {
                if (!addToCart()) return;
                setAdded(true);
                if (cartDrawer.hasHost()) cartDrawer.setOpen(true);
                else notify(`${product.name} added to your cart.`, { label: 'View cart', href: storefrontLinks.cart() });
              }}
            >
              {added ? <Check data-icon="inline-start" /> : <ShoppingBag data-icon="inline-start" />}
              {inStock ? String(settings.addToCartLabel || 'Add to cart') : 'Out of stock'}
            </Button>
          </div>
          {inStock && showBuyNow && (
            <Button
              size="lg"
              variant="outline"
              className="-mt-2 h-10 w-full cursor-pointer text-base"
              onClick={() => {
                if (addToCart()) window.location.href = storefrontLinks.checkout();
              }}
            >
              <Zap data-icon="inline-start" />
              {String(settings.buyNowLabel || 'Buy now')}
            </Button>
          )}

          {showPerks && (
            <ul className="flex flex-col gap-3 rounded-2xl bg-muted/40 p-4 text-sm">
              {perks.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          )}

          {showDescription && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-1 rounded-2xl bg-muted p-1" role="tablist">
                {(
                  [
                    ['description', 'Description'],
                    ['shipping', 'Shipping & returns'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={cn(
                      'flex-1 cursor-pointer rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
                      tab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div role="tabpanel" className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {tab === 'description'
                  ? product.description || 'No description yet.'
                  : `Orders are packed and shipped from our store. Shipping cost is shown at checkout once you enter your PIN code${
                      info.freeShippingThreshold > 0 ? `, and it's free on orders over ${formatInr(info.freeShippingThreshold)}` : ''
                    }. Pay by Cash on Delivery. Contact us${info.supportEmail ? ` at ${info.supportEmail}` : ''} for returns or exchanges.`}
              </div>
            </div>
          )}
          <Separator className="lg:hidden" />
        </div>
      </div>
    </StorefrontShell>
  );
}
