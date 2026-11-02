'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Edit02Icon, Image01Icon, PackageIcon } from '@hugeicons/core-free-icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { ActionMenu, type ActionItem } from '@/components/admin/ActionMenu';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Muted, SectionCard, SectionRow } from '@/components/admin/SectionCard';
import { EmptyState } from '@/components/admin/StateViews';
import { AdminToaster, toast } from '@/components/admin/toast';
import { ProductInventory, ProductPrice, ProductStatusBadge } from '@/components/products/ProductBits';
import { ProductSectionDrawer } from '@/components/products/ProductSectionDrawer';
import { useTaxOptions } from '@/components/products/ProductFormSections';
import { ProductLoadState, useProduct } from '@/components/products/useProduct';
import { useProductActions } from '@/components/products/useProductActions';
import { useProductListHref } from '@/components/products/useProductListHref';
import { useProductReferenceData } from '@/components/products/useProductReferenceData';
import { formatDateTime, formatMoney } from '@/lib/format';
import { categoryPath, totalInventory, type ProductSection } from '@/lib/products/form';
import type { Category, Collection, Product, TaxClass } from '@/lib/products/types';
import { categoryUrls, collectionUrls, inventoryUrls, productListUrl, productUrls } from '@/lib/products/urls';
import { UNASSIGNED_LOCATION, listInventory, type InventoryItemRow } from '@/lib/inventory';
import { listLocations } from '@/lib/settings';
import { cn } from '@/lib/utils';

function editAction(label: string, onSelect: () => void): ActionItem[][] {
  return [[{ label, icon: Edit02Icon, onSelect }]];
}

function ProductDetail() {
  const id = useSearchParams().get('id') ?? '';
  const { product, error, loading, reload, setProduct } = useProduct(id);
  const { categories, collections, taxClasses } = useProductReferenceData();
  const [editing, setEditing] = React.useState<ProductSection | null>(null);
  const listHref = useProductListHref();

  const { menuFor, dialog } = useProductActions({
    onUpdated: setProduct,
    onDeleted: (p) => {
      toast.flash('Product deleted', p.name);
      window.location.href = productListUrl();
    },
  });

  const crumbs = [{ label: 'Products', href: listHref }, { label: product?.name ?? (loading ? 'Loading…' : 'Product') }];

  if (!product) {
    return (
      <div className="space-y-5">
        <AdminPageHeader breadcrumbs={crumbs} />
        <ProductLoadState id={id} loading={loading} error={error} onRetry={reload} />
      </div>
    );
  }

  const open = (section: ProductSection) => () => setEditing(section);
  const [mainGroup, ...restGroups] = menuFor(product);
  const generalMenu: ActionItem[][] = [
    [{ label: 'Edit', icon: Edit02Icon, onSelect: open('general') }, ...mainGroup.filter((a) => a.label === 'Duplicate')],
    ...restGroups,
  ];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={crumbs}
        actions={
          <a href={productUrls.edit(product._id)} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md')}>
            Edit all fields
          </a>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <SectionCard
            title={<span className="text-base">{product.name}</span>}
            actions={
              <>
                <ProductStatusBadge status={product.status} />
                <ActionMenu groups={generalMenu} label="Product actions" />
              </>
            }
          >
            <dl className="divide-y">
              <SectionRow label="Description">
                {product.description ? <span className="whitespace-pre-line">{product.description}</span> : <Muted />}
              </SectionRow>
              <SectionRow label="Handle">
                {product.slug ? <span className="font-mono text-xs">{product.slug}</span> : <Muted />}
              </SectionRow>
              <SectionRow label="Created">{formatDateTime(product.createdAt)}</SectionRow>
              <SectionRow label="Last updated">{formatDateTime(product.updatedAt)}</SectionRow>
            </dl>
          </SectionCard>

          <MediaSection product={product} onEdit={open('media')} />
          <PricingSection product={product} onEdit={open('pricing')} />
          <InventorySection product={product} onEdit={open('inventory')} />
          <VariantsSection product={product} onEdit={open('variants')} />
        </div>

        <div className="min-w-0 space-y-4">
          <OrganizationSection product={product} categories={categories} collections={collections} taxClasses={taxClasses} onEdit={open('organization')} />
          <SeoSection product={product} onEdit={open('seo')} />
        </div>
      </div>

      <ProductSectionDrawer
        product={product}
        section={editing}
        onClose={() => setEditing(null)}
        onSaved={setProduct}
        categories={categories}
        collections={collections}
        taxClasses={taxClasses}
      />
      {dialog}
    </div>
  );
}

