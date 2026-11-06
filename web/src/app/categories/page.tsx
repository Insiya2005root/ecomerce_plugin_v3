'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete02Icon, Edit02Icon, FolderTreeIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ActionMenu } from '@/components/admin/ActionMenu';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { AdminToaster, toast } from '@/components/admin/toast';
import { controlClass } from '@/components/admin/fields';
import { CategoryDrawer } from '@/components/categories/CategoryDrawer';
import { flattenCategoryTree } from '@/components/categories/categoryTree';
import { useProductListHref } from '@/components/products/useProductListHref';
import { deleteCategory, listCategories } from '@/lib/products/api';
import { categoryPath } from '@/lib/products/form';
import type { Category } from '@/lib/products/types';
import { categoryUrls } from '@/lib/products/urls';
import { cn } from '@/lib/utils';
import { navigate } from '@/lib/router';

type DrawerState = { open: boolean; category: Category | null; parentId: string | null };
const CLOSED: DrawerState = { open: false, category: null, parentId: null };

function CategoriesList() {
  const productsHref = useProductListHref();
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [status, setStatus] = React.useState<{ loading: boolean; error: string | null }>({ loading: true, error: null });
  const [attempt, setAttempt] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [drawer, setDrawer] = React.useState<DrawerState>(CLOSED);
  const { confirm, dialog } = useConfirm();

  React.useEffect(() => {
    let active = true;
    listCategories()
      .then((cats) => {
        if (!active) return;
        setCategories(cats);
        setStatus({ loading: false, error: null });
      })
      .catch((err) => active && setStatus({ loading: false, error: err instanceof Error ? err.message : 'Could not load categories.' }));
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = () => {
    setStatus({ loading: true, error: null });
    setAttempt((n) => n + 1);
  };

  const tree = React.useMemo(() => flattenCategoryTree(categories), [categories]);
  const query = search.trim().toLowerCase();
  // While searching, show matches flat with their full path so the hierarchy stays readable.
  const rows = query
    ? tree.filter((c) => c.name.toLowerCase().includes(query) || (c.slug ?? '').includes(query)).map((c) => ({ ...c, depth: 0 }))
    : tree;

  const remove = (c: Category) =>
    confirm({
      title: 'Delete category?',
      description: (
        <>
          <span className="font-medium text-foreground">{c.name}</span> will be permanently deleted. Categories that still have
          subcategories or products can’t be deleted.
        </>
      ),
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteCategory(String(c._id));
          setCategories((list) => list.filter((x) => x._id !== c._id));
          toast.success('Category deleted', c.name);
        } catch (err) {
          toast.error('Could not delete category', err instanceof Error ? err.message : undefined);
        }
      },
    });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Products', href: productsHref }, { label: 'Categories' }]}
        title="Categories"
        description="Organise products into a category tree for navigation and filtering."
        actions={
          <Button size="sm" className="rounded-md" onClick={() => setDrawer({ open: true, category: null, parentId: null })}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            Create
          </Button>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <div className="relative w-full sm:w-64">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search categories"
              placeholder="Search categories"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(controlClass, 'pl-8')}
            />
          </div>
        </div>

        {status.error ? (
          <ErrorState message={status.error} onRetry={reload} />
        ) : status.loading ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 rounded" style={{ marginLeft: `${(i % 3) * 16}px` }} />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={FolderTreeIcon}
            title="No categories yet"
            description="Products need a category. Create your first one, e.g. “Apparel”."
            action={
              <Button size="sm" className="rounded-md" onClick={() => setDrawer({ open: true, category: null, parentId: null })}>
                Create category
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={Search01Icon} title="No categories match your search" />
        ) : (
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 pl-4 text-xs font-medium text-muted-foreground">Name</TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">Handle</TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">Products</TableHead>
                <TableHead className="hidden h-9 text-xs font-medium text-muted-foreground sm:table-cell">Subcategories</TableHead>
                <TableHead className="h-9 w-12 pr-4"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow
                  key={c._id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('a,button,[role="menu"]')) return;
                    navigate(categoryUrls.detail(String(c._id)));
                  }}
                >
                  <TableCell className="py-2.5 pl-4">
                    <div className="flex items-center gap-1.5" style={{ paddingLeft: `${c.depth * 20}px` }}>
                      {c.depth > 0 && <span aria-hidden className="text-muted-foreground/60">└</span>}
                      <a href={categoryUrls.detail(String(c._id))} className="font-medium hover:underline">
                        {query ? categoryPath(String(c._id), categories) : c.name}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">/{c.slug}</TableCell>
                  <TableCell className="py-2.5 tabular-nums">{c.productCount ?? 0}</TableCell>
                  <TableCell className="hidden py-2.5 tabular-nums text-muted-foreground sm:table-cell">{c.childCount || '—'}</TableCell>
                  <TableCell className="py-2.5 pr-4 text-right">
                    <ActionMenu
                      label={`Actions for ${c.name}`}
                      groups={[
                        [
                          { label: 'Edit', icon: Edit02Icon, onSelect: () => setDrawer({ open: true, category: c, parentId: null }) },
                          { label: 'Add subcategory', icon: Add01Icon, onSelect: () => setDrawer({ open: true, category: null, parentId: String(c._id) }) },
                        ],
                        [{ label: 'Delete', icon: Delete02Icon, destructive: true, onSelect: () => remove(c) }],
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CategoryDrawer
        open={drawer.open}
        category={drawer.category}
        defaultParentId={drawer.parentId}
        categories={categories}
        onClose={() => setDrawer(CLOSED)}
        onSaved={(saved) => {
          const editing = Boolean(drawer.category);
          setDrawer(CLOSED);
          toast.success(editing ? 'Category saved' : 'Category created', saved.name);
          reload();
        }}
      />
      {dialog}
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <AdminToaster>
      <CategoriesList />
    </AdminToaster>
  );
}
