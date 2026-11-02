'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Alert02Icon, Location01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { AdminToaster, toast } from '@/components/admin/toast';
import { LocationPanel } from '@/components/settings/LocationPanel';
import { ActiveBadge, useLoader } from '@/components/settings/SettingsBits';
import { settingsUrls } from '@/lib/products/urls';
import { hasCoordinates, listLocations } from '@/lib/settings';

function Locations() {
  const { data: locations, error, reload } = useLoader(listLocations);
  const [adding, setAdding] = React.useState(false);
  const [panelKey, setPanelKey] = React.useState(0);
  const crumbs = [{ label: 'Settings', href: settingsUrls.overview() }, { label: 'Locations' }];
  const add = () => {
    setPanelKey((k) => k + 1);
    setAdding(true);
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={crumbs}
        title="Locations"
        description="Stores and warehouses you ship from. Distance shipping is measured from these."
        actions={
          <Button size="sm" className="rounded-md" onClick={add}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            Add location
          </Button>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        {!locations ? (
          error ? (
            <ErrorState message={error.message} onRetry={reload} />
          ) : (
            <div className="space-y-2 p-4" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
            </div>
          )
        ) : locations.length === 0 ? (
          <EmptyState
            icon={Location01Icon}
            title="No locations yet"
            description="Add the store or warehouse you ship from. Distance-based shipping needs at least one."
            action={<Button size="sm" className="rounded-md" onClick={add}>Add location</Button>}
          />
        ) : (
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 pl-5 text-xs font-medium text-muted-foreground">Location</TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">Address</TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">Map</TableHead>
                <TableHead className="h-9 pr-5 text-xs font-medium text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((l) => (
                <TableRow
                  key={l._id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('a,button')) return;
                    window.location.href = settingsUrls.location(l._id);
                  }}
                >
                  <TableCell className="py-2.5 pl-5">
                    <a href={settingsUrls.location(l._id)} className="font-medium hover:underline">
                      {l.name}
                    </a>
                    {l.priority ? <span className="block text-xs text-muted-foreground">Priority {l.priority}</span> : null}
                  </TableCell>
                  <TableCell className="max-w-xs py-2.5">
                    <span className="block truncate">{l.addressLine1}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[l.city, l.state, l.postalCode].filter(Boolean).join(', ')}</span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    {hasCoordinates(l) ? (
                      <span className="text-muted-foreground">Pinned</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3.5" />
                        Not found on map
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 pr-5">
                    <ActiveBadge status={l.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <LocationPanel
        key={panelKey}
        open={adding}
        location={null}
        onClose={() => setAdding(false)}
        onSaved={(saved) => {
          setAdding(false);
          toast.flash('Location added', saved.name);
          window.location.href = settingsUrls.location(saved._id);
        }}
      />
    </div>
  );
}

export default function LocationsPage() {
  return (
    <AdminToaster>
      <Locations />
    </AdminToaster>
  );
}
