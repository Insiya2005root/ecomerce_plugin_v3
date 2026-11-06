'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { DeliveryTruck01Icon, Route01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { SectionCard } from '@/components/admin/SectionCard';
import { ErrorState, InlineError } from '@/components/admin/StateViews';
import { AffixInput, Field, SelectField } from '@/components/admin/fields';
import { AdminToaster, toast } from '@/components/admin/toast';
import { useDirtyGuard } from '@/components/discounts/RuleSettingsFields';
import { ChoiceCard, useLoader } from '@/components/settings/SettingsBits';
import { promotionUrls } from '@/lib/discounts/describe';
import { formatMoney } from '@/lib/format';
import { settingsUrls } from '@/lib/products/urls';
import { fieldErrorsOf } from '@/lib/request';
import { getCoreSettings, hasCoordinates, listLocations, saveCoreSettings, type CoreSettings, type Location } from '@/lib/settings';

type Draft = {
  shippingMethod: CoreSettings['shippingMethod'];
  shippingRate: string;
  freeShippingThreshold: string;
  shippingRatePerKm: string;
  /** NEAREST, CUSTOMER (older setting, kept until changed) or a location id to always ship from. */
  shipFrom: string;
  distanceRounding: CoreSettings['distanceRounding'];
  fallbackShippingCost: string;
};
const NEAREST = 'nearest';
const CUSTOMER = 'customer';
const AMOUNTS = ['shippingRate', 'freeShippingThreshold', 'shippingRatePerKm', 'fallbackShippingCost'] as const;

const toDraft = (s: CoreSettings): Draft => ({
  shippingMethod: s.shippingMethod === 'Distance' ? 'Distance' : 'Flat',
  shippingRate: String(s.shippingRate ?? 0),
  freeShippingThreshold: String(s.freeShippingThreshold ?? 0),
  shippingRatePerKm: String(s.shippingRatePerKm ?? 0),
  shipFrom: s.shipFromLocationId || (s.locationSelection === 'CustomerSelect' ? CUSTOMER : NEAREST),
  distanceRounding: s.distanceRounding ?? 'Up',
  fallbackShippingCost: String(s.fallbackShippingCost ?? 0),
});

const ROUNDING_LABEL: Record<Draft['distanceRounding'], string> = { Up: 'Round up to the next km', Nearest: 'Round to the nearest km', Exact: 'Exact distance' };
const amountOf = (v: string) => Number(v) || 0;

