'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { ErrorState } from '@/components/admin/StateViews';
import { AdminToaster } from '@/components/admin/toast';
import { CodeChip, DiscountStatusBadge, TAB_ACCENT, TabIcon } from '@/components/discounts/PromotionBits';
import { formatDate, formatMoney } from '@/lib/format';
import { listDiscounts } from '@/lib/discounts/api';
import { TAB_META, describeRule, liveStatus, promotionUrls, tabOf, type PromotionTab } from '@/lib/discounts/describe';
import type { DiscountRule } from '@/lib/discounts/types';
import { cn } from '@/lib/utils';
import { navigate } from '@/lib/router';

const TABS: PromotionTab[] = ['automatic', 'coupons', 'campaigns', 'custom'];
const DAY = 86400000;

function PromotionsOverview() {
  // Rules plus the moment they were loaded, so live statuses and the 14-day window use one consistent "now".
  const [data, setData] = React.useState<{ rules: DiscountRule[]; at: number } | null>(null);
  const rules = data?.rules ?? null;
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [discountGiven, setDiscountGiven] = React.useState<number | null>(null);

  React.useEffect(() => {
    let active = true;
    listDiscounts()
      .then((r) => active && (setData({ rules: r, at: Date.now() }), setError(null)))
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Could not load promotions.'));
    fetch('/api/plugins/ecommerce-plugin/dashboard/stats?days=30', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => active && d.success && setDiscountGiven(d.stats.sales.discountGiven))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [attempt]);

  const now = new Date(data?.at ?? 0);
  const all = rules ?? [];
  const live = all.filter((r) => liveStatus(r, now) === 'Active');
  const endingSoon = live
    .filter((r) => r.endDate && new Date(r.endDate).getTime() - now.getTime() < 14 * DAY)
    .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())
    .slice(0, 5);
  const recent = [...all].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()).slice(0, 5);

  const createMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" className="rounded-md" />}>
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
        Create
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-lg">
        {TABS.map((t) => (
          <DropdownMenuItem key={t} className="items-start gap-2.5 rounded-md py-2" onClick={() => navigate(promotionUrls.create(t))}>
            <TabIcon tab={t} className="size-7" />
            <span>
              <span className="block text-[13px] font-medium capitalize">{TAB_META[t].singular}</span>
              <span className="block text-xs text-muted-foreground">{TAB_META[t].description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader breadcrumbs={[{ label: 'Promotions' }]} title="Promotions" description="Discounts, coupons, campaigns and custom rules, all priced by your discount engine." actions={createMenu} />

      {error ? (
        <div className="rounded-lg border bg-card"><ErrorState message={error} onRetry={() => setAttempt((n) => n + 1)} /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Live now', value: rules ? live.length : null, sub: rules ? `of ${all.length} promotions` : '', dot: 'bg-emerald-500' },
              { label: 'Discount given · 30 days', value: discountGiven === null ? null : formatMoney(discountGiven), sub: 'Across all orders', dot: 'bg-violet-500' },
              { label: 'Ending in 14 days', value: rules ? endingSoon.length : null, sub: endingSoon.length ? 'Check the list below' : 'Nothing expiring soon', dot: 'bg-amber-500' },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border bg-card p-4 shadow-xs">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn('size-1.5 rounded-full', k.dot)} />{k.label}</p>
                {k.value === null ? <Skeleton className="mt-2 h-6 w-20 rounded" /> : <p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TABS.map((t) => {
              const mine = all.filter((r) => tabOf(r) === t);
              const counts = { live: mine.filter((r) => liveStatus(r, now) === 'Active').length, scheduled: mine.filter((r) => liveStatus(r, now) === 'Scheduled').length, paused: mine.filter((r) => r.status === 'Paused' || r.status === 'Draft').length };
              return (
                <a key={t} href={promotionUrls.list(t)} className="group rounded-lg border bg-card p-4 shadow-xs transition-all hover:-translate-y-px hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <TabIcon tab={t} className="size-9" />
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-3 text-sm font-semibold">{TAB_META[t].label}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{TAB_META[t].description}</p>
                  {rules ? (
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                      <span className={cn('rounded px-1.5 py-0.5 font-medium', TAB_ACCENT[t].chip)}>{mine.length} total</span>
                      {counts.live > 0 && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{counts.live} live</span>}
                      {counts.scheduled > 0 && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">{counts.scheduled} scheduled</span>}
                      {counts.paused > 0 && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-300">{counts.paused} paused/draft</span>}
                    </div>
                  ) : (
                    <Skeleton className="mt-3 h-4 w-28 rounded" />
                  )}
                </a>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard title="Ending soon" description="Live promotions that expire in the next 14 days.">
              {!rules ? (
                <div className="space-y-2 p-5"><Skeleton className="h-5 rounded" /><Skeleton className="h-5 rounded" /></div>
              ) : endingSoon.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-muted-foreground">Nothing is expiring soon.</p>
              ) : (
                <ul className="divide-y">
                  {endingSoon.map((r) => (
                    <PromoRow key={r._id} rule={r} meta={<span className="text-amber-700 dark:text-amber-300">Ends {formatDate(r.endDate)}</span>} />
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Recently added">
              {!rules ? (
                <div className="space-y-2 p-5"><Skeleton className="h-5 rounded" /><Skeleton className="h-5 rounded" /></div>
              ) : recent.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-muted-foreground">No promotions yet. Use Create to add your first one.</p>
              ) : (
                <ul className="divide-y">
                  {recent.map((r) => (
                    <PromoRow key={r._id} rule={r} meta={<DiscountStatusBadge rule={r} />} />
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}

function PromoRow({ rule, meta }: { rule: DiscountRule; meta: React.ReactNode }) {
  return (
    <li>
      <a href={promotionUrls.detail(rule._id)} className="flex items-center gap-3 px-5 py-2.5 text-[13px] hover:bg-muted/40">
        <TabIcon tab={tabOf(rule)} className="size-7" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium">{rule.name}</span>
            {rule.code && <CodeChip code={rule.code} />}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{describeRule(rule)}</span>
        </span>
        <span className="shrink-0 text-xs">{meta}</span>
      </a>
    </li>
  );
}

export default function PromotionsPage() {
  return (
    <AdminToaster>
      <PromotionsOverview />
    </AdminToaster>
  );
}
