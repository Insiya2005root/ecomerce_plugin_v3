'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, ArrowLeft01Icon, ArrowRight01Icon, Delete02Icon, Edit02Icon, PackageIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ActionMenu } from '@/components/admin/ActionMenu';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { SidePanel } from '@/components/admin/SidePanel';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { SelectField, controlClass, type SelectOption } from '@/components/admin/fields';
import { AdminToaster, toast } from '@/components/admin/toast';
import { ReservationPanel } from '@/components/inventory/InventoryPanels';
import { ProductThumbnail } from '@/components/products/ProductBits';
import { formatDateTime } from '@/lib/format';
import { UNASSIGNED_LOCATION, deleteReservation, getInventoryItem, listInventory, listReservations, type InventoryItemDetail, type InventoryItemRow, type Reservation } from '@/lib/inventory';
import { inventoryUrls, orderUrls } from '@/lib/products/urls';
import { listLocations, type Location } from '@/lib/settings';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const KIND_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All reservations' },
  { value: 'order', label: 'For orders' },
  { value: 'manual', label: 'Manual' },
];

/** Step 1 of creating a reservation: pick the item. */
function ItemPickerPanel({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (item: InventoryItemRow) => void }) {
  const [search, setSearch] = React.useState('');
  const [result, setResult] = React.useState<{ q: string; items: InventoryItemRow[] } | null>(null);
  React.useEffect(() => {
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      listInventory({ search: search.trim() || undefined, stock: 'in', sort: 'title', order: 'asc', page: 1, limit: 20 }, controller.signal)
        .then((res) => setResult({ q: search, items: res.items }))
        .catch(() => {});
    }, 200);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [search]);

  return (
    <SidePanel open={open} onOpenChange={(o) => !o && onClose()} title="Create reservation" description="Choose the item to hold stock for. Only items with stock are listed.">
      <div className="space-y-3">
        <div className="relative">
          <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" aria-label="Search items" placeholder="Name or SKU" value={search} autoFocus onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} className={cn(controlClass, 'pl-8')} />
        </div>
        {!result ? (
          <Skeleton className="h-40 rounded" />
        ) : result.items.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">No items with stock match.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {result.items.map((it) => (
              <li key={it._id}>
                <button type="button" onClick={() => onPick(it)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-muted/50">
                  <ProductThumbnail src={it.image ?? undefined} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {it.productName}
                      {it.variantLabel && <span className="font-normal text-muted-foreground"> · {it.variantLabel}</span>}
                    </span>
                    {it.sku && <span className="block truncate font-mono text-xs text-muted-foreground">{it.sku}</span>}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{it.available} available</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SidePanel>
  );
}

function Reservations() {
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [searchDraft, setSearchDraft] = React.useState('');
  const [query, setQuery] = React.useState({ search: '', location: '', kind: '', page: 1 });
  const [attempt, setAttempt] = React.useState(0);
  const [result, setResult] = React.useState<{ key: string; rows: Reservation[]; total: number; error: string | null } | null>(null);
  const [flow, setFlow] = React.useState<{ step: 'pick' } | { step: 'form'; item: InventoryItemDetail; reservation: Reservation | null } | null>(null);
  const [flowKey, setFlowKey] = React.useState(0);
  const { confirm, dialog } = useConfirm();
  const key = `${JSON.stringify(query)}#${attempt}`;

  React.useEffect(() => {
    listLocations()
      .then(setLocations)
      .catch(() => {});
  }, []);
  React.useEffect(() => {
    const t = window.setTimeout(() => setQuery((q) => (q.search === searchDraft.trim() ? q : { ...q, search: searchDraft.trim(), page: 1 })), 300);
    return () => window.clearTimeout(t);
  }, [searchDraft]);
  React.useEffect(() => {
    const controller = new AbortController();
    listReservations({ search: query.search || undefined, locationId: query.location || undefined, kind: (query.kind || undefined) as 'order' | 'manual' | undefined, page: query.page, limit: PAGE_SIZE }, controller.signal)
      .then((res) => setResult({ key, rows: res.reservations, total: res.total, error: null }))
      .catch((err) => !controller.signal.aborted && setResult({ key, rows: [], total: 0, error: err instanceof Error ? err.message : 'Could not load reservations.' }));
    return () => controller.abort();
  }, [key, query]);

  const loading = result?.key !== key;
  const rows = result?.rows ?? [];
  const total = result?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const locationOptions: SelectOption[] = [{ value: 'all', label: 'All locations' }, ...locations.map((l) => ({ value: l._id, label: l.name })), ...(locations.length === 0 ? [{ value: UNASSIGNED_LOCATION, label: 'Unassigned' }] : [])];

  const openForm = async (itemId: string, reservation: Reservation | null) => {
    try {
      const item = await getInventoryItem(itemId);
      setFlowKey((k) => k + 1);
      setFlow({ step: 'form', item, reservation });
    } catch (err) {
      toast.error('Could not open the item', err instanceof Error ? err.message : undefined);
    }
  };
  const remove = (r: Reservation) =>
    confirm({
      title: 'Delete reservation?',
      description: `${r.quantity} × ${r.itemTitle} at ${r.locationName} will be available to sell again.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteReservation(r._id);
          toast.success('Reservation deleted');
          setAttempt((n) => n + 1);
        } catch (err) {
          toast.error('Could not delete', err instanceof Error ? err.message : undefined);
        }
      },
    });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Inventory', href: inventoryUrls.list() }, { label: 'Reservations' }]}
        title="Reservations"
        description="Stock held for orders that aren't packed yet, or set aside by hand."
        actions={
          <Button
            size="sm"
            className="rounded-md"
            onClick={() => {
              setFlowKey((k) => k + 1);
              setFlow({ step: 'pick' });
            }}
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            Create reservation
          </Button>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="relative w-full sm:w-64">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" aria-label="Search reservations" placeholder="Item, SKU or description" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} className={cn(controlClass, 'pl-8')} />
          </div>
          <SelectField id="filter-location" value={query.location || 'all'} options={locationOptions} onChange={(v) => setQuery((q) => ({ ...q, location: v === 'all' ? '' : v, page: 1 }))} className="w-full sm:w-44" />
          <SelectField id="filter-kind" value={query.kind || 'all'} options={KIND_OPTIONS} onChange={(v) => setQuery((q) => ({ ...q, kind: v === 'all' ? '' : v, page: 1 }))} className="w-full sm:w-44" />
        </div>
        {result?.error ? (
          <ErrorState message={result.error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : !result ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 rounded" />)}</div>
        ) : total === 0 ? (
          <EmptyState icon={PackageIcon} title="Nothing is reserved" description="Orders reserve stock automatically until they're packed. You can also hold stock by hand." />
        ) : (
          <>
            <Table className={cn('text-[13px]', loading && 'opacity-60')}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 pl-4 text-xs font-medium text-muted-foreground">Item</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">For</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Location</TableHead>
                  <TableHead className="h-9 text-right text-xs font-medium text-muted-foreground">Quantity</TableHead>
                  <TableHead className="h-9 text-xs font-medium text-muted-foreground">Created</TableHead>
                  <TableHead className="h-9 w-10 pr-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="py-2.5 pl-4">
                      <a href={inventoryUrls.detail(r.itemId)} className="font-medium hover:underline">
                        {r.itemTitle}
                      </a>
                      {r.sku && <span className="block font-mono text-xs text-muted-foreground">{r.sku}</span>}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {r.orderId ? (
                        <a href={orderUrls.detail(r.orderId)} className="hover:underline">
                          Order #{r.orderNumber ?? '—'}
                        </a>
                      ) : (
                        <span>{r.description || 'Manual reservation'}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">{r.locationName}</TableCell>
                    <TableCell className="py-2.5 text-right tabular-nums">{r.quantity}</TableCell>
                    <TableCell className="py-2.5 text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                    <TableCell className="py-2.5 pr-3 text-right">
                      {!r.orderId && (
                        <ActionMenu
                          label="Reservation actions"
                          groups={[
                            [{ label: 'Edit', icon: Edit02Icon, onSelect: () => openForm(r.itemId, r) }],
                            [{ label: 'Delete', icon: Delete02Icon, destructive: true, onSelect: () => remove(r) }],
                          ]}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
              <span className="tabular-nums">{total.toLocaleString('en-IN')} reservations</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  Page {query.page} of {pageCount}
                </span>
                <Button variant="outline" size="icon-sm" className="rounded-md" aria-label="Previous page" disabled={query.page <= 1 || loading} onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}>
                  <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                </Button>
                <Button variant="outline" size="icon-sm" className="rounded-md" aria-label="Next page" disabled={query.page >= pageCount || loading} onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}>
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {flow?.step === 'pick' && <ItemPickerPanel key={flowKey} open onClose={() => setFlow(null)} onPick={(it) => openForm(it._id, null)} />}
      {flow?.step === 'form' && (
        <ReservationPanel
          key={flowKey}
          open
          reservation={flow.reservation}
          itemId={flow.item._id}
          levels={flow.item.levels}
          onClose={() => setFlow(null)}
          onSaved={() => {
            setFlow(null);
            toast.success(flow.reservation ? 'Reservation updated' : 'Stock reserved');
            setAttempt((n) => n + 1);
          }}
        />
      )}
      {dialog}
    </div>
  );
}

export default function ReservationsPage() {
  return (
    <AdminToaster>
      <Reservations />
    </AdminToaster>
  );
}