function ShippingForm({ settings, locations, onSaved }: { settings: CoreSettings; locations: Location[]; onSaved: (s: CoreSettings) => void }) {
  const initial = React.useMemo(() => toDraft(settings), [settings]);
  const [draft, setDraft] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useDirtyGuard(dirty);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const amount = (key: (typeof AMOUNTS)[number]) => ({
    value: draft[key],
    error: errors[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [key]: e.target.value.replace(/[^\d.]/g, '') } as Partial<Draft>),
  });

  const usable = locations.filter((l) => l.status === 'Active' && hasCoordinates(l));
  const missingCoords = locations.filter((l) => l.status === 'Active' && !hasCoordinates(l));
  const threshold = amountOf(draft.freeShippingThreshold);
  const fixedStore = locations.find((l) => l._id === draft.shipFrom) ?? null;
  const fixedUsable = fixedStore ? fixedStore.status === 'Active' && hasCoordinates(fixedStore) : false;
  const shipFromOptions = [
    { value: NEAREST, label: 'Nearest location (automatic)' },
    ...locations.map((l) => ({
      value: l._id,
      label: `${l.name}${l.city ? ` — ${l.city}` : ''}${l.status !== 'Active' ? ' (inactive)' : !hasCoordinates(l) ? ' (not on map)' : ''}`,
    })),
    // Older stores may still use "customer chooses"; keep it visible until it is changed.
    ...(draft.shipFrom === CUSTOMER ? [{ value: CUSTOMER, label: 'Customer chooses a location (old setting)' }] : []),
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    for (const key of AMOUNTS) if (draft[key].trim() === '' || !Number.isFinite(Number(draft[key]))) found[key] = 'Enter an amount (0 or more).';
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setFormError(null);
    try {
      const saved = await saveCoreSettings({
        shippingMethod: draft.shippingMethod,
        locationSelection: draft.shipFrom === CUSTOMER ? 'CustomerSelect' : 'Nearest',
        shipFromLocationId: draft.shipFrom === NEAREST || draft.shipFrom === CUSTOMER ? '' : draft.shipFrom,
        distanceRounding: draft.distanceRounding,
        ...Object.fromEntries(AMOUNTS.map((k) => [k, Number(draft[k])])),
      });
      onSaved(saved);
      toast.success('Shipping settings saved');
    } catch (err) {
      const fields = fieldErrorsOf(err);
      setErrors(fields ?? {});
      if (!fields) setFormError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && <InlineError message={formError} />}

      <SectionCard title="How shipping is priced">
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          <ChoiceCard
            name="method"
            selected={draft.shippingMethod === 'Flat'}
            onSelect={() => set({ shippingMethod: 'Flat' })}
            icon={<HugeiconsIcon icon={DeliveryTruck01Icon} strokeWidth={1.75} className="size-4.5" />}
            title="Flat rate"
            description="Every order pays the same shipping charge."
          />
          <ChoiceCard
            name="method"
            selected={draft.shippingMethod === 'Distance'}
            onSelect={() => set({ shippingMethod: 'Distance' })}
            icon={<HugeiconsIcon icon={Route01Icon} strokeWidth={1.75} className="size-4.5" />}
            title="By distance"
            description="Charge per km of road distance from your store."
          />
        </div>

        <div className="border-t px-5 py-4">
          {draft.shippingMethod === 'Flat' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="flat-rate" label="Shipping charge" error={errors.shippingRate}>
                <AffixInput id="flat-rate" prefix="₹" {...amount('shippingRate')} />
              </Field>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="per-km" label="Charge per km" error={errors.shippingRatePerKm}>
                  <AffixInput id="per-km" prefix="₹" suffix="/km" {...amount('shippingRatePerKm')} />
                </Field>
                <Field id="rounding" label="Distance rounding">
                  <SelectField
                    id="rounding"
                    value={draft.distanceRounding}
                    options={(Object.keys(ROUNDING_LABEL) as Draft['distanceRounding'][]).map((v) => ({ value: v, label: ROUNDING_LABEL[v] }))}
                    onChange={(v) => set({ distanceRounding: (v || 'Up') as Draft['distanceRounding'] })}
                  />
                </Field>
                <Field
                  id="selection"
                  label="Ship from"
                  error={errors.shipFromLocationId}
                  hint={fixedStore ? 'Every delivery is measured from this store.' : 'Each delivery is measured from the closest active store.'}
                >
                  <SelectField id="selection" value={draft.shipFrom} options={shipFromOptions} error={errors.shipFromLocationId} onChange={(v) => set({ shipFrom: v || NEAREST })} />
                </Field>
                <Field id="fallback" label="If the distance can't be worked out" error={errors.fallbackShippingCost} hint="Charged when the address can't be found on the map.">
                  <AffixInput id="fallback" prefix="₹" {...amount('fallbackShippingCost')} />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                Example: a 12.3 km delivery is charged for{' '}
                {draft.distanceRounding === 'Up' ? '13 km' : draft.distanceRounding === 'Nearest' ? '12 km' : '12.3 km'} ={' '}
                <span className="font-medium text-foreground">
                  {formatMoney((draft.distanceRounding === 'Up' ? 13 : draft.distanceRounding === 'Nearest' ? 12 : 12.3) * amountOf(draft.shippingRatePerKm))}
                </span>
                .
              </p>
              {usable.length === 0 ? (
                <InlineError message="Distance pricing needs at least one active location with map coordinates. Until then every order pays the fallback charge." />
              ) : fixedStore ? (
                fixedUsable ? (
                  <p className="text-xs text-muted-foreground">
                    Shipping from {fixedStore.name} ({fixedStore.addressLine1}, {fixedStore.city}).{' '}
                    <a href={settingsUrls.location(fixedStore._id)} className="underline hover:text-foreground">
                      View store
                    </a>
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {fixedStore.name} is {fixedStore.status !== 'Active' ? 'inactive' : 'not on the map'}, so the nearest active store is used instead.{' '}
                    <a href={settingsUrls.location(fixedStore._id)} className="underline">
                      Fix it
                    </a>
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  Shipping from {usable.length} location{usable.length === 1 ? '' : 's'}: {usable.map((l) => l.name).join(', ')}.{' '}
                  <a href={settingsUrls.locations()} className="underline hover:text-foreground">
                    Manage locations
                  </a>
                </p>
              )}
              {missingCoords.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {missingCoords.map((l) => l.name).join(', ')} {missingCoords.length === 1 ? 'has' : 'have'} no map coordinates and can&apos;t be used for distance pricing.
                </p>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Free shipping">
        <div className="space-y-3 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="free-over" label="Free shipping on orders over" error={errors.freeShippingThreshold} hint="Set to 0 to turn off.">
              <AffixInput id="free-over" prefix="₹" {...amount('freeShippingThreshold')} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            {threshold > 0 ? `Orders of ${formatMoney(threshold)} or more ship free. ` : 'No order-value threshold. '}
            Free-shipping promotions also apply.{' '}
            <a href={promotionUrls.overview()} className="underline hover:text-foreground">
              View promotions
            </a>
          </p>
        </div>
      </SectionCard>

      {dirty && (
        <div className="sticky bottom-0 z-40 -mx-4 sm:-mx-6 lg:-mx-8 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="flex items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:px-8">
            <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-md"
              disabled={saving}
              onClick={() => {
                setDraft(initial);
                setErrors({});
              }}
            >
              Discard
            </Button>
            <Button type="submit" size="sm" className="rounded-md" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

async function loadShipping() {
  const [settings, locations] = await Promise.all([getCoreSettings(), listLocations()]);
  return { settings, locations };
}

function ShippingSettings() {
  const { data, error, reload, setData } = useLoader(loadShipping);
  const crumbs = [{ label: 'Settings', href: settingsUrls.overview() }, { label: 'Shipping' }];

  return (
    <div className="space-y-5">
      <AdminPageHeader breadcrumbs={crumbs} title="Shipping" description="How delivery is priced at checkout and in the Admin cart." />
      {!data ? (
        error ? (
          <div className="rounded-lg border bg-card">
            <ErrorState message={error.message} onRetry={reload} />
          </div>
        ) : (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        )
      ) : (
        <ShippingForm key={JSON.stringify(data.settings)} settings={data.settings} locations={data.locations} onSaved={(settings) => setData({ ...data, settings })} />
      )}
    </div>
  );
}

export default function ShippingSettingsPage() {
  return (
    <AdminToaster>
      <ShippingSettings />
    </AdminToaster>
  );
}
