'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete02Icon, Edit02Icon, Folder01Icon, Search01Icon } from '@hugeicons/core-free-icons';
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
import { CollectionDrawer } from '@/components/collections/CollectionDrawer';
import { useProductListHref } from '@/components/products/useProductListHref';
import { formatDate } from '@/lib/format';
import { deleteCollection, listCollections } from '@/lib/products/api';
import type { Collection } from '@/lib/products/types';
import { collectionUrls } from '@/lib/products/urls';
import { cn } from '@/lib/utils';
import { navigate } from '@/lib/router';

type State = { collections: Collection[]; loading: boolean; error: string | null };

function CollectionsList() {
  const productsHref = useProductListHref();
  const [state, setState] = React.useState<State>({ collections: [], loading: true, error: null });
  const [attempt, setAttempt] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [drawer, setDrawer] = React.useState<{ open: boolean; collection: Collection | null }>({ open: false, collection: null });
  const { confirm, dialog } = useConfirm();

  React.useEffect(() => {
    let active = true;
    listCollections()
      .then((res) => active && setState({ collections: res.collections, loading: false, error: null }))
      .catch((err) => active && setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : 'Could not load collections.' })));
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setAttempt((n) => n + 1);
  };

  // Collections are few; filter in the browser for instant results.
  const query = search.trim().toLowerCase();
  const visible = query
    ? state.collections.filter((c) => c.title.toLowerCase().includes(query) || (c.handle ?? '').includes(query))
    : state.collections;

  const remove = (c: Collection) =>
    confirm({
      title: 'Delete collection?',
      description: (
        <>
          <span className="font-medium text-foreground">{c.title}</span> will be deleted.
          {c.productCount ? ` Its ${c.productCount} product${c.productCount === 1 ? '' : 's'} stay in your catalog without a collection.` : ''}
        </>
      ),
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteCollection(c._id);
          setState((s) => ({ ...s, collections: s.collections.filter((x) => x._id !== c._id) }));
          toast.success('Collection deleted', c.title);
        } catch (err) {
          toast.error('Could not delete collection', err instanceof Error ? err.message : undefined);
        }
      },
    });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Products', href: productsHref }, { label: 'Collections' }]}
        title="Collections"
        description="Group products into collections for merchandising and storefront sections."
        actions={
          <Button size="sm" className="rounded-md" onClick={() => setDrawer({ open: true, collection: null })}>
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
              aria-label="Search collections"
              placeholder="Search collections"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(controlClass, 'pl-8')}
            />
          </div>
        </div>

        {state.error ? (
          <ErrorState message={state.error} onRetry={retry} />
        ) : state.loading ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-5 rounded" />
            ))}
          </div>
        ) : state.collections.length === 0 ? (
          <EmptyState
            icon={Folder01Icon}
            title="No collections yet"
            description="Create a collection such as “Summer 2026” or “Best sellers”, then add products to it."
            action={
              <Button size="sm" className="rounded-md" onClick={() => setDrawer({ open: true, collection: null })}>
                Create collection
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState icon={Search01Icon} title="No collections match your search" />
        ) : (
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 pl-4 text-xs font-medium text-muted-foreground">Title</TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">Handle</TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">Products</TableHead>
                <TableHead className="hidden h-9 text-xs font-medium text-muted-foreground md:table-cell">Updated</TableHead>
                <TableHead className="h-9 w-12 pr-4"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => (
                <TableRow
                  key={c._id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('a,button,[role="menu"]')) return;
                    navigate(collectionUrls.detail(c._id));
                  }}
                >
                  <TableCell className="py-2.5 pl-4">
                    <a href={collectionUrls.detail(c._id)} className="font-medium hover:underline">
                      {c.title}
                    </a>
                  </TableCell>
                  <TableCell className="py-2.5 font-mono text-xs text-muted-foreground">/{c.handle}</TableCell>
                  <TableCell className="py-2.5 tabular-nums">{c.productCount ?? 0}</TableCell>
                  <TableCell className="hidden py-2.5 text-muted-foreground md:table-cell">{formatDate(c.updatedAt)}</TableCell>
                  <TableCell className="py-2.5 pr-4 text-right">
                    <ActionMenu
                      label={`Actions for ${c.title}`}
                      groups={[
                        [{ label: 'Edit', icon: Edit02Icon, onSelect: () => setDrawer({ open: true, collection: c }) }],
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

      <CollectionDrawer
        open={drawer.open}
        collection={drawer.collection}
        onClose={() => setDrawer({ open: false, collection: null })}
        onSaved={(saved) => {
          if (drawer.collection) {
            setState((s) => ({ ...s, collections: s.collections.map((x) => (x._id === saved._id ? { ...x, ...saved } : x)) }));
            setDrawer({ open: false, collection: null });
            toast.success('Collection saved', saved.title);
          } else {
            toast.flash('Collection created', 'Now add products to it.');
            navigate(collectionUrls.detail(saved._id));
          }
        }}
      />
      {dialog}
    </div>
  );
}

export default function CollectionsPage() {
  return (
    <AdminToaster>
      <CollectionsList />
    </AdminToaster>
  );
}
