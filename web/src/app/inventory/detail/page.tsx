'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete02Icon, Edit02Icon, PackageIcon } from '@hugeicons/core-free-icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ActionMenu } from '@/components/admin/ActionMenu';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { Muted, SectionCard, SectionRow } from '@/components/admin/SectionCard';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { AdminToaster, toast } from '@/components/admin/toast';
import { ItemFlags } from '@/components/inventory/InventoryBits';
import { AdjustStockPanel, ItemSettingsPanel, ManageLocationsPanel, ReservationPanel } from '@/components/inventory/InventoryPanels';
import { ProductStatusBadge, ProductThumbnail } from '@/components/products/ProductBits';
import { useLoader } from '@/components/settings/SettingsBits';
import { formatDateTime } from '@/lib/format';
import { MOVEMENT_LABEL, deleteReservation, getInventoryItem, type InventoryLevel, type Reservation } from '@/lib/inventory';
import { ApiError } from '@/lib/products/api';
import { inventoryUrls, orderUrls, productUrls } from '@/lib/products/urls';
import { listLocations } from '@/lib/settings';
import { cn } from '@/lib/utils';

type Panel = { kind: 'adjust'; level: InventoryLevel } | { kind: 'locations' } | { kind: 'settings' } | { kind: 'attributes' } | { kind: 'reservation'; reservation: Reservation | null } | null;

async function load(id: string) {
  const [item, locations] = await Promise.all([getInventoryItem(id), listLocations()]);
  return { item, locations };
}

