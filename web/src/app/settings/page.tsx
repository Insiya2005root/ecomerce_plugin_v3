'use client';

import * as React from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { ArrowRight01Icon, DeliveryTruck01Icon, Location01Icon, PercentSquareIcon, Store01Icon, UserCircleIcon } from '@hugeicons/core-free-icons';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ErrorState } from '@/components/admin/StateViews';
import { useLoader } from '@/components/settings/SettingsBits';
import { formatMoney } from '@/lib/format';
import { settingsUrls } from '@/lib/products/urls';
import { getSettingsOverview, type SettingsOverview } from '@/lib/settings';
import { cn } from '@/lib/utils';

type Card = { href: string; icon: IconSvgElement; tint: string; title: string; description: string; summary: (o: SettingsOverview) => string; warn?: (o: SettingsOverview) => string | null };

const CARDS: Card[] = [
  {
    href: settingsUrls.general(),
    icon: Store01Icon,
    tint: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    title: 'General',
    description: 'Store name, contact details, GSTIN and address',
    summary: (o) => [o.store.name || 'No store name yet', o.store.gstin && `GSTIN ${o.store.gstin}`, `Orders #${o.store.orderPrefix}…`].filter(Boolean).join(' · '),
    warn: (o) => (o.store.name ? null : 'Add your store name'),
  },
  {
    href: settingsUrls.profile(),
    icon: UserCircleIcon,
    tint: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
    title: 'Profile',
    description: 'Your details and preferences in this admin',
    summary: (o) => (o.profile ? o.profile.displayName || o.profile.email || 'Signed in' : 'Not signed in'),
  },
  {
    href: settingsUrls.tax(),
    icon: PercentSquareIcon,
    tint: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    title: 'Tax',
    description: 'Tax categories, GST rates by region and tax-inclusive pricing',
    summary: (o) =>
      o.tax.enabled
        ? `${o.tax.rules} active rate${o.tax.rules === 1 ? '' : 's'} in ${o.tax.classes} categor${o.tax.classes === 1 ? 'y' : 'ies'} · prices ${o.tax.pricesIncludeTax ? 'include' : 'exclude'} tax`
        : 'Taxes are turned off',
    warn: (o) => (o.tax.enabled && o.tax.rules === 0 ? 'No tax rates yet, so orders are not taxed' : null),
  },
  {
    href: settingsUrls.shipping(),
    icon: DeliveryTruck01Icon,
    tint: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    title: 'Shipping',
    description: 'How delivery is priced and when it is free',
    summary: (o) =>
      [
        o.shipping.method === 'Flat' ? `Flat ${formatMoney(o.shipping.rate)}` : `${formatMoney(o.shipping.ratePerKm)} per km`,
        o.shipping.freeShippingThreshold > 0 ? `free over ${formatMoney(o.shipping.freeShippingThreshold)}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    warn: (o) => (o.shipping.method === 'Distance' && o.locations.active === 0 ? 'Distance pricing needs an active location' : null),
  },
  {
    href: settingsUrls.locations(),
    icon: Location01Icon,
    tint: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    title: 'Locations',
    description: 'Stores and warehouses you ship from',
    summary: (o) => (o.locations.total ? `${o.locations.active} active of ${o.locations.total}` : 'No locations yet'),
  },
];

export default function SettingsOverviewPage() {
  const { data, error, reload } = useLoader(getSettingsOverview);

  return (
    <div className="space-y-5">
      <AdminPageHeader breadcrumbs={[{ label: 'Settings' }]} title="Settings" description="Manage your store details, taxes, shipping and locations." />
      {error && !data ? (
        <div className="rounded-lg border bg-card">
          <ErrorState message={error.message} onRetry={reload} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {CARDS.map((c) => {
            const warning = data ? c.warn?.(data) : null;
            return (
              <a key={c.title} href={c.href} className="group flex items-start gap-3 rounded-lg border bg-card p-4 shadow-xs transition-colors hover:bg-muted/30">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', c.tint)}>
                  <HugeiconsIcon icon={c.icon} strokeWidth={1.75} className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{c.title}</span>
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">{c.description}</span>
                  {data ? (
                    <span className="mt-2 block truncate text-xs text-foreground/80">{c.summary(data)}</span>
                  ) : (
                    <Skeleton className="mt-2 h-3 w-40 rounded" />
                  )}
                  {warning && <span className="mt-1 block text-xs font-medium text-amber-700 dark:text-amber-300">{warning}</span>}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
