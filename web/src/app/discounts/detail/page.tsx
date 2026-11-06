'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Edit02Icon, PauseIcon, PlayIcon, Tag01Icon } from '@hugeicons/core-free-icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionMenu } from '@/components/admin/ActionMenu';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Muted, SectionCard, SectionRow } from '@/components/admin/SectionCard';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { AdminToaster, toast } from '@/components/admin/toast';
import { CodeChip, DiscountStatusBadge, TabIcon, UsageMeter } from '@/components/discounts/PromotionBits';
import { useProductsById } from '@/components/discounts/TargetPickers';
import { useDiscountActions } from '@/components/discounts/useDiscountActions';
import { PaymentBadge } from '@/components/orders/OrderBits';
import { useProductReferenceData } from '@/components/products/useProductReferenceData';
import { formatDateTime, formatMoney } from '@/lib/format';
import { getDiscount, getDiscountUsage, listDiscounts } from '@/lib/discounts/api';
import { TAB_META, TYPE_LABEL, describeRule, liveStatus, promotionUrls, scheduleLabel, tabOf } from '@/lib/discounts/describe';
import { explainAction, explainCondition, referencedProductIds, type NameLookup } from '@/lib/discounts/explain';
import type { CustomCondition, DiscountRule, DiscountUsage } from '@/lib/discounts/types';
import type { PaymentStatus } from '@/lib/orders/types';
import { ApiError } from '@/lib/products/api';
import { categoryPath } from '@/lib/products/form';
import { orderUrls, productUrls } from '@/lib/products/urls';
import { cn } from '@/lib/utils';
import { navigate } from '@/lib/router';

