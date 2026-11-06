"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionMenu } from "@/components/admin/ActionMenu";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState, ErrorState } from "@/components/admin/StateViews";
import { SelectField, controlClass, type SelectOption } from "@/components/admin/fields";
import { toast } from "@/components/admin/toast";
import { CodeChip, DiscountStatusBadge, TAB_ACCENT, TabIcon, UsageMeter } from "@/components/discounts/PromotionBits";
import { useDiscountActions } from "@/components/discounts/useDiscountActions";
import { listDiscounts } from "@/lib/discounts/api";
import { TAB_META, TYPE_LABEL, describeRule, liveStatus, promotionUrls, scheduleLabel, tabOf, type LiveStatus, type PromotionTab } from "@/lib/discounts/describe";
import type { DiscountRule } from "@/lib/discounts/types";
import { cn } from "@/lib/utils";
import { navigate } from "@/lib/router";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "all", label: "All statuses" },
  ...(["Active", "Scheduled", "Expired", "Limit reached", "Paused", "Draft"] as LiveStatus[]).map((s) => ({ value: s, label: s })),
];
const TYPE_OPTIONS: SelectOption[] = [
  { value: "all", label: "All types" },
  ...["percentage", "fixed_amount", "buy_x_get_y", "spend_x_get_y"].map((t) => ({ value: t, label: TYPE_LABEL[t] })),
];

const head = "h-9 text-xs font-medium text-muted-foreground";

/** One Promotions tab: the rules of that kind, with search, filters and row actions. */
export function PromotionsList({ tab }: { tab: PromotionTab }) {
  const meta = TAB_META[tab];
  const [rules, setRules] = React.useState<DiscountRule[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [type, setType] = React.useState("all");

  React.useEffect(() => {
    let active = true;
    listDiscounts()
      .then((all) => active && (setRules(all.filter((r) => tabOf(r) === tab)), setError(null)))
      .catch((err) => active && setError(err instanceof Error ? err.message : "Could not load discounts."));
    return () => {
      active = false;
    };
  }, [tab, attempt]);

  const { menuFor, dialog } = useDiscountActions({
    includeView: true,
    onUpdated: (r) => setRules((list) => list && list.map((x) => (x._id === r._id ? { ...x, ...r } : x))),
    onRemoved: (r, archived) => {
      setRules((list) => list && list.filter((x) => x._id !== r._id));
      toast.success(archived ? "Archived (used by past orders)" : "Deleted", r.name);
    },
  });

  const q = search.trim().toLowerCase();
  const visible = (rules ?? []).filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q) || (r.code ?? "").toLowerCase().includes(q)) &&
      (status === "all" || liveStatus(r) === status) &&
      (type === "all" || r.type === type)
  );
  const filtered = Boolean(q) || status !== "all" || type !== "all";
  const clear = () => {
    setSearch("");
    setStatus("all");
    setType("all");
  };

  const createHref = promotionUrls.create(tab);
  const createButton = (
    <a href={createHref} className={cn(buttonVariants({ size: "sm" }), "rounded-md")}>
      <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
      Create {meta.singular}
    </a>
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={[{ label: "Promotions", href: promotionUrls.overview() }, { label: meta.label }]}
        title={
          <span className="flex items-center gap-2.5">
            <TabIcon tab={tab} className="size-7" />
            {meta.label}
          </span>
        }
        description={meta.description}
        actions={createButton}
      />

      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="relative w-full sm:w-64">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label={`Search ${meta.label.toLowerCase()}`}
              placeholder={tab === "coupons" ? "Search name or code" : "Search by name"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(controlClass, "pl-8")}
            />
          </div>
          <SelectField id="filter-status" value={status} options={STATUS_OPTIONS} onChange={(v) => setStatus(v || "all")} className="w-full sm:w-40" />
          {(tab === "automatic" || tab === "coupons") && (
            <SelectField id="filter-type" value={type} options={TYPE_OPTIONS} onChange={(v) => setType(v || "all")} className="w-full sm:w-40" />
          )}
          {filtered && (
            <Button variant="ghost" size="sm" className="rounded-md text-muted-foreground" onClick={clear}>
              Clear filters
            </Button>
          )}
          {rules && <span className="ml-auto text-xs text-muted-foreground tabular-nums">{visible.length} of {rules.length}</span>}
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : !rules ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 rounded" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <EmptyState icon={TAB_ACCENT[tab].icon} title={`No ${meta.label.toLowerCase()} yet`} description={meta.description} action={createButton} />
        ) : visible.length === 0 ? (
          <EmptyState icon={Search01Icon} title="Nothing matches your filters" action={<Button variant="outline" size="sm" className="rounded-md" onClick={clear}>Clear filters</Button>} />
        ) : (
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn(head, "pl-4")}>{tab === "coupons" ? "Coupon" : "Name"}</TableHead>
                <TableHead className={head}>{tab === "campaigns" ? "Includes" : tab === "custom" ? "Rule" : "Offer"}</TableHead>
                <TableHead className={head}>Status</TableHead>
                <TableHead className={cn(head, "hidden md:table-cell")}>{tab === "campaigns" ? "Storefront" : tab === "custom" ? "Priority" : "Usage"}</TableHead>
                <TableHead className={cn(head, "hidden lg:table-cell")}>Schedule</TableHead>
                <TableHead className={cn(head, "w-12 pr-4")}><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow
                  key={r._id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('a,button,[role="menu"]')) return;
                    navigate(promotionUrls.detail(r._id));
                  }}
                >
                  <TableCell className="max-w-[18rem] py-2.5 pl-4">
                    <a href={promotionUrls.detail(r._id)} className="block truncate font-medium hover:underline">
                      {r.name}
                    </a>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {r.code && <CodeChip code={r.code} />}
                      {tab !== "coupons" && tab !== "campaigns" && tab !== "custom" && <span>{TYPE_LABEL[r.type]}</span>}
                      {r.stackingPolicy === "exclusive" && <span className="rounded bg-zinc-900 px-1.5 py-px text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Exclusive</span>}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[22rem] py-2.5 text-muted-foreground">
                    <span className="line-clamp-2">{describeRule(r)}</span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <DiscountStatusBadge rule={r} />
                  </TableCell>
                  <TableCell className="hidden py-2.5 md:table-cell">
                    {tab === "campaigns" ? (
                      <span className={r.campaign?.storefrontDisplay ? "text-foreground" : "text-muted-foreground"}>{r.campaign?.storefrontDisplay ? "Shown" : "Hidden"}</span>
                    ) : tab === "custom" ? (
                      <span className="tabular-nums">{r.priority ?? 0}</span>
                    ) : (
                      <UsageMeter rule={r} />
                    )}
                  </TableCell>
                  <TableCell className="hidden py-2.5 text-muted-foreground lg:table-cell">{scheduleLabel(r)}</TableCell>
                  <TableCell className="py-2.5 pr-4 text-right">
                    <ActionMenu groups={menuFor(r)} label={`Actions for ${r.name}`} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      {dialog}
    </div>
  );
}
