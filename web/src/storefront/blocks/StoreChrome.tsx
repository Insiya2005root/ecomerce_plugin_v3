import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  ArrowRight,
  Banknote,
  Clock,
  Mail,
  Phone,
  RotateCcw,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { EditorHint, LinkButton, SectionHeading, StorefrontShell } from '../components/StorefrontState';
import { cartDrawer, useCart, useCartDrawerOpen } from '../cart/cartStore';
import { formatInr, storefrontLinks } from '../cart/links';
import { useCartQuote } from '../cart/pricing';
import { shopFilters } from '../cart/shopFilters';
import { topLevel, useCategories, useStoreInfo } from '../cart/storeData';
import { storefrontApiClient } from '../services/storefrontApiClient';
import { CartLines, FreeShippingProgress, itemCount } from './CartBlocks';
import type { BlockSettingsMap, PublicProductDTO, StorefrontBlockComponentProps } from '../types/storefront';

type Props = StorefrontBlockComponentProps<BlockSettingsMap>;
const text = (v: unknown, fallback = '') => (v === undefined || v === null ? fallback : String(v));

const onShopPage = () => typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '').endsWith('/shop');

/** Filters the grid in place on the shop page; elsewhere opens the shop with the filter. */
function goToShop(filter: { category?: string; q?: string }) {
  if (onShopPage()) {
    shopFilters.set({ category: filter.category ?? '', q: filter.q ?? '' });
    document.getElementById('ecom-sf-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const qs = new URLSearchParams();
  if (filter.category) qs.set('category', filter.category);
  if (filter.q) qs.set('q', filter.q);
  window.location.href = `${storefrontLinks.shop()}${qs.toString() ? `?${qs}` : ''}`;
}

/** "#catalog" scrolls to the product grid when the page has one; anything else is a normal link. */
function smartLink(href: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (href !== '#catalog') return;
    const target = document.getElementById('ecom-sf-catalog');
    e.preventDefault();
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.location.href = storefrontLinks.shop();
  };
}

/** Newest product photos, for the hero and the features image when no picture is set. */
function useProductImages(count: number, enabled = true) {
  const [images, setImages] = useState<string[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    storefrontApiClient
      .getProducts({ limit: 12, sort: 'newest' }, { signal: controller.signal })
      .then((r) => setImages((r.products || []).map((p: PublicProductDTO) => p.image).filter((s): s is string => Boolean(s)).slice(0, count)))
      .catch(() => setImages([]));
    return () => controller.abort();
  }, [count, enabled]);
  return images;
}

// ---------------------------------------------------------------------------------------------------------
// Mini cart: a shadcn Drawer from the right, opened by the cart button and after "Add to cart".
// Only the first cart button on the page renders it, so two buttons never open two drawers.
// ---------------------------------------------------------------------------------------------------------
let drawerOwner: symbol | null = null;
const ownerListeners = new Set<() => void>();
function useOwnsDrawer(active: boolean) {
  const [id] = useState(() => Symbol('cart-drawer'));
  useEffect(() => {
    if (!active) return;
    const release = cartDrawer.registerHost();
    if (!drawerOwner) {
      drawerOwner = id;
      ownerListeners.forEach((l) => l());
    }
    return () => {
      release();
      if (drawerOwner === id) {
        drawerOwner = null;
        ownerListeners.forEach((l) => l());
      }
    };
  }, [active, id]);
  return useSyncExternalStore(
    (cb) => {
      ownerListeners.add(cb);
      return () => ownerListeners.delete(cb);
    },
    () => drawerOwner === id,
    () => false
  );
}

