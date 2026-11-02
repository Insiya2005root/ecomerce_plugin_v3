import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";
import type { InventoryItemRow } from "@/lib/inventory";
import { cn } from "@/lib/utils";

/** Small tags for items that don't follow the normal stock rules. */
export function ItemFlags({ item }: { item: Pick<InventoryItemRow, "trackInventory" | "allowBackorder"> }) {
  return (
    <>
      {!item.trackInventory && <span className="rounded border px-1 py-px text-[10px] font-medium">Not tracked</span>}
      {item.trackInventory && item.allowBackorder && <span className="rounded border border-violet-300 px-1 py-px text-[10px] font-medium text-violet-700 dark:border-violet-500/40 dark:text-violet-300">Backorders</span>}
    </>
  );
}

/** Available count with a warning colour (and icon) when out of stock or low. */
export function AvailableCell({ item, low }: { item: Pick<InventoryItemRow, "available" | "trackInventory">; low: number }) {
  if (!item.trackInventory) return <span className="text-muted-foreground">—</span>;
  const out = item.available <= 0;
  const isLow = !out && item.available <= low;
  return (
    <span className={cn("inline-flex items-center justify-end gap-1 font-medium tabular-nums", out ? "text-red-600 dark:text-red-400" : isLow ? "text-amber-700 dark:text-amber-300" : "text-foreground")}>
      {(out || isLow) && <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-3.5" />}
      {item.available.toLocaleString("en-IN")}
    </span>
  );
}
