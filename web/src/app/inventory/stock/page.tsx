'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ErrorState, InlineError } from '@/components/admin/StateViews';
import { controlClass } from '@/components/admin/fields';
import { AdminToaster, toast } from '@/components/admin/toast';
import { useDirtyGuard } from '@/components/discounts/RuleSettingsFields';
import { ProductThumbnail } from '@/components/products/ProductBits';
import { UNASSIGNED_LOCATION, bulkUpdateStock, listInventory, type InventoryItemRow } from '@/lib/inventory';
import { inventoryUrls } from '@/lib/products/urls';
import { listLocations, type Location } from '@/lib/settings';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;
const cellKey = (itemId: string, locationId: string) => `${itemId}|${locationId}`;

/** Spreadsheet-style stock editor (Medusa "Edit stock levels"): one row per item, one column per location. */
function StockEditor() {
  const [locations, setLocations] = React.useState<Location[] | null>(null);
  const [searchDraft, setSearchDraft] = React.useState('');
  const [query, setQuery] = React.useState({ search: '', page: 1 });
  const [attempt, setAttempt] = React.useState(0);
  const [result, setResult] = React.useState<{ key: string; items: InventoryItemRow[]; total: number; error: string | null } | null>(null);
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [cellErrors, setCellErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const key = `${JSON.stringify(query)}#${attempt}`;
  const dirty = Object.keys(edits).length > 0;
  const allowLeave = useDirtyGuard(dirty);

  React.useEffect(() => {
    listLocations()
      .then(setLocations)
      .catch(() => setLocations([]));
  }, []);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQuery((q) => (q.search === searchDraft.trim() ? q : { search: searchDraft.trim(), page: 1 })), 300);
    return () => window.clearTimeout(t);
  }, [searchDraft]);

  React.useEffect(() => {
    const controller = new AbortController();
    listInventory({ search: query.search || undefined, sort: 'title', order: 'asc', page: query.page, limit: PAGE_SIZE, includeLevels: '1' }, controller.signal)
      .then((res) => setResult({ key, items: res.items, total: res.total, error: null }))
      .catch((err) => !controller.signal.aborted && setResult({ key, items: [], total: 0, error: err instanceof Error ? err.message : 'Could not load inventory.' }));
    return () => controller.abort();
  }, [key, query]);

  const items = React.useMemo(() => result?.items ?? [], [result]);
  const loading = result?.key !== key;
  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / PAGE_SIZE));
  // Columns: active locations, plus any other location (or "Unassigned") that already holds stock on this page.
  const columns = React.useMemo(() => {
    const cols = (locations ?? []).filter((l) => l.status === 'Active').map((l) => ({ id: l._id, name: l.name }));
    for (const it of items)
      for (const lv of it.levels ?? [])
        if (!cols.some((c) => c.id === lv.locationId)) cols.push({ id: lv.locationId, name: lv.locationId === UNASSIGNED_LOCATION ? 'Unassigned' : (locations ?? []).find((l) => l._id === lv.locationId)?.name ?? 'Other location' });
    return cols;
  }, [locations, items]);

  const changePage = (page: number) => {
    if (dirty && !window.confirm('You have unsaved stock changes on this page. Leave without saving?')) return;
    setEdits({});
    setCellErrors({});
    setQuery((q) => ({ ...q, page }));
  };

  const save = async () => {
    const updates: { itemId: string; locationId: string; stocked: number }[] = [];
    const errs: Record<string, string> = {};
    for (const [k, v] of Object.entries(edits)) {
      const [itemId, locationId] = k.split('|');
      if (!/^\d+$/.test(v.trim())) errs[k] = 'Whole number';
      else updates.push({ itemId, locationId, stocked: Number(v) });
    }
    setCellErrors(errs);
    if (Object.keys(errs).length || updates.length === 0) return;
    setSaving(true);
    try {
      const res = await bulkUpdateStock(updates);
      setEdits({});
      setAttempt((n) => n + 1);
      toast.success('Stock levels saved', `${res.updated} updated`);
    } catch (err) {
      // The server saves what it can and reports the first problem (e.g. below the reserved amount); reload to show the result.
      toast.error('Some stock levels were not saved', (err as { message?: string }).message ?? 'Could not save.');
      setEdits({});
      setAttempt((n) => n + 1);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Inventory', href: inventoryUrls.list() }, { label: 'Edit stock levels' }]}
        title="Edit stock levels"
        description="Type the number on the shelf at each location. Changes are recorded in each item's stock history."
      />
      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="relative w-full sm:w-64">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" aria-label="Search inventory" placeholder="Name or SKU" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} className={cn(controlClass, 'pl-8')} />
          </div>
          <span className="text-xs text-muted-foreground sm:ml-auto">Empty cells mean the item isn&apos;t stocked there yet; typing a number adds it.</span>
        </div>
        {result?.error ? (
          <ErrorState message={result.error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : !result || locations === null ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 rounded" />)}
          </div>
        ) : columns.length === 0 ? (
          <div className="p-4">
            <InlineError message="Add a location under Settings → Locations before editing stock per location." />
          </div>
        ) : (
          <div className={cn('overflow-x-auto', loading && 'opacity-60')}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="sticky left-0 z-10 min-w-56 bg-card px-4 py-2 font-medium">Item</th>
                  {columns.map((c) => (
                    <th key={c.id} className="min-w-32 px-3 py-2 text-right font-medium">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it._id} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 bg-card px-4 py-2">
                      <a href={inventoryUrls.detail(it._id)} className="flex min-w-0 items-center gap-2 hover:underline">
                        <ProductThumbnail src={it.image ?? undefined} className="size-7" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {it.productName}
                            {it.variantLabel && <span className="font-normal text-muted-foreground"> · {it.variantLabel}</span>}
                          </span>
                          {it.sku && <span className="block truncate font-mono text-[11px] text-muted-foreground">{it.sku}</span>}
                        </span>
                      </a>
                    </td>
                    {columns.map((c) => {
                      const level = it.levels?.find((l) => l.locationId === c.id);
                      const k = cellKey(it._id, c.id);
                      const value = edits[k] ?? (level ? String(level.stocked) : '');
                      const changed = k in edits;
                      return (
                        <td key={c.id} className="px-3 py-1.5 text-right align-top">
                          <input
                            aria-label={`${it.title} at ${c.name}`}
                            inputMode="numeric"
                            value={value}
                            placeholder="—"
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^\d]/g, '');
                              setEdits((ed) => {
                                const next = { ...ed };
                                if (v === (level ? String(level.stocked) : '')) delete next[k];
                                else next[k] = v;
                                return next;
                              });
                            }}
                            className={cn(
                              'h-8 w-24 rounded-md border border-input bg-background px-2 text-right tabular-nums shadow-xs outline-none focus:border-ring focus:ring-3 focus:ring-ring/30',
                              changed && 'border-sky-500 bg-sky-50 dark:bg-sky-500/10',
                              cellErrors[k] && 'border-destructive'
                            )}
                          />
                          {level && level.reserved > 0 && <span className="mt-0.5 block text-[11px] text-muted-foreground">{level.reserved} reserved</span>}
                          {cellErrors[k] && <span className="mt-0.5 block text-[11px] text-destructive">{cellErrors[k]}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
          <span className="tabular-nums">{(result?.total ?? 0).toLocaleString('en-IN')} items</span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              Page {query.page} of {pageCount}
            </span>
            <Button variant="outline" size="icon-sm" className="rounded-md" aria-label="Previous page" disabled={query.page <= 1 || loading} onClick={() => changePage(query.page - 1)}>
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            </Button>
            <Button variant="outline" size="icon-sm" className="rounded-md" aria-label="Next page" disabled={query.page >= pageCount || loading} onClick={() => changePage(query.page + 1)}>
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
            </Button>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-40 -mx-4 sm:-mx-6 lg:-mx-8 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="flex items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <span className="mr-auto text-xs text-muted-foreground">{dirty ? `${Object.keys(edits).length} change${Object.keys(edits).length === 1 ? '' : 's'} not saved` : 'No changes'}</span>
          <a
            href={inventoryUrls.list()}
            onClick={(e) => {
              if (dirty && !window.confirm('Leave without saving your stock changes?')) e.preventDefault();
              else allowLeave();
            }}
            className="inline-flex h-7 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted"
          >
            {dirty ? 'Cancel' : 'Back to inventory'}
          </a>
          <Button size="sm" className="rounded-md" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryStockPage() {
  return (
    <AdminToaster>
      <StockEditor />
    </AdminToaster>
  );
}