function Figure({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-lg font-semibold tabular-nums', tone)}>{value.toLocaleString('en-IN')}</p>
    </div>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function InventoryDetail() {
  const id = useSearchParams().get('id') ?? '';
  const { data, error, reload } = useLoader(() => (id ? load(id) : Promise.reject(new ApiError('Missing id', 400))));
  const [panel, setPanel] = React.useState<Panel>(null);
  const [panelKey, setPanelKey] = React.useState(0);
  const { confirm, dialog } = useConfirm();
  const open = (p: NonNullable<Panel>) => {
    setPanelKey((k) => k + 1);
    setPanel(p);
  };
  const saved = (message: string) => {
    setPanel(null);
    toast.success(message);
    reload();
  };
  const crumbs = [{ label: 'Inventory', href: inventoryUrls.list() }, { label: data?.item.title ?? (error ? 'Item' : 'Loading…') }];

  if (!data) {
    const notFound = error instanceof ApiError && [400, 404].includes(error.status);
    return (
      <div className="space-y-5">
        <AdminPageHeader breadcrumbs={crumbs} />
        {error ? (
          <div className="rounded-lg border bg-card">
            {notFound ? (
              <EmptyState icon={PackageIcon} title="Inventory item not found" action={<a href={inventoryUrls.list()} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md')}>Back to inventory</a>} />
            ) : (
              <ErrorState message={error.message} onRetry={reload} />
            )}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-busy="true">
            <div className="space-y-4">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
            <Skeleton className="h-56 rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  const { item, locations } = data;
  const removeReservation = (r: Reservation) =>
    confirm({
      title: 'Delete reservation?',
      description: `${r.quantity} unit${r.quantity === 1 ? '' : 's'} at ${r.locationName} will be available to sell again.`,
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteReservation(r._id);
          saved('Reservation deleted');
        } catch (err) {
          toast.error('Could not delete', err instanceof Error ? err.message : undefined);
        }
      },
    });

  const attributes: [string, React.ReactNode][] = [
    ['Weight', item.weight !== undefined ? `${item.weight} g` : null],
    ['Size (L × W × H)', [item.length, item.width, item.height].some((v) => v !== undefined) ? `${item.length ?? '–'} × ${item.width ?? '–'} × ${item.height ?? '–'} cm` : null],
    ['Material', item.material],
    ['Unit of measure', item.unit],
    ['HS code', item.hsCode],
    ['MID code', item.midCode],
    ['Country of origin', item.originCountry],
  ];

  return (
    <div className="space-y-5">
      <AdminPageHeader breadcrumbs={crumbs} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <SectionCard>
            <div className="flex flex-wrap items-center gap-4 px-5 py-4">
              <ProductThumbnail src={item.image ?? undefined} className="size-12" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold">
                  {item.productName}
                  {item.variantLabel && <span className="font-normal text-muted-foreground"> · {item.variantLabel}</span>}
                </h2>
                <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                  {item.sku && <span className="font-mono text-xs">{item.sku}</span>}
                  <ItemFlags item={item} />
                </p>
              </div>
              {item.productStatus && <ProductStatusBadge status={item.productStatus} />}
              {item.productExists && (
                <a href={productUrls.detail(item.productId)} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md')}>
                  View product
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 divide-x divide-y border-t sm:grid-cols-4 sm:divide-y-0">
              <Figure label="In stock" value={item.stocked} />
              <Figure label="Reserved" value={item.reserved} />
              <Figure label="Available" value={item.available} tone={item.trackInventory && item.available <= 0 ? 'text-red-600 dark:text-red-400' : undefined} />
              <Figure label="Incoming" value={item.incoming} />
            </div>
          </SectionCard>

          <SectionCard
            title="Locations"
            description={`${item.stocked.toLocaleString('en-IN')} across ${item.levels.length} location${item.levels.length === 1 ? '' : 's'}`}
            actions={
              <Button variant="outline" size="sm" className="rounded-md" onClick={() => open({ kind: 'locations' })}>
                Manage locations
              </Button>
            }
          >
            {item.levels.length === 0 ? (
              <EmptyState icon={PackageIcon} title="Not stocked anywhere" description="Choose the locations that hold this item." />
            ) : (
              <Table className="text-[13px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 pl-5 text-xs font-medium text-muted-foreground">Location</TableHead>
                    <TableHead className="h-9 text-right text-xs font-medium text-muted-foreground">In stock</TableHead>
                    <TableHead className="h-9 text-right text-xs font-medium text-muted-foreground">Reserved</TableHead>
                    <TableHead className="h-9 text-right text-xs font-medium text-muted-foreground">Available</TableHead>
                    <TableHead className="h-9 text-right text-xs font-medium text-muted-foreground">Incoming</TableHead>
                    <TableHead className="h-9 w-24 pr-5" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.levels.map((l) => (
                    <TableRow key={l._id}>
                      <TableCell className="py-2.5 pl-5 font-medium">{l.locationName}</TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums">{l.stocked}</TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums">{l.reserved || <Muted>0</Muted>}</TableCell>
                      <TableCell className={cn('py-2.5 text-right font-medium tabular-nums', l.available <= 0 && item.trackInventory && 'text-red-600 dark:text-red-400')}>{l.available}</TableCell>
                      <TableCell className="py-2.5 text-right tabular-nums">{l.incoming || <Muted>0</Muted>}</TableCell>
                      <TableCell className="py-2.5 pr-5 text-right">
                        <Button variant="outline" size="sm" className="h-7 rounded-md" onClick={() => open({ kind: 'adjust', level: l })}>
                          Adjust
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard
            title="Reservations"
            description="Stock held for orders that aren't packed yet, or put aside by hand."
            actions={
              <Button variant="outline" size="sm" className="rounded-md" disabled={item.levels.length === 0} onClick={() => open({ kind: 'reservation', reservation: null })}>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
                Create reservation
              </Button>
            }
          >
            {item.reservations.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-muted-foreground">Nothing is reserved.</p>
            ) : (
              <Table className="text-[13px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 pl-5 text-xs font-medium text-muted-foreground">For</TableHead>
                    <TableHead className="h-9 text-xs font-medium text-muted-foreground">Location</TableHead>
                    <TableHead className="h-9 text-right text-xs font-medium text-muted-foreground">Quantity</TableHead>
                    <TableHead className="h-9 text-xs font-medium text-muted-foreground">Created</TableHead>
                    <TableHead className="h-9 w-10 pr-3" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.reservations.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell className="py-2.5 pl-5">
                        {r.orderId ? (
                          <a href={orderUrls.detail(r.orderId)} className="font-medium hover:underline">
                            Order #{r.orderNumber ?? '—'}
                          </a>
                        ) : (
                          <span className="font-medium">{r.description || 'Manual reservation'}</span>
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
                              [{ label: 'Edit', icon: Edit02Icon, onSelect: () => open({ kind: 'reservation', reservation: r }) }],
                              [{ label: 'Delete', icon: Delete02Icon, destructive: true, onSelect: () => removeReservation(r) }],
                            ]}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard title="Stock history" description="Every change to this item's stock, newest first.">
            {item.movements.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-muted-foreground">No changes yet.</p>
            ) : (
              <ol className="divide-y">
                {item.movements.map((m) => {
                  const change = m.stockedDelta ? `${signed(m.stockedDelta)} in stock` : m.reservedDelta ? `${signed(m.reservedDelta)} reserved` : '';
                  return (
                    <li key={m._id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-2.5 text-[13px]">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {MOVEMENT_LABEL[m.type] ?? m.type}
                          {m.orderNumber && (
                            <>
                              {' · '}
                              <a href={orderUrls.detail(m.orderId!)} className="font-normal underline-offset-2 hover:underline">
                                #{m.orderNumber}
                              </a>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[m.locationName, m.reason && m.reason !== MOVEMENT_LABEL[m.type] ? m.reason : null, m.note, m.by].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn('font-medium tabular-nums', m.stockedDelta > 0 || (!m.stockedDelta && m.reservedDelta < 0) ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground')}>{change}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.stockedAfter !== undefined ? `${m.stockedAfter} in stock · ` : ''}
                          {formatDateTime(m.createdAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Stock settings" actions={<ActionMenu label="Stock settings actions" groups={[[{ label: 'Edit', icon: Edit02Icon, onSelect: () => open({ kind: 'settings' }) }]]} />}>
            <dl className="divide-y">
              <SectionRow label="Track inventory">{item.trackInventory ? 'Yes' : 'No'}</SectionRow>
              <SectionRow label="Allow backorders">{item.trackInventory && item.allowBackorder ? 'Yes' : 'No'}</SectionRow>
              <SectionRow label="Requires shipping">{item.requiresShipping !== false ? 'Yes' : 'No'}</SectionRow>
            </dl>
          </SectionCard>
          <SectionCard title="Attributes" actions={<ActionMenu label="Attribute actions" groups={[[{ label: 'Edit', icon: Edit02Icon, onSelect: () => open({ kind: 'attributes' }) }]]} />}>
            <dl className="divide-y">
              {attributes.map(([label, value]) => (
                <SectionRow key={label} label={label}>
                  {value || <Muted />}
                </SectionRow>
              ))}
            </dl>
          </SectionCard>
        </div>
      </div>

      {panel?.kind === 'adjust' && <AdjustStockPanel key={panelKey} open item={item} level={panel.level} onClose={() => setPanel(null)} onSaved={() => saved('Stock updated')} />}
      {panel?.kind === 'locations' && <ManageLocationsPanel key={panelKey} open item={item} locations={locations} onClose={() => setPanel(null)} onSaved={() => saved('Locations updated')} />}
      {(panel?.kind === 'settings' || panel?.kind === 'attributes') && <ItemSettingsPanel key={panelKey} open item={item} section={panel.kind} onClose={() => setPanel(null)} onSaved={() => saved('Item updated')} />}
      {panel?.kind === 'reservation' && (
        <ReservationPanel key={panelKey} open reservation={panel.reservation} itemId={item._id} levels={item.levels} onClose={() => setPanel(null)} onSaved={() => saved(panel.reservation ? 'Reservation updated' : 'Stock reserved')} />
      )}
      {dialog}
    </div>
  );
}

export default function InventoryDetailPage() {
  return (
    <AdminToaster>
      <Suspense fallback={null}>
        <InventoryDetail />
      </Suspense>
    </AdminToaster>
  );
}