function Tile({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-lg border bg-background p-3.5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn('size-1.5 rounded-full', accent)} aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function allProductIds(rule: DiscountRule): string[] {
  return [
    ...(rule.targetProductIds ?? []),
    ...(rule.buyXGetY?.buyTargetType !== 'Category' ? rule.buyXGetY?.buyTargetIds ?? [] : []),
    ...(rule.buyXGetY?.rewardTargetType !== 'Category' ? rule.buyXGetY?.rewardTargetIds ?? [] : []),
    ...(rule.spendXGetY?.rewardTargetIds ?? []),
    ...referencedProductIds(rule.customConfig?.conditionTree, rule.customConfig?.actions),
  ].map(String);
}

function ConditionList({ node, names, depth = 0 }: { node?: CustomCondition; names: NameLookup; depth?: number }) {
  const items = node?.conditions ?? [];
  if (!items.length) return <p className="text-[13px] text-muted-foreground">Always (no conditions).</p>;
  return (
    <div className={cn('space-y-1.5', depth > 0 && 'border-l-2 pl-3')}>
      <p className="text-xs font-medium text-muted-foreground">{node?.operator === 'OR' ? 'Any of these' : 'All of these'}</p>
      <ul className="space-y-1.5">
        {items.map((c, i) => (
          <li key={i} className="text-[13px]">
            {c.operator === 'AND' || c.operator === 'OR' ? <ConditionList node={c} names={names} depth={depth + 1} /> : <span className="inline-block rounded-md bg-muted/60 px-2 py-1">{explainCondition(c, names)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PromotionDetail() {
  const id = React.useSyncExternalStore(() => () => {}, () => new URLSearchParams(window.location.search).get('id') ?? '', () => null);
  const [rule, setRule] = React.useState<DiscountRule | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [usage, setUsage] = React.useState<DiscountUsage | null>(null);
  const [children, setChildren] = React.useState<DiscountRule[]>([]);
  const [attempt, setAttempt] = React.useState(0);
  const { categories } = useProductReferenceData();
  const products = useProductsById(rule ? allProductIds(rule) : []);

  React.useEffect(() => {
    if (!id) return;
    let active = true;
    getDiscount(id)
      .then((r) => {
        if (!active) return;
        setRule(r);
        setError(null);
        if (r.type === 'campaign') listDiscounts().then((all) => active && setChildren(all.filter((x) => (r.campaign?.childRuleIds ?? []).map(String).includes(x._id)))).catch(() => {});
      })
      .catch((err) => active && setError(err));
    getDiscountUsage(id).then((u) => active && setUsage(u)).catch(() => {});
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const { menuFor, dialog, toggle, busyId } = useDiscountActions({
    onUpdated: (r) => setRule((prev) => (prev ? { ...prev, ...r } : r)),
    onRemoved: (r, archived) => {
      toast.flash(archived ? 'Archived (used by past orders)' : 'Deleted', r.name);
      navigate(promotionUrls.list(tabOf(r)));
    },
  });

  if (!rule) {
    const notFound = id === '' || (error instanceof ApiError && (error.status === 404 || error.status === 400));
    return (
      <div className="space-y-5">
        <AdminPageHeader breadcrumbs={[{ label: 'Promotions', href: promotionUrls.overview() }, { label: error || id === '' ? 'Discount' : 'Loading…' }]} />
        {error || id === '' ? (
          <div className="rounded-lg border bg-card">
            {notFound ? (
              <EmptyState icon={Tag01Icon} title="Discount not found" description="It may have been deleted." action={<a href={promotionUrls.overview()} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md')}>Back to promotions</a>} />
            ) : (
              <ErrorState message={error?.message ?? 'Could not load.'} onRetry={() => setAttempt((n) => n + 1)} />
            )}
          </div>
        ) : (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  const tab = tabOf(rule);
  const names: NameLookup = {
    product: (pid) => products[pid]?.name ?? 'Product',
    category: (cid) => categoryPath(cid, categories) || 'Category',
  };
  const productNames = (ids: string[], type?: string) => (type === 'Category' ? ids.map(names.category).join(', ') : ids.map(names.product).join(', '));
  const status = liveStatus(rule);
  const productLinks = (ids?: string[]) =>
    ids?.length ? (
      <span className="flex flex-wrap gap-1.5">
        {ids.map((pid) => (
          <a key={pid} href={productUrls.detail(pid)} className="rounded border bg-muted/40 px-1.5 py-0.5 text-xs hover:underline">
            {names.product(String(pid))}
          </a>
        ))}
      </span>
    ) : (
      <Muted>Whole order</Muted>
    );
  const targetText = (type?: string, ids?: string[]) => (type === 'EntireStore' || !type ? 'Anything in the store' : type === 'Category' ? (ids ?? []).map(names.category).join(', ') || '—' : null);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={[{ label: 'Promotions', href: promotionUrls.overview() }, { label: TAB_META[tab].label, href: promotionUrls.list(tab) }, { label: rule.name }]}
        actions={
          <a href={promotionUrls.edit(rule)} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md')}>
            <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} data-icon="inline-start" />
            Edit
          </a>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-lg border bg-card shadow-xs">
            <div className="flex flex-wrap items-start gap-3 px-5 py-4">
              <TabIcon tab={tab} className="size-10" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{rule.name}</h3>
                  <DiscountStatusBadge rule={rule} />
                  {rule.code && <CodeChip code={rule.code} />}
                  {rule.stackingPolicy === 'exclusive' && <span className="rounded bg-zinc-900 px-1.5 py-px text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Exclusive</span>}
                </div>
                <p className="mt-1 text-[13px] text-muted-foreground">{describeRule(rule, productNames)}</p>
              </div>
              <div className="flex items-center gap-2">
                {(rule.status === 'Active' || rule.status === 'Paused' || rule.status === 'Draft') && (
                  <Button variant={rule.status === 'Active' ? 'outline' : 'default'} size="sm" className="rounded-md" disabled={busyId === rule._id} onClick={() => toggle(rule)}>
                    <HugeiconsIcon icon={rule.status === 'Active' ? PauseIcon : PlayIcon} strokeWidth={2} data-icon="inline-start" />
                    {rule.status === 'Active' ? 'Pause' : 'Activate'}
                  </Button>
                )}
                <ActionMenu groups={menuFor(rule)} label="Discount actions" />
              </div>
            </div>
            {status !== 'Active' && status !== rule.status && (
              <p className="border-t bg-muted/30 px-5 py-2 text-xs text-muted-foreground">
                {status === 'Scheduled' && `Turns on ${rule.startDate ? formatDateTime(rule.startDate) : ''}.`}
                {status === 'Expired' && `Ended ${rule.endDate ? formatDateTime(rule.endDate) : ''}. Extend the end date to use it again.`}
                {status === 'Limit reached' && 'All uses are taken. Raise the usage limit to use it again.'}
              </p>
            )}
          </section>

          <SectionCard title="Performance" description="From orders that used this discount. Cancelled orders are not counted.">
            <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
              <Tile label="Uses" accent="bg-sky-500" value={rule.type === 'campaign' ? usage?.orderCount ?? '—' : <UsageMeter rule={rule} className="text-lg" />} />
              <Tile label="Discount given" accent="bg-violet-500" value={usage ? formatMoney(usage.totalDiscount) : '—'} />
              <Tile label="Revenue" accent="bg-emerald-500" value={usage ? formatMoney(usage.revenue) : '—'} sub="Order totals" />
              <Tile label="Orders" accent="bg-amber-500" value={usage ? usage.orderCount : '—'} sub={usage?.cancelledOrderCount ? `${usage.cancelledOrderCount} cancelled` : undefined} />
            </div>
            {usage && usage.recentOrders.length > 0 ? (
              <div className="overflow-x-auto border-t">
                <table className="w-full min-w-[520px] text-[13px]">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-5 py-2 font-medium">Order</th>
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">Payment</th>
                      <th className="px-3 py-2 text-right font-medium">Discount</th>
                      <th className="px-5 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {usage.recentOrders.map((o) => (
                      <tr key={o._id}>
                        <td className="px-5 py-2.5">
                          <a href={orderUrls.detail(o._id)} className="font-medium hover:underline">#{o.orderNumber}</a>
                          <span className="block text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                        </td>
                        <td className="px-3 py-2.5">{o.customerName ?? '—'}</td>
                        <td className="px-3 py-2.5">{o.status === 'Cancelled' ? <span className="text-xs text-muted-foreground">Cancelled</span> : <PaymentBadge status={o.paymentStatus as PaymentStatus} />}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-violet-700 dark:text-violet-300">−{formatMoney(o.discount)}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{formatMoney(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              usage && <p className="border-t px-5 py-4 text-[13px] text-muted-foreground">No orders have used this discount yet.</p>
            )}
          </SectionCard>

          <SectionCard title="Configuration">
            <dl className="divide-y">
              <SectionRow label="Type">{TYPE_LABEL[rule.type] ?? rule.type}</SectionRow>
              {(rule.type === 'percentage' || rule.type === 'fixed_amount') && (
                <>
                  <SectionRow label="Value">{rule.type === 'percentage' ? `${rule.value ?? 0}%` : formatMoney(rule.value ?? 0)}</SectionRow>
                  <SectionRow label="Applies to">{productLinks(rule.targetProductIds)}</SectionRow>
                </>
              )}
              {rule.type === 'buy_x_get_y' && (
                <>
                  <SectionRow label="Customer buys">
                    {rule.buyXGetY?.buyQuantity ?? 1} × {targetText(rule.buyXGetY?.buyTargetType, rule.buyXGetY?.buyTargetIds) ?? productLinks(rule.buyXGetY?.buyTargetIds)}
                  </SectionRow>
                  <SectionRow label="Customer gets">
                    {rule.buyXGetY?.rewardQuantity ?? 1} × {targetText(rule.buyXGetY?.rewardTargetType, rule.buyXGetY?.rewardTargetIds) ?? productLinks(rule.buyXGetY?.rewardTargetIds)}
                  </SectionRow>
                  <SectionRow label="At">
                    {rule.buyXGetY?.rewardType === 'PercentageOff' ? `${rule.buyXGetY.rewardValue}% off` : rule.buyXGetY?.rewardType === 'FixedAmountOff' ? `${formatMoney(rule.buyXGetY.rewardValue ?? 0)} off` : 'Free'}
                  </SectionRow>
                  <SectionRow label="Repeats">{rule.buyXGetY?.repeat ? 'Yes, for every qualifying set' : 'Once per order'}</SectionRow>
                </>
              )}
              {rule.type === 'spend_x_get_y' && (
                <>
                  <SectionRow label="Minimum spend">{formatMoney(rule.spendXGetY?.minSpend ?? 0)}</SectionRow>
                  <SectionRow label="Reward">
                    {rule.spendXGetY?.rewardType === 'FreeProduct' ? productLinks(rule.spendXGetY.rewardTargetIds) : rule.spendXGetY?.rewardType === 'Percentage' ? `${rule.spendXGetY.rewardValue}% off` : `${formatMoney(rule.spendXGetY?.rewardValue ?? 0)} off`}
                  </SectionRow>
                  <SectionRow label="Reward cap">{rule.spendXGetY?.maxDiscount ? formatMoney(rule.spendXGetY.maxDiscount) : <Muted>None</Muted>}</SectionRow>
                  <SectionRow label="Repeats">{rule.spendXGetY?.repeat ? 'Yes, for each multiple' : 'No'}</SectionRow>
                  <SectionRow label="Counts spend on">{productLinks(rule.targetProductIds)}</SectionRow>
                </>
              )}
              {rule.type === 'campaign' && (
                <>
                  <SectionRow label="Storefront heading">{rule.campaign?.marketingHeading || <Muted />}</SectionRow>
                  <SectionRow label="Description">{rule.campaign?.description || <Muted />}</SectionRow>
                  <SectionRow label="On storefront">{rule.campaign?.storefrontDisplay ? 'Shown' : 'Hidden'}</SectionRow>
                  <SectionRow label="Included discounts">
                    {children.length ? (
                      <ul className="space-y-1.5">
                        {children.map((c) => (
                          <li key={c._id} className="flex items-center gap-2">
                            <TabIcon tab={tabOf(c)} className="size-5" />
                            <a href={promotionUrls.detail(c._id)} className="truncate hover:underline">{c.name}</a>
                            <DiscountStatusBadge rule={c} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Muted>{(rule.campaign?.childRuleIds?.length ?? 0) > 0 ? 'Loading…' : 'None'}</Muted>
                    )}
                  </SectionRow>
                </>
              )}
              {rule.type === 'custom' && (
                <>
                  <SectionRow label="When">
                    <ConditionList node={rule.customConfig?.conditionTree} names={names} />
                  </SectionRow>
                  <SectionRow label="Then">
                    <ul className="space-y-1.5">
                      {(rule.customConfig?.actions ?? []).map((a, i) => (
                        <li key={i}><span className="inline-block rounded-md bg-amber-50 px-2 py-1 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">{explainAction(a, names)}</span></li>
                      ))}
                    </ul>
                  </SectionRow>
                  <SectionRow label="Applies">{rule.code ? 'When the code is entered' : 'Automatically when conditions match'}</SectionRow>
                </>
              )}
            </dl>
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Schedule & limits">
            <dl className="divide-y">
              <SectionRow label="Runs">{scheduleLabel(rule)}</SectionRow>
              {rule.type !== 'campaign' && <SectionRow label="Usage limit">{rule.usageLimit ? rule.usageLimit.toLocaleString('en-IN') : <Muted>Unlimited</Muted>}</SectionRow>}
              <SectionRow label="Min. subtotal">{rule.minSubtotal ? formatMoney(rule.minSubtotal) : <Muted>None</Muted>}</SectionRow>
            </dl>
          </SectionCard>
          {rule.type !== 'campaign' && (
            <SectionCard title="Stacking">
              <dl className="divide-y">
                <SectionRow label="Combines">{rule.stackingPolicy === 'exclusive' ? 'No (exclusive)' : 'With other discounts'}</SectionRow>
                <SectionRow label="Priority">{rule.priority ?? 0}</SectionRow>
                <SectionRow label="Max. discount">{rule.maxDiscountAmount ? formatMoney(rule.maxDiscountAmount) : <Muted>No cap</Muted>}</SectionRow>
              </dl>
            </SectionCard>
          )}
          <SectionCard title="Details">
            <dl className="divide-y">
              <SectionRow label="Kind">{TAB_META[tab].label}</SectionRow>
              <SectionRow label="Created">{formatDateTime(rule.createdAt)}</SectionRow>
              <SectionRow label="Updated">{formatDateTime(rule.updatedAt)}</SectionRow>
            </dl>
          </SectionCard>
        </div>
      </div>
      {dialog}
    </div>
  );
}

export default function PromotionDetailPage() {
  return (
    <AdminToaster>
      <Suspense fallback={null}>
        <PromotionDetail />
      </Suspense>
    </AdminToaster>
  );
}