function MiniCart() {
  const open = useCartDrawerOpen();
  const c = useCart();
  const { quote } = useCartQuote();
  const count = itemCount(c.lines);
  return (
    <Drawer open={open} onOpenChange={(o) => cartDrawer.setOpen(o)} swipeDirection="right">
      <DrawerContent className="ecom-sf-drawer" aria-label="Your cart">
        <DrawerHeader className="flex-row items-center justify-between pb-2">
          <DrawerTitle className="text-lg font-semibold">Your cart{count ? ` (${count})` : ''}</DrawerTitle>
          <DrawerClose render={<Button variant="ghost" size="icon" className="cursor-pointer" aria-label="Close cart" />}>
            <X />
          </DrawerClose>
        </DrawerHeader>
        {c.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <ShoppingBag className="size-12 text-muted-foreground/50" aria-hidden="true" />
            <p className="font-medium">Your cart is empty</p>
            <LinkButton href={storefrontLinks.shop()} size="default">
              Start shopping
            </LinkButton>
          </div>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4">
              <FreeShippingProgress quote={quote} />
              <CartLines settings={{}} compact />
            </div>
            <DrawerFooter className="gap-3 border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <strong className="text-base">{quote ? formatInr(quote.pricing.subtotal - quote.pricing.discount) : '…'}</strong>
              </div>
              <p className="text-xs text-muted-foreground">Shipping and taxes are calculated at checkout.</p>
              <LinkButton href={storefrontLinks.checkout()} className="ecom-sf-btn-primary h-10 w-full text-base">
                Checkout
              </LinkButton>
              <LinkButton href={storefrontLinks.cart()} variant="outline" className="w-full">
                View cart
              </LinkButton>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function CartButton({ label, showLabel, showCount, isEditing }: { label: string; showLabel: boolean; showCount: boolean; isEditing: boolean }) {
  const count = itemCount(useCart().lines);
  return (
    <Button
      variant="outline"
      className="ecom-sf-cart-btn relative h-9 cursor-pointer gap-2 rounded-full px-3"
      onClick={() => !isEditing && cartDrawer.setOpen(true)}
      aria-label={`Open cart, ${count} item${count === 1 ? '' : 's'}`}
    >
      <ShoppingBag className="size-4" aria-hidden="true" />
      {showLabel && label && <span className="hidden sm:inline">{label}</span>}
      {showCount && count > 0 && <Badge className="ecom-sf-cart-count h-5 min-w-5 rounded-full px-1.5 tabular-nums">{count}</Badge>}
    </Button>
  );
}

function SearchBox({ placeholder, isEditing, className }: { placeholder: string; isEditing: boolean; className?: string }) {
  const [q, setQ] = useState(() => (onShopPage() ? new URLSearchParams(window.location.search).get('q') || '' : ''));
  return (
    <form
      className={cn('ecom-sf-header-search relative', className)}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isEditing) goToShop({ q: q.trim() });
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input type="search" className="h-9 rounded-full pl-9" placeholder={placeholder} aria-label="Search the store" value={q} onChange={(e) => setQ(e.target.value)} />
    </form>
  );
}

const JUSTIFY: Record<string, string> = { left: 'justify-start', center: 'justify-center', right: 'justify-end' };

/** Header piece for OpenExt's site header: cart button with item count; opens the mini cart. */
export function CartButtonBlock({ settings, isEditing }: Props) {
  const owns = useOwnsDrawer(!isEditing);
  return (
    <div className={cn('ecom-sf-header-slot flex w-full items-center py-1', JUSTIFY[text(settings.align, 'right')] || 'justify-end')}>
      <CartButton label={text(settings.label, 'Cart')} showLabel={settings.showLabel !== false} showCount={settings.showCount !== false} isEditing={isEditing} />
      {owns && <MiniCart />}
    </div>
  );
}

/** Header piece for OpenExt's site header: a search box that filters the shop (or opens it with the search). */
export function ProductSearchBlock({ settings, isEditing }: Props) {
  return (
    <div className={cn('ecom-sf-header-slot flex w-full items-center py-1', JUSTIFY[text(settings.align, 'center')] || 'justify-center')}>
      <SearchBox placeholder={text(settings.placeholder, 'Search products')} isEditing={isEditing} className="w-full max-w-sm min-w-0" />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Hero (shadcn hero-section-1): badge, heading, text, buttons, highlights and a picture.
// ---------------------------------------------------------------------------------------------------------
const HERO_TONE: Record<string, string> = {
  plain: '',
  soft: 'rounded-[min(var(--radius-4xl),32px)] bg-muted/60 px-6 sm:px-10',
  dark: 'rounded-[min(var(--radius-4xl),32px)] bg-primary px-6 text-primary-foreground sm:px-10',
  accent: 'rounded-[min(var(--radius-4xl),32px)] bg-gradient-to-br from-amber-100 via-rose-50 to-sky-100 px-6 text-neutral-900 sm:px-10 dark:from-amber-500/15 dark:via-rose-500/10 dark:to-sky-500/15 dark:text-foreground',
};

export function ShopHeroBlock({ settings }: Props) {
  const info = useStoreInfo();
  const source = text(settings.imageSource, 'products');
  const custom = text(settings.imageUrl).trim();
  const photos = useProductImages(source === 'product' ? 1 : 3, source === 'products' || source === 'product' || (source === 'custom' && !custom));
  const tone = HERO_TONE[text(settings.style, 'plain')] !== undefined ? text(settings.style, 'plain') : 'plain';
  const dark = tone === 'dark';
  const imageLeft = settings.imagePosition === 'left';
  const showImage = source !== 'none';
  const images = source === 'custom' && custom ? [custom] : photos;
  const highlights =
    settings.showHighlights === false
      ? []
      : text(settings.highlights).trim()
        ? text(settings.highlights).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4)
        : [
            'Cash on Delivery',
            info.freeShippingThreshold > 0 ? `Free shipping over ${formatInr(info.freeShippingThreshold)}` : 'Fast delivery',
            'Easy returns',
          ];
  const primaryLink = text(settings.buttonLink, '#catalog') || '#catalog';
  const secondaryLabel = text(settings.secondaryButtonLabel);
  const secondaryLink = text(settings.secondaryButtonLink, storefrontLinks.cart());

  return (
    <section className="ecom-sf-shell w-full text-foreground dark:bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className={cn('ecom-sf-hero py-12 lg:py-20', HERO_TONE[tone])}>
          <div className={cn('grid items-center gap-8 lg:gap-12', showImage && 'lg:grid-cols-2')}>
            <div className={cn('flex flex-col gap-8 text-center lg:text-start', !showImage && 'mx-auto max-w-3xl lg:text-center', imageLeft && 'lg:order-2')}>
              <header className={cn('flex flex-col gap-4', !showImage && 'items-center')}>
                {text(settings.eyebrow) && (
                  <Badge
                    variant="outline"
                    className={cn('h-auto self-center rounded-md px-3.5 py-1 font-semibold text-muted-foreground', showImage && 'lg:self-start', dark && 'border-primary-foreground/30 text-primary-foreground/80')}
                  >
                    {text(settings.eyebrow)}
                  </Badge>
                )}
                <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">{text(settings.heading, 'Shop the collection')}</h1>
                {text(settings.subheading) && <p className={cn('text-balance md:text-lg', dark ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{text(settings.subheading)}</p>}
              </header>

              <div className={cn('flex flex-wrap justify-center gap-3', showImage && 'lg:justify-start')}>
                {text(settings.buttonLabel, 'Shop all products') && (
                  <LinkButton href={primaryLink} onClick={smartLink(primaryLink)} variant={dark ? 'secondary' : 'default'} className="h-10 px-8 text-base">
                    {text(settings.buttonLabel, 'Shop all products')}
                    <ArrowRight data-icon="inline-end" />
                  </LinkButton>
                )}
                {secondaryLabel && (
                  <LinkButton
                    href={secondaryLink}
                    onClick={smartLink(secondaryLink)}
                    variant="outline"
                    className={cn('h-10 px-8 text-base', dark && 'border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground')}
                  >
                    {secondaryLabel}
                  </LinkButton>
                )}
              </div>

              {highlights.length > 0 && (
                <ul className={cn('flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm', showImage && 'lg:justify-start', dark ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {highlights.map((h, i) => {
                    const Icon = [Banknote, Truck, RotateCcw, Shield][i % 4];
                    return (
                      <li key={h} className="flex items-center gap-2">
                        <Icon className="size-4" aria-hidden="true" />
                        {h}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {showImage && (
              <div className={cn('overflow-hidden rounded-xl', imageLeft && 'lg:order-1')} aria-hidden="true">
                {images.length >= 3 && source === 'products' ? (
                  <div className="grid aspect-[4/3] grid-cols-2 grid-rows-2 gap-3">
                    <img src={images[0]} alt="" className="row-span-2 size-full rounded-xl object-cover" />
                    <img src={images[1]} alt="" className="size-full rounded-xl object-cover" />
                    <img src={images[2]} alt="" className="size-full rounded-xl object-cover" />
                  </div>
                ) : images[0] ? (
                  <img src={images[0]} alt="" className="aspect-[4/3] size-full rounded-xl border object-cover" />
                ) : (
                  <div className={cn('aspect-[4/3] rounded-xl', dark ? 'bg-primary-foreground/10' : 'bg-muted')} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Shop by category (shadcn product-category-2): picture tiles with the name over a gradient.
// ---------------------------------------------------------------------------------------------------------
const TILE_TINTS = [
  'from-amber-200 to-orange-300',
  'from-sky-200 to-indigo-300',
  'from-emerald-200 to-teal-300',
  'from-rose-200 to-pink-300',
  'from-violet-200 to-purple-300',
  'from-lime-200 to-green-300',
  'from-cyan-200 to-sky-300',
  'from-stone-200 to-stone-300',
];
const TILE_COLS: Record<number, string> = { 2: '@2xl:grid-cols-2', 3: '@2xl:grid-cols-2 @4xl:grid-cols-3', 4: '@2xl:grid-cols-2 @4xl:grid-cols-4' };

export function CategoryShowcaseBlock({ settings, isEditing }: Props) {
  const all = useCategories();
  const max = Math.max(2, Math.min(8, Number(settings.maxItems) || 4));
  const cols = Math.max(2, Math.min(4, Number(settings.columns) || 3));
  const cats = topLevel(all).slice(0, max);
  const centered = settings.align !== 'left';
  if (cats.length === 0) {
    return isEditing ? (
      <StorefrontShell>
        <EditorHint>Category tiles appear once you add categories.</EditorHint>
      </StorefrontShell>
    ) : null;
  }
  const viewAll = settings.showViewAll !== false && (
    <LinkButton href={storefrontLinks.shop()} className={cn('h-10 gap-2 px-4', centered ? '' : 'self-start sm:self-auto')}>
      <ShoppingBag className="size-5" aria-hidden="true" />
      {text(settings.viewAllLabel, 'View all products')}
    </LinkButton>
  );
  return (
    <StorefrontShell innerClassName="py-12">
      <SectionHeading
        title={text(settings.heading, 'Shop by category')}
        description={text(settings.subheading, 'Discover products across our most popular categories')}
        align={centered ? 'center' : 'left'}
        action={centered ? undefined : viewAll}
      />
      <div className="@container">
        <div className={cn('grid grid-cols-1 gap-6', TILE_COLS[cols])}>
          {cats.map((cat, i) => {
            const subs = all.filter((s) => s.parentId === cat.id);
            return (
              <a
                key={cat.id}
                href={`${storefrontLinks.shop()}?category=${cat.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  goToShop({ category: cat.id });
                }}
                className="ecom-sf-tile group block"
              >
                <Card className="overflow-hidden py-0 transition-all duration-500 hover:shadow-lg">
                  <div className="relative aspect-[5/4] overflow-hidden">
                    {cat.image ? (
                      <img src={cat.image} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className={cn('flex size-full items-center justify-center bg-gradient-to-br transition-transform duration-500 group-hover:scale-105', TILE_TINTS[i % TILE_TINTS.length])}>
                        <span className="text-7xl font-bold text-white/70">{cat.name.slice(0, 1)}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    <div className="absolute right-0 bottom-0 left-0 p-6 text-white">
                      <h3 className="mb-1 text-xl font-bold">{cat.name}</h3>
                      {(cat.description || subs.length > 0) && (
                        <p className="mb-3 line-clamp-2 text-sm text-white/90">{cat.description || subs.map((s) => s.name).slice(0, 3).join(' · ')}</p>
                      )}
                      <div className="flex items-center justify-end">
                        <span className="inline-flex h-8 items-center gap-1 rounded-2xl border border-white/30 bg-white/20 px-3 text-xs font-medium backdrop-blur-sm transition-colors group-hover:bg-white/30">
                          {text(settings.tileButtonLabel, 'Browse')}
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </a>
            );
          })}
        </div>
      </div>
      {centered && viewAll && <div className="mt-12 text-center">{viewAll}</div>}
    </StorefrontShell>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Store features (shadcn feature-1 cards / feature-2 split with a picture / a compact strip).
// ---------------------------------------------------------------------------------------------------------
export function TrustBadgesBlock({ settings }: Props) {
  const info = useStoreInfo();
  const layout = ['cards', 'split', 'strip'].includes(text(settings.layout)) ? text(settings.layout) : 'strip';
  const customImage = text(settings.imageUrl).trim();
  const photos = useProductImages(1, layout === 'split' && !customImage);
  const items = [
    settings.showShipping !== false && {
      icon: Truck,
      title: text(settings.shippingTitle) || (info.freeShippingThreshold > 0 ? `Free shipping over ${formatInr(info.freeShippingThreshold)}` : 'Fast delivery'),
      text: text(settings.shippingText, 'Delivered to your door across India.'),
    },
    settings.showCod !== false && { icon: Banknote, title: text(settings.codTitle) || 'Cash on Delivery', text: text(settings.codText, 'Pay in cash or UPI when your order arrives.') },
    settings.showReturns !== false && { icon: RotateCcw, title: text(settings.returnsText) || 'Easy returns', text: text(settings.returnsDetail, 'Hassle-free returns and exchanges.') },
    settings.showSecure !== false && { icon: Shield, title: text(settings.secureTitle) || 'Secure checkout', text: text(settings.secureText, 'Your details stay private and are only used for your order.') },
    settings.showSupport === true && {
      icon: Clock,
      title: text(settings.supportTitle) || 'Friendly support',
      text: text(settings.supportText) || (info.supportPhone || info.supportEmail ? `Reach us at ${info.supportPhone || info.supportEmail}.` : 'We are here to help with every order.'),
    },
  ].filter(Boolean) as { icon: LucideIcon; title: string; text: string }[];
  if (items.length === 0) return null;
  const eyebrow = text(settings.eyebrow);
  const heading = text(settings.heading);
  const subheading = text(settings.subheading);
  const buttonLabel = text(settings.buttonLabel);
  const buttonLink = text(settings.buttonLink, storefrontLinks.shop()) || storefrontLinks.shop();
  const button = buttonLabel ? (
    <LinkButton href={buttonLink} onClick={smartLink(buttonLink)} className="h-10 rounded-lg px-8!">
      {buttonLabel}
      <ArrowRight data-icon="inline-end" />
    </LinkButton>
  ) : null;

  if (layout === 'strip') {
    return (
      <StorefrontShell>
        {(heading || subheading) && <SectionHeading title={heading} description={subheading} align="center" />}
        <ul className="ecom-sf-trust grid gap-4 rounded-[min(var(--radius-4xl),24px)] border bg-muted/30 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          {items.map((b) => (
            <li key={b.title} className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-foreground shadow-sm ring-1 ring-foreground/5">
                <b.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-0.5">
                <strong className="text-sm font-semibold">{b.title}</strong>
                <span className="text-xs text-muted-foreground">{b.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </StorefrontShell>
    );
  }

  if (layout === 'split') {
    const image = customImage || photos[0];
    return (
      <StorefrontShell innerClassName="py-12 md:py-16">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-10">
            <header className="flex flex-col gap-4">
              {eyebrow && <Badge variant="secondary" className="h-auto w-fit rounded-full px-4 py-1 font-medium">{eyebrow}</Badge>}
              <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">{heading || 'Why shop with us'}</h2>
              {subheading && <p className="text-base text-pretty text-muted-foreground md:text-lg">{subheading}</p>}
            </header>
            <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
              {items.map(({ icon: Icon, title, text: body }) => (
                <div key={title} className="flex flex-col items-start gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-base font-semibold md:text-lg">{title}</h3>
                    <p className="text-sm text-balance text-muted-foreground">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            {button && <div>{button}</div>}
          </div>
          <div className="relative">
            <div className="relative overflow-hidden rounded-lg bg-muted shadow-sm transition-shadow duration-300 hover:shadow-md">
              <div className="aspect-[4/3] w-full">{image && <img src={image} alt="" className="size-full object-cover" loading="lazy" decoding="async" />}</div>
            </div>
          </div>
        </div>
      </StorefrontShell>
    );
  }

  return (
    <StorefrontShell innerClassName="py-12 md:py-16">
      <header className="mx-auto mb-12 flex max-w-2xl flex-col items-center text-center">
        {eyebrow && <Badge variant="secondary" className="mb-4 h-auto rounded-full px-4 py-1 font-medium">{eyebrow}</Badge>}
        <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">{heading || 'Why shop with us'}</h2>
        {subheading && <p className="text-pretty text-muted-foreground">{subheading}</p>}
      </header>
      <div className={cn('grid gap-4 sm:grid-cols-2 sm:gap-6', items.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
        {items.map(({ icon: Icon, title, text: body }) => (
          <Card key={title} className="relative h-full overflow-hidden transition-shadow hover:shadow-md">
            <CardContent className="px-6">
              <span className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mb-2 text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {button && <div className="mt-12 text-center">{button}</div>}
    </StorefrontShell>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Older all-in-one store header and footer (pages made before the storefront used OpenExt's Header/Footer).
// ---------------------------------------------------------------------------------------------------------
export function StoreHeaderBlock({ settings, isEditing }: Props) {
  const info = useStoreInfo();
  const cats = topLevel(useCategories()).slice(0, 5);
  const owns = useOwnsDrawer(!isEditing);
  const announcement =
    text(settings.announcement).trim() ||
    (info.freeShippingThreshold > 0 ? `Free shipping on orders over ${formatInr(info.freeShippingThreshold)} · Cash on Delivery available` : 'Cash on Delivery available · Easy returns');
  return (
    <>
      {settings.showAnnouncement !== false && (
        <div className="ecom-sf-announce bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground">
          <Sparkles className="mr-1.5 inline size-3.5" aria-hidden="true" />
          {announcement}
        </div>
      )}
      <header className="ecom-sf-site-header w-full border-b bg-background/95 text-foreground backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a className="text-xl font-bold tracking-tight" href={storefrontLinks.shop()}>
            {info.storeName || 'Store'}
          </a>
          {settings.showCategoryLinks !== false && (
            <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Shop categories">
              <Button variant="ghost" size="sm" nativeButton={false} render={<a href={storefrontLinks.shop()} onClick={(e) => { if (onShopPage()) { e.preventDefault(); goToShop({}); } }} />}>
                Shop all
              </Button>
              {cats.map((cat) => (
                <Button key={cat.id} variant="ghost" size="sm" nativeButton={false} render={<a href={`${storefrontLinks.shop()}?category=${cat.id}`} onClick={(e) => { e.preventDefault(); goToShop({ category: cat.id }); }} />}>
                  {cat.name}
                </Button>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            {settings.showSearch !== false && <SearchBox placeholder="Search products" isEditing={isEditing} className="hidden w-56 sm:block" />}
            <CartButton label="Cart" showLabel showCount isEditing={isEditing} />
          </div>
        </div>
      </header>
      {owns && <MiniCart />}
    </>
  );
}

export function StoreFooterBlock({ settings }: Props) {
  const info = useStoreInfo();
  const cats = topLevel(useCategories()).slice(0, 5);
  const name = info.storeName || 'Store';
  const link = 'text-sm text-muted-foreground hover:text-foreground';
  return (
    <footer className="ecom-sf-footer w-full border-t bg-muted/30 text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            <a className="text-xl font-bold tracking-tight" href={storefrontLinks.shop()}>
              {name}
            </a>
            {text(settings.aboutText) && <p className="text-sm text-muted-foreground">{text(settings.aboutText)}</p>}
          </div>
          <nav aria-label="Shop" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Shop</h3>
            <a className={link} href={storefrontLinks.shop()}>All products</a>
            {cats.map((c) => (
              <a key={c.id} className={link} href={`${storefrontLinks.shop()}?category=${c.id}`}>
                {c.name}
              </a>
            ))}
          </nav>
          <nav aria-label="Orders" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Orders</h3>
            <a className={link} href={storefrontLinks.cart()}>Cart</a>
            <a className={link} href={storefrontLinks.checkout()}>Checkout</a>
            <span className="text-sm text-muted-foreground">Cash on Delivery</span>
          </nav>
          {settings.showContact !== false && (info.supportEmail || info.supportPhone) && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Contact</h3>
              {info.supportEmail && (
                <a className={cn(link, 'flex items-center gap-2')} href={`mailto:${info.supportEmail}`}>
                  <Mail className="size-4" aria-hidden="true" /> {info.supportEmail}
                </a>
              )}
              {info.supportPhone && (
                <a className={cn(link, 'flex items-center gap-2')} href={`tel:${info.supportPhone}`}>
                  <Phone className="size-4" aria-hidden="true" /> {info.supportPhone}
                </a>
              )}
            </div>
          )}
        </div>
        <Separator className="my-8" />
        <div className="flex flex-col justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} {name}. All rights reserved.</span>
          <span>All prices in Indian Rupees (₹).</span>
        </div>
      </div>
    </footer>
  );
}
