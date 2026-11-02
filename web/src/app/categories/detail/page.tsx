'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete02Icon, Edit02Icon, FolderTreeIcon, PackageIcon } from '@hugeicons/core-free-icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionMenu } from '@/components/admin/ActionMenu';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { Muted, SectionCard, SectionRow } from '@/components/admin/SectionCard';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { AdminToaster, toast } from '@/components/admin/toast';
import { CategoryDrawer } from '@/components/categories/CategoryDrawer';
import { ProductPrice, ProductStatusBadge, ProductThumbnail } from '@/components/products/ProductBits';
import { useProductListHref } from '@/components/products/useProductListHref';
import { formatDateTime } from '@/lib/format';
import { deleteCategory, listCategories, listProducts } from '@/lib/products/api';
import { categoryPath } from '@/lib/products/form';
import type { Category, Product } from '@/lib/products/types';
import { categoryUrls, productUrls } from '@/lib/products/urls';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

function CategoryDetail() {
  const id = useSearchParams().get('id') ?? '';
  const productsHref = useProductListHref();
  const [categories, setCategories] = React.useState<Category[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [drawer, setDrawer] = React.useState<{ open: boolean; edit: boolean }>({ open: false, edit: false });
  const { confirm, dialog } = useConfirm();

  const [page, setPage] = React.useState(1);
  const [products, setProducts] = React.useState<{ key: string; items: Product[]; total: number; error: string | null } | null>(null);
  const [productsAttempt, setProductsAttempt] = React.useState(0);
  const productsKey = `${id}#${page}#${productsAttempt}`;

  // The list endpoint returns every category with product counts; that also gives us parents and children.
  React.useEffect(() => {
    let active = true;
    listCategories()
      .then((cats) => active && (setCategories(cats), setLoadError(null)))
      .catch((err) => active && setLoadError(err instanceof Error ? err.message : 'Could not load the category.'));
    return () => {
      active = false;
    };
  }, [attempt]);

  React.useEffect(() => {
    // Malformed ids (old or hand-edited links) can't have products; the page shows "Category not found".
    if (!/^[a-f0-9]{24}$/i.test(id)) return;
    const controller = new AbortController();
    listProducts({ categoryId: id, page, limit: PAGE_SIZE, sort: 'name', order: 'asc' }, controller.signal)
      .then((res) => setProducts({ key: productsKey, items: res.products, total: res.total, error: null }))
      .catch((err) => {
        if (!controller.signal.aborted) setProducts({ key: productsKey, items: [], total: 0, error: err instanceof Error ? err.message : 'Could not load products.' });
      });
    return () => controller.abort();
  }, [id, page, productsKey]);

  const category = categories?.find((c) => String(c._id) === id) ?? null;
  const crumbs = [
    { label: 'Products', href: productsHref },
    { label: 'Categories', href: categoryUrls.list() },
    { label: category?.name ?? (categories || loadError ? 'Category' : 'Loading…') },
  ];

  if (!category) {
    return (
      <div className="space-y-5">
        <AdminPageHeader breadcrumbs={crumbs} />
        {loadError ? (
          <div className="rounded-lg border bg-card">
            <ErrorState message={loadError} onRetry={() => setAttempt((n) => n + 1)} />
          </div>
        ) : categories || !id ? (
          <div className="rounded-lg border bg-card">
            <EmptyState
              icon={FolderTreeIcon}
              title="Category not found"
              description="It may have been deleted."
              action={
                <a href={categoryUrls.list()} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md')}>
                  Back to categories
                </a>
              }
            />
          </div>
        ) : (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-56 rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  const all = categories ?? [];
  const parent = category.parentId ? all.find((c) => String(c._id) === String(category.parentId)) : undefined;
  const children = all.filter((c) => String(c.parentId ?? '') === id).sort((a, b) => a.name.localeCompare(b.name));
  const productsLoading = !products || products.key !== productsKey;
  const total = products?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const remove = () =>
    confirm({
      title: 'Delete category?',
      description: (
        <>
          <span className="font-medium text-foreground">{category.name}</span> will be permanently deleted. This is only possible
          once it has no subcategories and no products.
        </>
      ),
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteCategory(id);
          toast.flash('Category deleted', category.name);
          window.location.href = categoryUrls.list();
        } catch (err) {
          toast.error('Could not delete category', err instanceof Error ? err.message : undefined);
        }
      },
    });

  return (
    <div className="space-y-5">
      <AdminPageHeader breadcrumbs={crumbs} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <SectionCard
            title={<span className="text-base">{category.name}</span>}
            actions={
              <ActionMenu
                label="Category actions"
                groups={[
                  [
                    { label: 'Edit', icon: Edit02Icon, onSelect: () => setDrawer({ open: true, edit: true }) },
                    { label: 'Add subcategory', icon: Add01Icon, onSelect: () => setDrawer({ open: true, edit: false }) },
                  ],
                  [{ label: 'Delete', icon: Delete02Icon, destructive: true, onSelect: remove }],
                ]}
              />
            }
          >
            <dl className="divide-y">
              <SectionRow label="Handle">
                <span className="font-mono text-xs">/{category.slug}</span>
              </SectionRow>
              <SectionRow label="Description">
                {category.description ? <span className="whitespace-pre-line">{category.description}</span> : <Muted />}
              </SectionRow>
              <SectionRow label="Path">{categoryPath(id, all)}</SectionRow>
              <SectionRow label="Last updated">{formatDateTime(category.updatedAt)}</SectionRow>
            </dl>
          </SectionCard>

          <SectionCard title="Products" description={`${category.productCount ?? total} product${(category.productCount ?? total) === 1 ? '' : 's'} directly in this category.`}>
            {products?.error && !productsLoading ? (
              <ErrorState message={products.error} onRetry={() => setProductsAttempt((n) => n + 1)} />
            ) : !productsLoading && total === 0 ? (
              <EmptyState icon={PackageIcon} title="No products in this category" description="Assign a category from a product’s Organization section." />
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
                        </li>
                      ))}
                </ul>
                {pageCount > 1 && (
                  <div className="flex items-center justify-between border-t px-5 py-2.5 text-[13px] text-muted-foreground">
                    <span className="tabular-nums">
                      Page {page} of {pageCount}
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
        </div>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Parent">
            <div className="px-5 py-3 text-[13px]">
              {parent ? (
                <a href={categoryUrls.detail(String(parent._id))} className="hover:underline">
                  {categoryPath(String(parent._id), all)}
                </a>
              ) : (
                <Muted>Top-level category</Muted>
              )}
            </div>
          </SectionCard>
          <SectionCard
            title="Subcategories"
            actions={
              <Button variant="ghost" size="icon-sm" className="rounded-md" aria-label="Add subcategory" onClick={() => setDrawer({ open: true, edit: false })}>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              </Button>
            }
          >
            {children.length === 0 ? (
              <p className="px-5 py-3 text-[13px] text-muted-foreground">No subcategories.</p>
            ) : (
              <ul className="divide-y">
                {children.map((c) => (
                  <li key={c._id} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                    <a href={categoryUrls.detail(String(c._id))} className="font-medium hover:underline">
                      {c.name}
                    </a>
                    <span className="text-xs tabular-nums text-muted-foreground">{c.productCount ?? 0} products</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <CategoryDrawer
        open={drawer.open}
        category={drawer.edit ? category : null}
        defaultParentId={drawer.edit ? null : id}
        categories={all}
        onClose={() => setDrawer({ open: false, edit: false })}
        onSaved={(saved) => {
          const edited = drawer.edit;
          setDrawer({ open: false, edit: false });
          toast.success(edited ? 'Category saved' : 'Subcategory created', saved.name);
          setAttempt((n) => n + 1);
        }}
      />
      {dialog}
    </div>
  );
}

export default function CategoryDetailPage() {
  return (
    <AdminToaster>
      <Suspense fallback={null}>
        <CategoryDetail />
      </Suspense>
    </AdminToaster>
  );
}