function MediaSection({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const images = product.images ?? [];
  const videos = product.videos ?? [];
  return (
    <SectionCard title="Media" actions={<ActionMenu groups={editAction('Edit media', onEdit)} label="Media actions" />}>
      {images.length + videos.length === 0 ? (
        <EmptyState
          icon={Image01Icon}
          title="No media yet"
          description="Add images to show this product on the storefront."
          action={
            <Button variant="outline" size="sm" className="rounded-md" onClick={onEdit}>
              Add media
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-3 gap-2 p-5 sm:grid-cols-5">
          {images.map((src, i) => (
            <li key={`img-${i}`} className="relative aspect-square overflow-hidden rounded-md border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URLs / external URLs, no image loader in static export */}
              <img src={src} alt={`${product.name} image ${i + 1}`} className="size-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] font-medium shadow-xs">
                  Thumbnail
                </span>
              )}
            </li>
          ))}
          {videos.map((src, i) => (
            <li key={`vid-${i}`} className="relative aspect-square overflow-hidden rounded-md border bg-black">
              <video src={src} className="size-full object-cover" controls preload="metadata" />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function PricingSection({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const pricing = product.pricing;
  const pct = product.discountPercentage ?? 0;
  const sale = product.discountPrice;
  const saleIgnored = pct > 0 && sale !== null && sale !== undefined;
  const cost = product.costPrice;
  const selling = pricing?.catalogPrice ?? product.price;
  const margin = cost !== null && cost !== undefined && selling > 0 ? ((selling - cost) / selling) * 100 : null;

  return (
    <SectionCard title="Pricing" actions={<ActionMenu groups={editAction('Edit pricing', onEdit)} label="Pricing actions" />}>
      <dl className="divide-y">
        <SectionRow label="Customer price">
          <ProductPrice product={product} className="font-medium" />
        </SectionRow>
        <SectionRow label="Price">{formatMoney(product.price)}</SectionRow>
        <SectionRow label="Discount">{pct > 0 ? `${pct}%` : <Muted />}</SectionRow>
        <SectionRow label="Sale price">
          {sale !== null && sale !== undefined ? (
            <span>
              {formatMoney(sale)}
              {saleIgnored && <span className="ml-1.5 text-xs text-muted-foreground">(not applied while a discount % is set)</span>}
            </span>
          ) : (
            <Muted />
          )}
        </SectionRow>
        <SectionRow label="Cost per item">{cost !== null && cost !== undefined ? formatMoney(cost) : <Muted />}</SectionRow>
        {margin !== null && (
          <SectionRow label="Margin">
            <span className={cn('tabular-nums', margin < 0 && 'text-destructive')}>
              {margin.toFixed(1)}% · {formatMoney(selling - (cost ?? 0))} per item
            </span>
          </SectionRow>
        )}
      </dl>
    </SectionCard>
  );
}

/** The product's inventory items (one, or one per variant) with stock per location. */
function useProductStock(productId: string, version: string) {
  const [state, setState] = React.useState<{ key: string; items: InventoryItemRow[]; names: Record<string, string> } | null>(null);
  const key = `${productId}#${version}`;
  React.useEffect(() => {
    let active = true;
    Promise.all([listInventory({ productId, includeLevels: '1', page: 1, limit: 100 }), listLocations()])
      .then(([inv, locations]) => active && setState({ key, items: inv.items, names: Object.fromEntries([[UNASSIGNED_LOCATION, 'Unassigned'], ...locations.map((l) => [l._id, l.name])]) }))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [productId, key]);
  return state?.key === key ? state : null;
}

function InventorySection({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const hasVariants = (product.variants?.length ?? 0) > 0;
  const stock = useProductStock(product._id, String(product.updatedAt));
  return (
    <SectionCard
      title="Inventory"
      actions={
        <ActionMenu
          groups={[...editAction('Edit inventory', onEdit), [{ label: 'Open in Inventory', icon: PackageIcon, onSelect: () => (window.location.href = inventoryUrls.list(`q=${encodeURIComponent(product.name)}`)) }]]}
          label="Inventory actions"
        />
      }
    >
      <dl className="divide-y">
        <SectionRow label="SKU">{product.sku ? <span className="font-mono text-xs">{product.sku}</span> : <Muted />}</SectionRow>
        <SectionRow label="Barcode">{product.barcode ? <span className="font-mono text-xs">{product.barcode}</span> : <Muted />}</SectionRow>
        <SectionRow label="Available">
          <ProductInventory product={product} />
          {hasVariants && <span className="block text-xs text-muted-foreground">Stock is managed per variant.</span>}
        </SectionRow>
      </dl>
      {stock && stock.items.length > 0 && (
        <ul className="divide-y border-t">
          {stock.items.map((it) => (
            <li key={it._id}>
              <a href={inventoryUrls.detail(it._id)} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-2.5 text-[13px] hover:bg-muted/40">
                <span className="min-w-0">
                  <span className="block font-medium">{it.variantLabel ?? 'Stock by location'}</span>
                  <span className="block text-xs text-muted-foreground">
                    {(it.levels ?? []).map((l) => `${stock.names[l.locationId] ?? 'Other'}: ${l.stocked}${l.reserved ? ` (${l.reserved} reserved)` : ''}`).join(' · ') || 'Not stocked at any location'}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {it.reserved > 0 ? `${it.reserved} reserved · ` : ''}
                  <span className="font-medium text-foreground">{it.available}</span> available
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function VariantsSection({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const variants = product.variants ?? [];
  return (
    <SectionCard
      title="Variants"
      description={variants.length > 0 ? `${variants.length} variant${variants.length === 1 ? '' : 's'} · ${totalInventory(product).toLocaleString('en-IN')} in stock` : undefined}
      actions={<ActionMenu groups={editAction('Edit variants', onEdit)} label="Variant actions" />}
    >
      {variants.length === 0 ? (
        <EmptyState
          title="No variants"
          description="This product is sold as a single item. Add variants for sizes or colors."
          action={
            <Button variant="outline" size="sm" className="rounded-md" onClick={onEdit}>
              Add variants
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-5 py-2 font-medium">Variant</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 text-right font-medium">Stock</th>
                <th className="px-5 py-2 text-right font-medium">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {variants.map((v, i) => (
                <tr key={v._id ?? i}>
                  <td className="px-5 py-2.5 font-medium">{[v.size, v.color].filter(Boolean).join(' / ') || <Muted>Unnamed</Muted>}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{v.sku || '—'}</td>
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', !v.stock && 'text-destructive')}>{v.stock ?? 0}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">
                    {v.priceOverride !== null && v.priceOverride !== undefined ? formatMoney(v.priceOverride) : <Muted>Base price</Muted>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function OrganizationSection({
  product,
  categories,
  collections,
  taxClasses,
  onEdit,
}: {
  product: Product;
  categories: Category[];
  collections: Collection[];
  taxClasses: TaxClass[];
  onEdit: () => void;
}) {
  const taxOptions = useTaxOptions(taxClasses, product.taxClassId ?? 'Default');
  const taxLabel = taxOptions.find((o) => o.value === (product.taxClassId || 'Default'))?.label ?? product.taxClassId;
  const tags = product.tags ?? [];
  const collection = collections.find((c) => c._id === product.collectionId);
  const category = categoryPath(product.categoryId, categories);
  return (
    <SectionCard title="Organization" actions={<ActionMenu groups={editAction('Edit organization', onEdit)} label="Organization actions" />}>
      <dl className="divide-y">
        <SectionRow label="Collection">
          {collection ? (
            <a href={collectionUrls.detail(collection._id)} className="hover:underline">
              {collection.title}
            </a>
          ) : (
            <Muted />
          )}
        </SectionRow>
        <SectionRow label="Category">
          {category && product.categoryId ? (
            <a href={categoryUrls.detail(product.categoryId)} className="hover:underline">
              {category}
            </a>
          ) : (
            <Muted />
          )}
        </SectionRow>
        <SectionRow label="Tax class">{taxLabel}</SectionRow>
        <SectionRow label="Tags">
          {tags.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span key={t} className="rounded border bg-muted/50 px-1.5 py-0.5 text-xs">
                  {t}
                </span>
              ))}
            </span>
          ) : (
            <Muted />
          )}
        </SectionRow>
        <SectionRow label="Type">{product.isDigital ? 'Digital' : 'Physical'}</SectionRow>
      </dl>
    </SectionCard>
  );
}

function SeoSection({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const title = product.metaTitle || product.name;
  const description = product.metaDescription || product.description?.slice(0, 160);
  return (
    <SectionCard title="Search engine listing" actions={<ActionMenu groups={editAction('Edit listing', onEdit)} label="SEO actions" />}>
      <div className="space-y-1 px-5 py-4">
        <p className="truncate text-[14px] text-[#1a0dab] dark:text-sky-400">{title}</p>
        <p className="line-clamp-3 text-[13px] text-muted-foreground">{description || 'No description. Search engines will choose their own snippet.'}</p>
        {!product.metaTitle && !product.metaDescription && (
          <p className="pt-1 text-xs text-muted-foreground">Using the product title and description.</p>
        )}
      </div>
    </SectionCard>
  );
}

export default function ProductDetailPage() {
  return (
    <AdminToaster>
      <Suspense fallback={null}>
        <ProductDetail />
      </Suspense>
    </AdminToaster>
  );
}
