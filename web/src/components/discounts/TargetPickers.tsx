"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectField, controlClass } from "@/components/admin/fields";
import { ProductStatusBadge, ProductThumbnail } from "@/components/products/ProductBits";
import { useCategoryOptions } from "@/components/products/ProductFormSections";
import { useProductReferenceData } from "@/components/products/useProductReferenceData";
import { formatMoney } from "@/lib/format";
import { listProducts } from "@/lib/products/api";
import { categoryPath, totalInventory } from "@/lib/products/form";
import { PRODUCT_STATUSES, type Category, type Product } from "@/lib/products/types";
import { cn } from "@/lib/utils";

const API_BASE = "/api/plugins/ecommerce-plugin";
const PAGE_SIZE = 10;

/** Loads product names/images for a set of ids (for chips and summaries). */
export function useProductsById(ids: string[]) {
  const [byId, setById] = React.useState<Record<string, Product>>({});
  const missing = [...new Set(ids)].filter((id) => id && !byId[id]).join(",");
  React.useEffect(() => {
    if (!missing) return;
    let active = true;
    fetch(`${API_BASE}/products?ids=${missing}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (active && d.success) setById((prev) => ({ ...prev, ...Object.fromEntries((d.products as Product[]).map((p) => [p._id, p])) }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [missing]);
  return byId;
}

/**
 * Browse-and-tick product picker (Medusa style): a window with search, category/status filters, pages and checkboxes.
 * Selected products show as chips. `single` keeps at most one product (used for free-product rewards).
 */
export function ProductMultiSelect({
  id,
  value,
  onChange,
  single = false,
  placeholder,
  invalid,
}: {
  id: string;
  value: string[];
  onChange: (ids: string[]) => void;
  single?: boolean;
  placeholder?: string;
  invalid?: boolean;
}) {
  const known = useProductsById(value);
  const [picked, setPicked] = React.useState<Record<string, Product>>({});
  const [open, setOpen] = React.useState(false);
  const lookup = (pid: string) => known[pid] ?? picked[pid];
  const buttonLabel = single ? (value.length ? "Change product" : placeholder ?? "Choose a product") : value.length ? "Add or remove products" : placeholder ?? "Choose products";

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((pid) => {
            const p = lookup(pid);
            return (
              <li key={pid} className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-background pr-1 pl-1 text-xs shadow-xs">
                <ProductThumbnail src={p?.images?.[0]} className="size-5 rounded-sm" />
                <span className="max-w-[16rem] truncate">{p?.name ?? "Loading…"}</span>
                <button type="button" aria-label={`Remove ${p?.name ?? "product"}`} className="rounded p-0.5 text-muted-foreground hover:text-foreground" onClick={() => onChange(value.filter((v) => v !== pid))}>
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Button id={id} type="button" variant="outline" size="sm" aria-invalid={invalid ? true : undefined} className={cn("rounded-md", invalid && "border-destructive")} onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={value.length ? Search01Icon : Add01Icon} strokeWidth={2} data-icon="inline-start" />
        {buttonLabel}
      </Button>
      {open && (
        <ProductPickerDialog
          single={single}
          initial={value}
          onClose={() => setOpen(false)}
          onDone={(ids, products) => {
            setPicked((x) => ({ ...x, ...products }));
            onChange(ids);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ProductPickerDialog({
  single,
  initial,
  onClose,
  onDone,
}: {
  single: boolean;
  initial: string[];
  onClose: () => void;
  onDone: (ids: string[], products: Record<string, Product>) => void;
}) {
  const { categories } = useProductReferenceData();
  const categoryOptions = useCategoryOptions(categories);
  const [selected, setSelected] = React.useState<string[]>(initial);
  const [seen, setSeen] = React.useState<Record<string, Product>>({});
  const [searchDraft, setSearchDraft] = React.useState("");
  const [query, setQuery] = React.useState({ search: "", categoryId: "", status: "", page: 1 });
  const [result, setResult] = React.useState<{ key: string; products: Product[]; total: number; error: string | null } | null>(null);
  const key = JSON.stringify(query);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQuery((q) => (q.search === searchDraft.trim() ? q : { ...q, search: searchDraft.trim(), page: 1 })), 250);
    return () => window.clearTimeout(t);
  }, [searchDraft]);

  React.useEffect(() => {
    const controller = new AbortController();
    listProducts(
      { search: query.search || undefined, categoryId: query.categoryId || undefined, status: (query.status || undefined) as Product["status"] | undefined, sort: "name", order: "asc", page: query.page, limit: PAGE_SIZE },
      controller.signal
    )
      .then((res) => {
        setResult({ key, products: res.products, total: res.total, error: null });
        setSeen((s) => ({ ...s, ...Object.fromEntries(res.products.map((p) => [p._id, p])) }));
      })
      .catch((err) => !controller.signal.aborted && setResult({ key, products: [], total: 0, error: err instanceof Error ? err.message : "Could not load products." }));
    return () => controller.abort();
  }, [key, query]);

  const loading = result?.key !== key;
  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / PAGE_SIZE));
  const toggle = (p: Product) => setSelected((s) => (s.includes(p._id) ? s.filter((x) => x !== p._id) : [...s, p._id]));
  const done = (ids = selected) => onDone(ids, Object.fromEntries(ids.filter((i) => seen[i]).map((i) => [i, seen[i]])));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-3xl" showCloseButton={false}>
        <div className="border-b px-5 py-4">
          <DialogTitle className="text-base font-semibold">{single ? "Choose a product" : "Choose products"}</DialogTitle>
          <DialogDescription className="mt-0.5 text-[13px]">{single ? "Click a product to pick it." : "Tick the products this applies to, then click Done."}</DialogDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
          <div className="relative w-full sm:w-64">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search products"
              placeholder="Search name or SKU"
              value={searchDraft}
              autoFocus
              onChange={(e) => setSearchDraft(e.target.value)}
              // The picker sits inside the promotion form; Enter must not submit it.
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              className={cn(controlClass, "pl-8")}
            />
          </div>
          <SelectField id="picker-category" value={query.categoryId || "all"} options={[{ value: "all", label: "All categories" }, ...categoryOptions]} onChange={(v) => setQuery((q) => ({ ...q, categoryId: v === "all" ? "" : v, page: 1 }))} className="w-full sm:w-48" />
          <SelectField
            id="picker-status"
            value={query.status || "all"}
            options={[{ value: "all", label: "All statuses" }, ...PRODUCT_STATUSES.map((s) => ({ value: s, label: s }))]}
            onChange={(v) => setQuery((q) => ({ ...q, status: v === "all" ? "" : v, page: 1 }))}
            className="w-full sm:w-36"
          />
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto", loading && result && "opacity-60")} role="listbox" aria-multiselectable={!single}>
          {!result ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
            </div>
          ) : result.error ? (
            <p className="px-5 py-8 text-center text-[13px] text-destructive">{result.error}</p>
          ) : result.products.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">No products match.</p>
          ) : (
            <ul className="divide-y">
              {result.products.map((p) => {
                const isSelected = selected.includes(p._id);
                const stock = totalInventory(p);
                return (
                  <li key={p._id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => (single ? done([p._id]) : toggle(p))}
                      className={cn("flex w-full items-center gap-3 px-5 py-2.5 text-left text-[13px] hover:bg-muted/50", isSelected && "bg-muted/40")}
                    >
                      {!single && (
                        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border text-[10px]", isSelected ? "border-foreground bg-foreground text-background" : "border-input")}>
                          {isSelected ? "✓" : ""}
                        </span>
                      )}
                      <ProductThumbnail src={p.images?.[0]} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[p.sku, categoryPath(p.categoryId, categories as Category[]) || null].filter(Boolean).join(" · ") || "—"}
                        </span>
                      </span>
                      <span className={cn("hidden w-24 shrink-0 text-right text-xs tabular-nums sm:block", stock === 0 ? "text-destructive" : "text-muted-foreground")}>
                        {stock === 0 ? "Out of stock" : `${stock} in stock`}
                      </span>
                      <span className="w-20 shrink-0 text-right tabular-nums">{formatMoney(p.pricing?.catalogPrice ?? p.price)}</span>
                      <span className="hidden shrink-0 md:block">
                        <ProductStatusBadge status={p.status} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-[13px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Button type="button" variant="outline" size="icon-sm" className="rounded-md" aria-label="Previous page" disabled={query.page <= 1 || loading} onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}>
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            </Button>
            <span className="tabular-nums">
              Page {query.page} of {pageCount} · {(result?.total ?? 0).toLocaleString("en-IN")} products
            </span>
            <Button type="button" variant="outline" size="icon-sm" className="rounded-md" aria-label="Next page" disabled={query.page >= pageCount || loading} onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}>
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {!single && <span className="text-muted-foreground">{selected.length} selected</span>}
            <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={onClose}>
              Cancel
            </Button>
            {!single && (
              <Button type="button" size="sm" className="rounded-md" onClick={() => done()}>
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Checkbox list of categories, shown with their full path. */
export function CategoryMultiSelect({
  id,
  value,
  onChange,
  categories,
  invalid,
}: {
  id: string;
  value: string[];
  onChange: (ids: string[]) => void;
  categories: Category[];
  invalid?: boolean;
}) {
  const options = React.useMemo(
    () => categories.map((c) => ({ id: String(c._id), label: categoryPath(String(c._id), categories) || c.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [categories]
  );
  if (options.length === 0) return <p className="text-xs text-muted-foreground">No categories yet.</p>;
  return (
    <div id={id} role="group" className={cn("max-h-48 space-y-0.5 overflow-y-auto rounded-md border p-1.5", invalid && "border-destructive")}>
      {options.map((o) => {
        const checked = value.includes(o.id);
        return (
          <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-muted/50">
            <input
              type="checkbox"
              className="accent-foreground"
              checked={checked}
              onChange={() => onChange(checked ? value.filter((v) => v !== o.id) : [...value, o.id])}
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
