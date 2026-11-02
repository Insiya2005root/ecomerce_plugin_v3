"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { controlClass } from "@/components/admin/fields";
import { SidePanel } from "@/components/admin/SidePanel";
import { InlineError } from "@/components/admin/StateViews";
import { ProductStatusBadge, ProductThumbnail } from "@/components/products/ProductBits";
import { listProducts } from "@/lib/products/api";
import type { Collection, Product } from "@/lib/products/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

/** Pick catalog products to add to a collection. Products already in another collection are moved. */
export function AddProductsDrawer({
  open,
  collection,
  collections,
  onClose,
  onAdd,
}: {
  open: boolean;
  collection: Collection;
  collections: Collection[];
  onClose: () => void;
  onAdd: (ids: string[]) => Promise<void>;
}) {
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [result, setResult] = React.useState<{ key: string; products: Product[]; total: number; error: string | null } | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSearch("");
      setQuery("");
      setPage(1);
      setSelected(new Set());
    }
  }

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const key = `${query}#${page}`;
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    listProducts({ search: query || undefined, page, limit: PAGE_SIZE, sort: "name", order: "asc" }, controller.signal)
      .then((res) => setResult({ key, products: res.products, total: res.total, error: null }))
      .catch((err) => {
        if (!controller.signal.aborted) setResult({ key, products: [], total: 0, error: err instanceof Error ? err.message : "Could not load products." });
      });
    return () => controller.abort();
  }, [open, query, page, key]);

  const loading = !result || result.key !== key;
  const collectionTitle = (id?: string | null) => collections.find((c) => c._id === id)?.title;
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await onAdd([...selected]);
    } finally {
      setSaving(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / PAGE_SIZE));

  return (
    <SidePanel
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={`Add products to ${collection.title}`}
      description="Select products to include. A product can belong to one collection, so products already in another collection move here."
      wide
      onSubmit={submit}
      footer={
        <>
          <span className="mr-auto text-xs text-muted-foreground">{selected.size} selected</span>
          <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" className="rounded-md" disabled={saving || selected.size === 0}>
            {saving ? "Adding…" : `Add ${selected.size || ""} product${selected.size === 1 ? "" : "s"}`.replace("  ", " ")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search products"
            placeholder="Search name or SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(controlClass, "pl-8")}
          />
        </div>
        {result?.error && !loading && <InlineError message={result.error} />}
        <div className="divide-y rounded-md border">
          {loading && !result
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="size-8 rounded" />
                  <Skeleton className="h-3 w-48 rounded" />
                </div>
              ))
            : (result?.products ?? []).map((p) => {
                const inThis = p.collectionId === collection._id;
                const other = !inThis ? collectionTitle(p.collectionId) : undefined;
                return (
                  <label
                    key={p._id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-[13px]",
                      inThis ? "opacity-60" : "cursor-pointer hover:bg-muted/40",
                      loading && "opacity-60"
                    )}
                  >
                    <Checkbox checked={inThis || selected.has(p._id)} disabled={inThis} onCheckedChange={() => toggle(p._id)} aria-label={`Select ${p.name}`} />
                    <ProductThumbnail src={p.images?.[0]} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.sku}
                        {inThis ? " · Already in this collection" : other ? ` · In “${other}”` : ""}
                      </span>
                    </span>
                    <ProductStatusBadge status={p.status} />
                  </label>
                );
              })}
          {!loading && result && result.products.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">No products found.</p>
          )}
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Page {page} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-md" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-md" disabled={page >= pageCount || loading} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </SidePanel>
  );
}
