import { HugeiconsIcon } from "@hugeicons/react";
import { Image01Icon } from "@hugeicons/core-free-icons";
import { StatusBadge, type StatusTone } from "@/components/admin/StatusBadge";
import { formatMoney } from "@/lib/format";
import { totalInventory } from "@/lib/products/form";
import type { Product, ProductStatus } from "@/lib/products/types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<ProductStatus, StatusTone> = {
  Published: "green",
  Draft: "grey",
  Archived: "orange",
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <StatusBadge tone={STATUS_TONE[status] ?? "grey"}>{status}</StatusBadge>;
}

export function ProductThumbnail({ src, className }: { src?: string; className?: string }) {
  return (
    <div className={cn("flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/40", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URLs / external URLs, no image loader in static export
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <HugeiconsIcon icon={Image01Icon} strokeWidth={1.75} className="size-3.5 text-muted-foreground" />
      )}
    </div>
  );
}

/** Customer-facing price as resolved by the backend, with the regular price struck through when discounted. */
export function ProductPrice({ product, className }: { product: Product; className?: string }) {
  const pricing = product.pricing;
  const catalog = pricing?.catalogPrice ?? product.price;
  const compareAt = pricing?.compareAtPrice ?? null;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5 tabular-nums", className)}>
      <span className="text-foreground">{formatMoney(catalog)}</span>
      {compareAt !== null && <span className="text-xs text-muted-foreground line-through">{formatMoney(compareAt)}</span>}
    </span>
  );
}

export function ProductInventory({ product }: { product: Product }) {
  const total = totalInventory(product);
  const variantCount = product.variants?.length ?? 0;
  return (
    <span className="tabular-nums">
      {total === 0 ? <span className="text-destructive">Out of stock</span> : <span>{total.toLocaleString("en-IN")} in stock</span>}
      {variantCount > 0 && (
        <span className="block text-xs text-muted-foreground">
          {variantCount} variant{variantCount === 1 ? "" : "s"}
        </span>
      )}
    </span>
  );
}
