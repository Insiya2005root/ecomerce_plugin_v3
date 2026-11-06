'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from '@/lib/router';
import { Alert02Icon, Delete02Icon, Edit02Icon, Location01Icon, ToggleOffIcon, ToggleOnIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionMenu } from '@/components/admin/ActionMenu';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { Muted, SectionCard, SectionRow } from '@/components/admin/SectionCard';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { AdminToaster, toast } from '@/components/admin/toast';
import { LocationPanel } from '@/components/settings/LocationPanel';
import { ActiveBadge, useLoader } from '@/components/settings/SettingsBits';
import { ApiError } from '@/lib/products/api';
import { inventoryUrls, settingsUrls } from '@/lib/products/urls';
import { deleteLocation, getLocation, hasCoordinates, updateLocation } from '@/lib/settings';
import { cn } from '@/lib/utils';
import { navigate } from '@/lib/router';

function LocationDetail() {
  const id = useSearchParams().get('id') ?? '';
  const { data, error, reload, setData } = useLoader(() => (id ? getLocation(id) : Promise.reject(new ApiError('Missing id', 400))));
  const [editing, setEditing] = React.useState(false);
  const [panelKey, setPanelKey] = React.useState(0);
  const [locating, setLocating] = React.useState(false);
  const { confirm, dialog } = useConfirm();
  const crumbs = [{ label: 'Settings', href: settingsUrls.overview() }, { label: 'Locations', href: settingsUrls.locations() }, { label: data?.location.name ?? (error ? 'Location' : 'Loading…') }];

  if (!data) {
    const notFound = error instanceof ApiError && [400, 404, 500].includes(error.status);
    return (
      <div className="space-y-5">
        <AdminPageHeader breadcrumbs={crumbs} />
        {error ? (
          <div className="rounded-lg border bg-card">
            {notFound ? (
              <EmptyState icon={Location01Icon} title="Location not found" action={<a href={settingsUrls.locations()} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md')}>Back to locations</a>} />
            ) : (
              <ErrorState message={error.message} onRetry={reload} />
            )}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-busy="true">
            <Skeleton className="h-56 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  const { location: l, orderCount, stock } = data;
  const pinned = hasCoordinates(l);

  const setActive = (active: boolean) =>
    confirm({
      title: active ? 'Activate location?' : 'Deactivate location?',
      description: active ? `${l.name} will be used to ship orders again.` : `${l.name} won't be used to ship new orders. Existing orders are not affected.`,
      confirmLabel: active ? 'Activate' : 'Deactivate',
      destructive: !active,
      onConfirm: async () => {
        try {
          setData({ ...data, location: await updateLocation(l._id, { status: active ? 'Active' : 'Inactive' }) });
          toast.success(active ? 'Location activated' : 'Location deactivated');
        } catch (err) {
          toast.error('Could not update the location', err instanceof Error ? err.message : undefined);
        }
      },
    });

  const remove = () =>
    confirm({
      title: 'Delete location?',
      description: (
        <>
          <span className="font-medium text-foreground">{l.name}</span> will be deleted.
          {orderCount > 0 ? ` ${orderCount} past order${orderCount === 1 ? '' : 's'} keep the shipping details they were placed with.` : ''} To stop using it but keep it, deactivate it instead.
        </>
      ),
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteLocation(l._id);
          toast.flash('Location deleted', l.name);
          navigate(settingsUrls.locations());
        } catch (err) {
          toast.error('Could not delete the location', err instanceof Error ? err.message : undefined);
        }
      },
    });

  const findOnMap = async () => {
    setLocating(true);
    try {
      const updated = await updateLocation(l._id, { latitude: null, longitude: null });
      setData({ ...data, location: updated });
      if (hasCoordinates(updated)) toast.success('Found on the map');
      else toast.error('Address not found on the map', 'Check the address, or enter the coordinates yourself.');
    } catch (err) {
      toast.error('Could not look up the address', err instanceof Error ? err.message : undefined);
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader breadcrumbs={crumbs} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <SectionCard
            title={<span className="text-base">{l.name}</span>}
            actions={
              <>
                <ActiveBadge status={l.status} />
                <ActionMenu
                  label="Location actions"
                  groups={[
                    [
                      {
                        label: 'Edit',
                        icon: Edit02Icon,
                        onSelect: () => {
                          setPanelKey((k) => k + 1);
                          setEditing(true);
                        },
                      },
                      l.status === 'Active' ? { label: 'Deactivate', icon: ToggleOffIcon, onSelect: () => setActive(false) } : { label: 'Activate', icon: ToggleOnIcon, onSelect: () => setActive(true) },
                    ],
                    [{ label: 'Delete', icon: Delete02Icon, destructive: true, onSelect: remove }],
                  ]}
                />
              </>
            }
          >
            <dl className="divide-y">
              <SectionRow label="Address">
                {[l.addressLine1, l.addressLine2, [l.city, l.state, l.postalCode].filter(Boolean).join(', '), l.country].filter(Boolean).map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </SectionRow>
              <SectionRow label="Priority">{l.priority || <Muted>0</Muted>}</SectionRow>
            </dl>
          </SectionCard>

          <SectionCard
            title="Map"
            description="Distance shipping is measured from here."
            actions={
              <Button variant="outline" size="sm" className="rounded-md" onClick={findOnMap} disabled={locating}>
                {locating ? 'Looking up…' : 'Find from address'}
              </Button>
            }
          >
            {pinned ? (
              <dl className="divide-y">
                <SectionRow label="Coordinates">
                  <span className="font-mono text-xs tabular-nums">
                    {l.latitude?.toFixed(5)}, {l.longitude?.toFixed(5)}
                  </span>
                </SectionRow>
                <SectionRow label="View">
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${l.latitude}&mlon=${l.longitude}#map=16/${l.latitude}/${l.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Open in OpenStreetMap
                  </a>
                </SectionRow>
              </dl>
            ) : (
              <div className="flex items-start gap-2 px-5 py-4 text-[13px] text-amber-800 dark:text-amber-200">
                <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="mt-0.5 size-4 shrink-0" />
                <p>This address wasn&apos;t found on the map, so it can&apos;t be used for distance shipping. Try “Find from address”, or edit the location and enter the coordinates.</p>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Usage">
            <dl className="divide-y">
              <SectionRow label="Items stocked here">
                {stock?.items ? (
                  <a href={inventoryUrls.list(`location=${l._id}`)} className="underline-offset-2 hover:underline">
                    {stock.items} item{stock.items === 1 ? '' : 's'} · {stock.stocked} units
                  </a>
                ) : (
                  <Muted>None</Muted>
                )}
              </SectionRow>
              {stock?.reserved ? <SectionRow label="Reserved for orders">{stock.reserved} units</SectionRow> : null}
              <SectionRow label="Orders shipped from here">{orderCount}</SectionRow>
              <SectionRow label="Distance shipping">{l.status === 'Active' && pinned ? 'Available' : <Muted>Not available</Muted>}</SectionRow>
            </dl>
          </SectionCard>
        </div>
      </div>

      <LocationPanel
        key={panelKey}
        open={editing}
        location={l}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setData({ ...data, location: saved });
          setEditing(false);
          toast.success('Location saved');
        }}
      />
      {dialog}
    </div>
  );
}

export default function LocationDetailPage() {
  return (
    <AdminToaster>
      <Suspense fallback={null}>
        <LocationDetail />
      </Suspense>
    </AdminToaster>
  );
}
