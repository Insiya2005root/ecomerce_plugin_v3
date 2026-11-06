import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { LinkButton, StorefrontShell } from '../components/StorefrontState';
import { useCart } from '../cart/cartStore';
import { storefrontLinks } from '../cart/links';
import { parsePriceRanges, shopFilters, useShopFilters, type ShopSort } from '../cart/shopFilters';
import { useCategories } from '../cart/storeData';
import type { BlockSettingsMap, PublicCategoryDTO, StorefrontBlockComponentProps } from '../types/storefront';

type Props = StorefrontBlockComponentProps<BlockSettingsMap>;

/** Link to the cart with the number of items, for page headers. */
export function CartLink() {
  const c = useCart();
  const count = c.lines.reduce((n, l) => n + l.quantity, 0);
  return (
    <LinkButton href={storefrontLinks.cart()} variant="outline" size="default" className="ecom-sf-cart-link">
      <ShoppingBag data-icon="inline-start" />
      Cart
      {count > 0 && <Badge className="ecom-sf-cart-count ml-1 h-5 min-w-5 rounded-full px-1.5">{count}</Badge>}
    </LinkButton>
  );
}

/** Shop page heading with breadcrumbs, the number of matching products and a cart link. */
export function ShopHeaderBlock({ settings }: Props) {
  const { total, q } = useShopFilters();
  const heading = String(settings.heading || 'All products');
  const subheading = String(settings.subheading || '');
  const centered = settings.align === 'center';
  return (
    <StorefrontShell>
      <header className={cn('flex flex-col gap-4', centered ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between')}>
        <div className={cn('flex flex-col gap-2', centered && 'items-center')}>
          {settings.showBreadcrumbs !== false && (
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Shop</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{heading}</h1>
          {subheading && <p className="max-w-[60ch] text-muted-foreground text-balance">{subheading}</p>}
          {settings.showTotalCount !== false && total !== null && (
            <p className="text-sm text-muted-foreground">
              {total} product{total === 1 ? '' : 's'}
              {q ? ` for "${q}"` : ''}
            </p>
          )}
        </div>
        {settings.showCartLink !== false && !centered && <CartLink />}
      </header>
    </StorefrontShell>
  );
}

const SORT_OPTIONS: { value: ShopSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name_asc', label: 'Name: A to Z' },
];

/** Top-level categories first, each followed by its sub-categories. */
function orderCategories(categories: PublicCategoryDTO[]) {
  return categories
    .filter((c) => !c.parentId || !categories.some((p) => p.id === c.parentId))
    .flatMap((top) => [{ ...top, depth: 0 }, ...categories.filter((c) => c.parentId === top.id).map((c) => ({ ...c, depth: 1 }))]);
}

/** Search box that filters as the shopper types (after a short pause). */
function useLiveSearch() {
  const filters = useShopFilters();
  const [query, setQuery] = useState(filters.q);
  useEffect(() => setQuery(filters.q), [filters.q]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (query.trim() !== shopFilters.get().q) shopFilters.set({ q: query.trim() });
    }, 350);
    return () => window.clearTimeout(t);
  }, [query]);
  return [query, setQuery] as const;
}

function SearchField({ placeholder, className }: { placeholder: string; className?: string }) {
  const [query, setQuery] = useLiveSearch();
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        className="ecom-sf-search h-9 pl-9"
        placeholder={placeholder}
        aria-label="Search products"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  );
}

