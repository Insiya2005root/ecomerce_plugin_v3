import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Coupon01Icon, FlowConnectionIcon, Megaphone01Icon, Tag01Icon } from "@hugeicons/core-free-icons";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LIVE_STATUS_TONE, liveStatus, type PromotionTab } from "@/lib/discounts/describe";
import type { DiscountRule } from "@/lib/discounts/types";
import { cn } from "@/lib/utils";

export function DiscountStatusBadge({ rule }: { rule: DiscountRule }) {
  const status = liveStatus(rule);
  return <StatusBadge tone={LIVE_STATUS_TONE[status]}>{status}</StatusBadge>;
}

/** Each Promotions tab has its own accent so the four kinds are easy to tell apart. */
export const TAB_ACCENT: Record<PromotionTab, { icon: IconSvgElement; tile: string; chip: string }> = {
  automatic: { icon: Tag01Icon, tile: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400", chip: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300" },
  coupons: { icon: Coupon01Icon, tile: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400", chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  campaigns: { icon: Megaphone01Icon, tile: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400", chip: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300" },
  custom: { icon: FlowConnectionIcon, tile: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400", chip: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
};

export function TabIcon({ tab, className }: { tab: PromotionTab; className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", TAB_ACCENT[tab].tile, className)}>
      <HugeiconsIcon icon={TAB_ACCENT[tab].icon} strokeWidth={1.75} className="size-4" />
    </span>
  );
}

export function CodeChip({ code }: { code: string }) {
  return (
    <span className="inline-flex h-5 items-center rounded border border-dashed border-emerald-400/70 bg-emerald-50/60 px-1.5 font-mono text-[11px] font-medium tracking-wide text-emerald-800 uppercase dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-300">
      {code}
    </span>
  );
}

/** Used vs limit, with a small bar that turns orange near the limit. */
export function UsageMeter({ rule, className }: { rule: DiscountRule; className?: string }) {
  const used = rule.usedCount ?? 0;
  const limit = rule.usageLimit ?? 0;
  if (!limit) {
    return <span className={cn("tabular-nums text-muted-foreground", className)}>{used.toLocaleString("en-IN")} used</span>;
  }
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <span className={cn("inline-flex min-w-24 flex-col gap-1", className)}>
      <span className="tabular-nums">
        {used.toLocaleString("en-IN")} <span className="text-muted-foreground">/ {limit.toLocaleString("en-IN")}</span>
      </span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className={cn("block h-full rounded-full", pct >= 90 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}
