'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from '@/lib/router';
import { Add01Icon, Delete02Icon, Edit02Icon, Folder01Icon, MinusSignCircleIcon, PackageIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionMenu } from '@/components/admin/ActionMenu';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { Muted, SectionCard, SectionRow } from '@/components/admin/SectionCard';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { AdminToaster, toast } from '@/components/admin/toast';
import { AddProductsDrawer } from '@/components/collections/AddProductsDrawer';
import { CollectionDrawer } from '@/components/collections/CollectionDrawer';
import { ProductPrice, ProductStatusBadge, ProductThumbnail } from '@/components/products/ProductBits';
import { useProductListHref } from '@/components/products/useProductListHref';
import { formatDateTime } from '@/lib/format';
import { ApiError, deleteCollection, getCollection, listCollections, listProducts, updateCollectionProducts } from '@/lib/products/api';
import type { Collection, Product } from '@/lib/products/types';
import { collectionUrls, productUrls } from '@/lib/products/urls';
import { cn } from '@/lib/utils';
import { navigate } from '@/lib/router';

const PAGE_SIZE = 20;

function CollectionDetail() {
  const id = useSearchParams().get('id') ?? '';
  const productsHref = useProductListHref();
  const [collection, setCollection] = React.useState<Collection | null>(null);
  const [loadError, setLoadError] = React.useState<Error | null>(null);
  const [allCollections, setAllCollections] = React.useState<Collection[]>([]);
  const [attempt, setAttempt] = React.useState(0);
  const [editing, setEditing] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const { confirm, dialog } = useConfirm();

  const [page, setPage] = React.useState(1);
  const [productsKey, setProductsKey] = React.useState(0);
  const [products, setProducts] = React.useState<{ key: string; items: Product[]; total: number; error: string | null } | null>(null);
  const requestKey = `${page}#${productsKey}`;

  React.useEffect(() => {
    if (!id) return;
    let active = true;
    getCollection(id)
      .then((c) => active && (setCollection(c), setLoadError(null)))
      .catch((err) => active && setLoadError(err));
    listCollections()
      .then((res) => active && setAllCollections(res.collections))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, attempt]);

  React.useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    listProducts({ collectionId: id, page, limit: PAGE_SIZE, sort: 'name', order: 'asc' }, controller.signal)
      .then((res) => setProducts({ key: requestKey, items: res.products, total: res.total, error: null }))
      .catch((err) => {
        if (!controller.signal.aborted) setProducts({ key: requestKey, items: [], total: 0, error: err instanceof Error ? err.message : 'Could not load products.' });
      });
    return () => controller.abort();
  }, [id, page, requestKey]);

  const refreshProducts = () => setProductsKey((k) => k + 1);

  const crumbs = [
    { label: 'Products', href: productsHref },
    { label: 'Collections', href: collectionUrls.list() },
    { label: collection?.title ?? (loadError ? 'Collection' : 'Loading…') },
  ];

  if (!collection) {
    const notFound = !id || (loadError instanceof ApiError && (loadError.status === 404 || loadError.status === 400));
    return (
      <div className="space-y-5">
        <AdminPageHeader breadcrumbs={crumbs} />
        {loadError || !id ? (
          <div className="rounded-lg border bg-card">
            {notFound ? (
              <EmptyState
                icon={Folder01Icon}
                title="Collection not found"
                description="It may have been deleted."
                action={
                  <a href={collectionUrls.list()} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md')}>
                    Back to collections
                  </a>
                }
              />
            ) : (
              <ErrorState message={loadError?.message ?? 'Could not load the collection.'} onRetry={() => setAttempt((n) => n + 1)} />
            )}
          </div>
        ) : (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-36 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  const remove = () =>
    confirm({
      title: 'Delete collection?',
      description: (
        <>
          <span className="font-medium text-foreground">{collection.title}</span> will be deleted. Its products stay in your catalog without a collection.
        </>
      ),
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteCollection(collection._id);
          toast.flash('Collection deleted', collection.title);
          navigate(collectionUrls.list());
        } catch (err) {
          toast.error('Could not delete collection', err instanceof Error ? err.message : undefined);
        }
      },
    });

  const removeProduct = async (p: Product) => {
    try {
      const res = await updateCollectionProducts(collection._id, { remove: [p._id] });
      setCollection((c) => c && { ...c, productCount: res.productCount });
      refreshProducts();
      toast.success('Removed from collection', p.name);
    } catch (err) {
      toast.error('Could not remove product', err instanceof Error ? err.message : undefined);
    }
  };

  const productsLoading = !products || products.key !== requestKey;
  const total = products?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <AdminPageHeader breadcrumbs={crumbs} />

      <SectionCard
        title={<span className="text-base">{collection.title}</span>}
        actions={
          <ActionMenu
            label="Collection actions"
            groups={[
              [{ label: 'Edit', icon: Edit02Icon, onSelect: () => setEditing(true) }],
              [{ label: 'Delete', icon: Delete02Icon, destructive: true, onSelect: remove }],
            ]}
          />
        }
      >
        <dl className="divide-y">
          <SectionRow label="Handle">
            <span className="font-mono text-xs">/{collection.handle}</span>
          </SectionRow>
          <SectionRow label="Description">
            {collection.description ? <span className="whitespace-pre-line">{collection.description}</span> : <Muted />}
          </SectionRow>
          <SectionRow label="Products">{collection.productCount ?? 0}</SectionRow>
          <SectionRow label="Last updated">{formatDateTime(collection.updatedAt)}</SectionRow>
        </dl>
      </SectionCard>

      <SectionCard
        title="Products"
        description="Products in this collection."
        actions={
          <Button variant="outline" size="sm" className="rounded-md" onClick={() => setAdding(true)}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            Add products
          </Button>
        }
      >
        {products?.error && !productsLoading ? (
          <ErrorState message={products.error} onRetry={refreshProducts} />
        ) : !productsLoading && total === 0 ? (
          <EmptyState
            icon={PackageIcon}
            title="No products in this collection"
            description="Add products to show them together on the storefront."
            action={
              <Button size="sm" className="rounded-md" onClick={() => setAdding(true)}>
                Add products
              </Button>
            }
          />
        ) : (
          <>
            <ul className={cn('divide-y', productsLoading && products && 'opacity-60')}>
              {productsLoading && !products
                ? Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                      <Skeleton className="size-8 rounded" />
                      <Skeleton className="h-3 w-48 rounded" />
                    </li>
                  ))
                : (products?.items ?? []).map((p) => (
                    <li key={p._id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                      <ProductThumbnail src={p.images?.[0]} />
                      <span className="min-w-0 flex-1">
                        <a href={productUrls.detail(p._id)} className="block truncate font-medium hover:underline">
                          {p.name}
                        </a>
                        <span className="block truncate font-mono text-xs text-muted-foreground">{p.sku}</span>
                      </span>
                      <ProductPrice product={p} className="hidden sm:inline-flex" />
                      <ProductStatusBadge status={p.status} />
                      <ActionMenu
                        label={`Actions for ${p.name}`}
                        groups={[[{ label: 'Remove from collection', icon: MinusSignCircleIcon, destructive: true, onSelect: () => removeProduct(p) }]]}
                      />
                    </li>
                  ))}
            </ul>
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t px-5 py-2.5 text-[13px] text-muted-foreground">
                <span className="tabular-nums">
                  Page {page} of {pageCount} · {total} products
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-md" disabled={page <= 1 || productsLoading} onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-md" disabled={page >= pageCount || productsLoading} onClick={() => setPage(page + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <CollectionDrawer
        open={editing}
        collection={collection}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setCollection((c) => (c ? { ...c, ...saved } : saved));
          setEditing(false);
          toast.success('Collection saved', saved.title);
        }}
      />
      <AddProductsDrawer
        open={adding}
        collection={collection}
        collections={allCollections}
        onClose={() => setAdding(false)}
        onAdd={async (ids) => {
          try {
            const res = await updateCollectionProducts(collection._id, { add: ids });
            setCollection((c) => c && { ...c, productCount: res.productCount });
            setAdding(false);
            setPage(1);
            refreshProducts();
            toast.success(`Added ${res.added} product${res.added === 1 ? '' : 's'}`, collection.title);
          } catch (err) {
            toast.error('Could not add products', err instanceof Error ? err.message : undefined);
          }
        }}
      />
      {dialog}
    </div>
  );
}

export default function CollectionDetailPage() {
  return (
    <AdminToaster>
      <Suspense fallback={null}>
        <CollectionDetail />
      </Suspense>
    </AdminToaster>
  );
}