/** A dropdown that lists options and ticks the chosen one (shadcn DropdownMenu). */
function ChoiceMenu({
  label,
  options,
  value,
  onChange,
  icon,
  size = 'default',
  align = 'start',
  className,
}: {
  label: string;
  options: { value: string; label: string; indent?: boolean }[];
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  size?: 'default' | 'sm';
  align?: 'start' | 'end';
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size={size} className={cn('cursor-pointer justify-between', className)} />}>
        {icon}
        {label}
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="max-h-80 w-56">
        {options.map((o) => (
          <DropdownMenuItem key={o.value || 'all'} onClick={() => onChange(o.value)} className={cn(o.indent && 'pl-6')}>
            <span className="flex-1">{o.label}</span>
            {o.value === value && <Check className="size-4" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Shop filter (shadcn category-filter-1): search, sort, category and price, active-filter chips and a
 * results bar. Filters the product grid on the same page. Layouts: a bar with category pills, a bar with
 * dropdowns, or a sidebar (put it in a page builder column next to the grid).
 */
export function CategoryFilterBlock({ settings }: Props) {
  const filters = useShopFilters();
  const categories = useCategories();
  const ordered = orderCategories(categories);
  const layout = String(settings.filterLayout || 'horizontal-pills');
  const defaultSort = (String(settings.defaultSort || 'newest') as ShopSort) || 'newest';
  const showSearch = settings.showSearchInput !== false;
  const showSort = settings.showSortDropdown !== false;
  const showCategories = settings.showCategoryFilter !== false;
  const priceRanges = settings.showPriceFilter !== false ? parsePriceRanges(String(settings.priceRanges ?? '0-500, 500-1000, 1000-2500, 2500+')) : [];
  const searchPlaceholder = String(settings.searchPlaceholder || 'Search products…');
  const heading = String(settings.heading || '');
  const description = String(settings.description || '');

  const sortValue = filters.sort || defaultSort;
  const sortLabel = SORT_OPTIONS.find((s) => s.value === sortValue)?.label ?? 'Newest first';
  const categoryName = categories.find((c) => c.id === filters.category)?.name;
  const priceLabel = priceRanges.find((p) => p.value === filters.price)?.label;
  const setSort = (v: string) => shopFilters.set({ sort: v as ShopSort });

  const active = [
    categoryName && { key: 'category', label: categoryName, clear: () => shopFilters.set({ category: '' }) },
    priceLabel && { key: 'price', label: priceLabel, clear: () => shopFilters.set({ price: '' }) },
    filters.q && { key: 'q', label: `"${filters.q}"`, clear: () => shopFilters.set({ q: '' }) },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const activeChips = settings.showActiveFilters !== false && active.length > 0 && (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
      {active.map((f) => (
        <Badge key={f.key} variant="secondary" className="h-7 gap-1 rounded-full pr-1 pl-3 text-xs font-semibold">
          {f.label}
          <button type="button" onClick={f.clear} className="cursor-pointer rounded-full p-1 hover:bg-background/60" aria-label={`Remove filter ${f.label}`}>
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Button variant="ghost" size="sm" className="cursor-pointer text-xs text-muted-foreground" onClick={() => shopFilters.clear()}>
        Clear all
      </Button>
    </div>
  );

  const resultsBar = settings.showResultsBar !== false && filters.total !== null && (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-muted/50 px-4 py-3">
      <span className="text-sm font-medium">
        Showing {filters.total} result{filters.total === 1 ? '' : 's'}
        {filters.q && <span className="font-normal text-muted-foreground"> for "{filters.q}"</span>}
      </span>
      <span className="text-xs text-muted-foreground">Sorted by {sortLabel.toLowerCase()}</span>
    </div>
  );

  const head = (heading || description) && (
    <header className="mb-6">
      {heading && <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{heading}</h2>}
      {description && <p className="mt-2 text-muted-foreground">{description}</p>}
    </header>
  );

  if (layout === 'sidebar-list') {
    const listButton = (selected: boolean, onClick: () => void, children: React.ReactNode, indent = false, extra = '') => (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted',
          selected && 'bg-muted font-medium',
          indent && 'pl-6',
          extra
        )}
      >
        <span className="truncate">{children}</span>
        {selected && <Check className="size-4 shrink-0" aria-hidden="true" />}
      </button>
    );
    return (
      <StorefrontShell>
        {head}
        <Card className="ecom-sf-filter-sidebar gap-0 py-0">
          <CardContent className="flex flex-col gap-5 p-5">
            {showSearch && <SearchField placeholder={searchPlaceholder} />}
            {showCategories && (
              <div className="flex flex-col gap-1" role="group" aria-label="Filter by category">
                <h3 className="mb-1 text-sm font-semibold">Category</h3>
                {listButton(!filters.category, () => shopFilters.set({ category: '' }), 'All products', false, 'ecom-sf-pill')}
                {ordered.map((c) =>
                  listButton(filters.category === c.id, () => shopFilters.set({ category: filters.category === c.id ? '' : c.id }), c.name, c.depth === 1, 'ecom-sf-pill')
                )}
              </div>
            )}
            {priceRanges.length > 0 && (
              <>
                <Separator />
                <div className="flex flex-col gap-1" role="group" aria-label="Filter by price">
                  <h3 className="mb-1 text-sm font-semibold">Price</h3>
                  {listButton(!filters.price, () => shopFilters.set({ price: '' }), 'Any price')}
                  {priceRanges.map((p) => listButton(filters.price === p.value, () => shopFilters.set({ price: filters.price === p.value ? '' : p.value }), p.label))}
                </div>
              </>
            )}
            {showSort && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Sort by</h3>
                  <ChoiceMenu label={sortLabel} options={SORT_OPTIONS} value={sortValue} onChange={setSort} className="w-full" />
                </div>
              </>
            )}
            {activeChips}
          </CardContent>
        </Card>
      </StorefrontShell>
    );
  }

  return (
    <StorefrontShell>
      {head}
      <div className="ecom-sf-toolbar flex flex-col gap-4">
        {(showSearch || showSort) && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {showSearch ? <SearchField placeholder={searchPlaceholder} className="max-w-md flex-1" /> : <span />}
            {showSort && (
              <ChoiceMenu
                label={`Sort: ${sortLabel}`}
                options={SORT_OPTIONS}
                value={sortValue}
                onChange={setSort}
                icon={<SlidersHorizontal data-icon="inline-start" />}
                align="end"
                className="ecom-sf-sort w-full sm:w-auto"
              />
            )}
          </div>
        )}

        {layout === 'dropdown' ? (
          <div className="flex flex-wrap gap-3">
            {showCategories && (
              <ChoiceMenu
                size="sm"
                label={`Category: ${categoryName ?? 'All'}`}
                options={[{ value: '', label: 'All products' }, ...ordered.map((c) => ({ value: c.id, label: c.name, indent: c.depth === 1 }))]}
                value={filters.category}
                onChange={(v) => shopFilters.set({ category: v })}
              />
            )}
            {priceRanges.length > 0 && (
              <ChoiceMenu
                size="sm"
                label={`Price: ${priceLabel ?? 'Any'}`}
                options={[{ value: '', label: 'Any price' }, ...priceRanges]}
                value={filters.price}
                onChange={(v) => shopFilters.set({ price: v })}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {showCategories && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
                <Button
                  variant={filters.category ? 'outline' : 'default'}
                  size="sm"
                  className="ecom-sf-pill cursor-pointer rounded-full"
                  aria-pressed={!filters.category}
                  onClick={() => shopFilters.set({ category: '' })}
                >
                  All
                </Button>
                {ordered.map((c) => (
                  <Button
                    key={c.id}
                    variant={filters.category === c.id ? 'default' : 'outline'}
                    size="sm"
                    className="ecom-sf-pill cursor-pointer rounded-full"
                    aria-pressed={filters.category === c.id}
                    onClick={() => shopFilters.set({ category: filters.category === c.id ? '' : c.id })}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            )}
            {priceRanges.length > 0 && (
              <ChoiceMenu
                size="sm"
                label={`Price: ${priceLabel ?? 'Any'}`}
                options={[{ value: '', label: 'Any price' }, ...priceRanges]}
                value={filters.price}
                onChange={(v) => shopFilters.set({ price: v })}
                className="rounded-full"
              />
            )}
          </div>
        )}

        {activeChips}
        {resultsBar}
      </div>
    </StorefrontShell>
  );
}
