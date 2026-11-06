'use client';

import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, PercentSquareIcon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Muted, SectionCard, SectionRow } from '@/components/admin/SectionCard';
import { SidePanel } from '@/components/admin/SidePanel';
import { EmptyState, ErrorState, InlineError } from '@/components/admin/StateViews';
import { PincodeHint } from '@/components/admin/CityPicker';
import { AffixInput, CheckboxField, Field, SelectField, TextArea, TextInput } from '@/components/admin/fields';
import { AdminToaster, toast } from '@/components/admin/toast';
import { ActiveBadge, OnOff, PanelButtons, useLoader } from '@/components/settings/SettingsBits';
import { formatMoney } from '@/lib/format';
import { usePincodeLookup } from '@/lib/geo';
import { settingsUrls } from '@/lib/products/urls';
import { fieldErrorsOf } from '@/lib/request';
import { navigate } from '@/lib/router';
import {
  INDIAN_STATES,
  classIdOf,
  createTaxClass,
  ensureTaxSetup,
  getCoreSettings,
  listTaxClasses,
  listTaxRules,
  previewTax,
  saveCoreSettings,
  scopeLabel,
  totalRate,
  type CoreSettings,
  type TaxClass,
  type TaxPreview,
  type TaxRule,
} from '@/lib/settings';

type TaxData = { settings: CoreSettings; classes: TaxClass[]; productCounts: Record<string, number>; rules: TaxRule[] };

async function loadTax(): Promise<TaxData> {
  await ensureTaxSetup();
  const [settings, classes, rules] = await Promise.all([getCoreSettings(), listTaxClasses(), listTaxRules()]);
  return { settings, classes: classes.classes, productCounts: classes.productCounts, rules };
}

const NON_TAXABLE = 'NonTaxable';
type TaxSettingsDraft = Pick<CoreSettings, 'taxesEnabled' | 'pricesIncludeTax' | 'taxShippingByDefault' | 'displayTaxBreakdown'> & { defaultTaxClassId: string };

function TaxSettingsPanel({ open, settings, classes, onClose, onSaved }: { open: boolean; settings: CoreSettings; classes: TaxClass[]; onClose: () => void; onSaved: (s: CoreSettings) => void }) {
  const [draft, setDraft] = React.useState<TaxSettingsDraft>({
    taxesEnabled: settings.taxesEnabled !== false,
    pricesIncludeTax: settings.pricesIncludeTax === true,
    taxShippingByDefault: settings.taxShippingByDefault === true,
    displayTaxBreakdown: settings.displayTaxBreakdown !== false,
    defaultTaxClassId: settings.defaultTaxClassId || NON_TAXABLE,
  });
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const set = (patch: Partial<TaxSettingsDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    try {
      onSaved(await saveCoreSettings(draft));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const classOptions = [
    { value: NON_TAXABLE, label: 'Not taxable' },
    ...classes.filter((c) => c.status === 'Active' || c._id === draft.defaultTaxClassId).map((c) => ({ value: c._id, label: c.name })),
  ];

  return (
    <SidePanel open={open} onOpenChange={(o) => !o && !saving && onClose()} title="Edit tax settings" onSubmit={submit} footer={<PanelButtons onCancel={onClose} saving={saving} />}>
      <div className="space-y-5">
        {formError && <InlineError message={formError} />}
        <CheckboxField id="taxes-enabled" checked={draft.taxesEnabled} onChange={(taxesEnabled) => set({ taxesEnabled })} label="Charge tax" hint="Turn off to stop charging tax on every order." />
        <Field id="prices-include" label="Product prices">
          <SelectField
            id="prices-include"
            value={draft.pricesIncludeTax ? 'yes' : 'no'}
            options={[
              { value: 'no', label: 'Exclude tax (tax is added at checkout)' },
              { value: 'yes', label: 'Include tax (tax is part of the price)' },
            ]}
            onChange={(v) => set({ pricesIncludeTax: v === 'yes' })}
          />
        </Field>
        <Field id="default-class" label="Default tax category" hint="Used for products set to “Default”.">
          <SelectField id="default-class" value={draft.defaultTaxClassId} options={classOptions} onChange={(v) => set({ defaultTaxClassId: v || NON_TAXABLE })} />
        </Field>
        <CheckboxField id="tax-shipping" checked={draft.taxShippingByDefault} onChange={(taxShippingByDefault) => set({ taxShippingByDefault })} label="Charge tax on shipping" hint="A rate can override this for its own region." />
        <CheckboxField id="tax-breakdown" checked={draft.displayTaxBreakdown} onChange={(displayTaxBreakdown) => set({ displayTaxBreakdown })} label="Show tax breakdown" hint="List each component (CGST, SGST…) in the cart and on orders." />
      </div>
    </SidePanel>
  );
}

function NewCategoryPanel({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (c: TaxClass) => void }) {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    if (!name.trim()) return setError('Enter a name.');
    setSaving(true);
    setError(null);
    try {
      onSaved(await createTaxClass({ name: name.trim(), description: description.trim() }));
    } catch (err) {
      setError(fieldErrorsOf(err)?.name ?? (err instanceof Error ? err.message : 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title="New tax category"
      description="Group products that are taxed the same way, e.g. “Clothing under ₹1000”."
      onSubmit={submit}
      footer={<PanelButtons onCancel={onClose} saving={saving} saveLabel="Create" />}
    >
      <div className="space-y-4">
        <Field id="class-name" label="Name" error={error ?? undefined}>
          <TextInput id="class-name" value={name} error={error ?? undefined} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field id="class-description" label="Description" optional>
          <TextArea id="class-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </SidePanel>
  );
}

function TaxChecker({ classes, defaultClassId }: { classes: TaxClass[]; defaultClassId?: string }) {
  const active = classes.filter((c) => c.status === 'Active');
  const [classId, setClassId] = React.useState(defaultClassId && defaultClassId !== NON_TAXABLE ? defaultClassId : active[0]?._id ?? '');
  const [state, setState] = React.useState('Gujarat');
  const [postalCode, setPostalCode] = React.useState('');
  // Typing a PIN picks its state, like every other address form.
  const pinLookup = usePincodeLookup(postalCode, (place) => place.state && setState(place.state));
  const stateOptions = (INDIAN_STATES.includes(state) ? INDIAN_STATES : [state, ...INDIAN_STATES]).map((s) => ({ value: s, label: s }));
  const [amount, setAmount] = React.useState('1000');
  const [result, setResult] = React.useState<{ preview: TaxPreview | null; error: string | null } | null>(null);
  const [checking, setChecking] = React.useState(false);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    try {
      setResult({ preview: await previewTax({ taxClassId: classId, country: 'India', state, postalCode: postalCode.trim(), amount: Number(amount) || 0 }), error: null });
    } catch (err) {
      setResult({ preview: null, error: err instanceof Error ? err.message : 'Could not check.' });
    } finally {
      setChecking(false);
    }
  };

  const p = result?.preview;
  return (
    <SectionCard title="Check a rate" description="See which rate an order gets, using the same rules as checkout.">
      <form onSubmit={check} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] sm:items-end">
        <Field id="check-class" label="Category">
          <SelectField id="check-class" value={classId} options={active.map((c) => ({ value: c._id, label: c.name }))} onChange={setClassId} />
        </Field>
        <Field id="check-state" label="Ship to state">
          <SelectField id="check-state" value={state} options={stateOptions} onChange={setState} />
        </Field>
        <Field id="check-pin" label="PIN" optional hint={<PincodeHint lookup={pinLookup} />}>
          <TextInput id="check-pin" inputMode="numeric" maxLength={6} value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field id="check-amount" label="Amount">
          <AffixInput id="check-amount" prefix="₹" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
        </Field>
        <Button type="submit" size="sm" className="rounded-md" disabled={checking || !classId}>
          {checking ? 'Checking…' : 'Check'}
        </Button>
      </form>
      {result && (
        <div className="border-t px-5 py-3 text-[13px]" aria-live="polite">
          {result.error ? (
            <InlineError message={result.error} />
          ) : !p ? null : !p.taxesEnabled ? (
            <p className="text-muted-foreground">Taxes are turned off, so no tax is charged.</p>
          ) : !p.rule ? (
            <p className="text-amber-700 dark:text-amber-300">No rate matches. Orders like this are not taxed, and checkout reports a missing rate.</p>
          ) : (
            <p>
              <span className="font-medium">{p.rule.name}</span> for {scopeLabel(p.rule)}: {p.rule.components.map((c) => `${c.label} ${c.rate}%`).join(' + ')}
              {' → '}
              <span className="font-semibold tabular-nums">{formatMoney(p.tax)}</span> tax on {formatMoney(p.amount)}
              <span className="text-muted-foreground"> ({p.pricesIncludeTax ? 'included in the price' : 'added on top'})</span>
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function TaxSettings() {
  const { data, error, reload, setData } = useLoader(loadTax);
  const [panel, setPanel] = React.useState<'settings' | 'category' | null>(null);
  const [panelKey, setPanelKey] = React.useState(0);
  const [showInactive, setShowInactive] = React.useState(false);
  const crumbs = [{ label: 'Settings', href: settingsUrls.overview() }, { label: 'Tax' }];
  const open = (p: 'settings' | 'category') => {
    setPanelKey((k) => k + 1);
    setPanel(p);
  };

  if (!data) {
    return (
      <div className="space-y-5">
        <AdminPageHeader breadcrumbs={crumbs} title="Tax" description="How tax is calculated on your orders." />
        {error ? (
          <div className="rounded-lg border bg-card">
            <ErrorState message={error.message} onRetry={reload} />
          </div>
        ) : (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-56 rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  const { settings, classes, rules, productCounts } = data;
  const defaultClass = classes.find((c) => c._id === settings.defaultTaxClassId);
  const shownClasses = classes.filter((c) => showInactive || c.status === 'Active');
  const inactiveCount = classes.length - classes.filter((c) => c.status === 'Active').length;
  const ratesFor = (id: string) => rules.filter((r) => classIdOf(r) === id && r.status === 'Active');

  return (
    <div className="space-y-5">
      <AdminPageHeader
        breadcrumbs={crumbs}
        title="Tax"
        description="How tax is calculated on your orders."
        actions={
          <Button size="sm" className="rounded-md" onClick={() => open('category')}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            New category
          </Button>
        }
      />

      <SectionCard
        title="Tax settings"
        actions={
          <Button variant="outline" size="sm" className="rounded-md" onClick={() => open('settings')}>
            Edit
          </Button>
        }
      >
        <dl className="divide-y">
          <SectionRow label="Charge tax">
            <OnOff on={settings.taxesEnabled !== false} />
          </SectionRow>
          <SectionRow label="Product prices">{settings.pricesIncludeTax ? 'Include tax' : 'Exclude tax, added at checkout'}</SectionRow>
          <SectionRow label="Default category">{defaultClass ? defaultClass.name : 'Not taxable'}</SectionRow>
          <SectionRow label="Tax on shipping">
            <OnOff on={settings.taxShippingByDefault === true} onLabel="Charged" offLabel="Not charged" />
          </SectionRow>
          <SectionRow label="Tax breakdown">{settings.displayTaxBreakdown !== false ? 'Shown (CGST, SGST…)' : 'Hidden, total only'}</SectionRow>
        </dl>
      </SectionCard>

      <SectionCard
        title="Tax categories"
        description="Each product belongs to one category; the category's rates decide its tax."
        actions={
          inactiveCount > 0 ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-foreground" />
              Show inactive ({inactiveCount})
            </label>
          ) : undefined
        }
      >
        {shownClasses.length === 0 ? (
          <EmptyState icon={PercentSquareIcon} title="No tax categories" action={<Button size="sm" className="rounded-md" onClick={() => open('category')}>New category</Button>} />
        ) : (
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 pl-5 text-xs font-medium text-muted-foreground">Category</TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">Rates</TableHead>
                <TableHead className="h-9 text-right text-xs font-medium text-muted-foreground">Products</TableHead>
                <TableHead className="h-9 pr-5 text-xs font-medium text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shownClasses.map((c) => {
                const rates = ratesFor(c._id);
                const isDefault = c._id === settings.defaultTaxClassId;
                const products = (productCounts[c._id] ?? 0) + (isDefault ? productCounts.Default ?? 0 : 0);
                const totals = [...new Set(rates.map((r) => totalRate(r.components)))].sort((a, b) => a - b);
                return (
                  <TableRow
                    key={c._id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('a,button')) return;
                      navigate(settingsUrls.taxClass(c._id));
                    }}
                  >
                    <TableCell className="py-2.5 pl-5">
                      <a href={settingsUrls.taxClass(c._id)} className="font-medium hover:underline">
                        {c.name}
                      </a>
                      {isDefault && <span className="ml-2 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">Default</span>}
                      {c.description && <span className="block max-w-md truncate text-xs text-muted-foreground">{c.description}</span>}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {rates.length === 0 ? (
                        <span className="text-amber-700 dark:text-amber-300">No rates</span>
                      ) : (
                        <>
                          {totals.map((t) => `${t}%`).join(', ')}
                          <span className="block text-xs text-muted-foreground">
                            {rates.length} region{rates.length === 1 ? '' : 's'}
                          </span>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-right tabular-nums">{products || <Muted>0</Muted>}</TableCell>
                    <TableCell className="py-2.5 pr-5">
                      <ActiveBadge status={c.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <TaxChecker classes={classes} defaultClassId={settings.defaultTaxClassId} />

      <TaxSettingsPanel
        key={`s${panelKey}`}
        open={panel === 'settings'}
        settings={settings}
        classes={classes}
        onClose={() => setPanel(null)}
        onSaved={(saved) => {
          setData({ ...data, settings: saved });
          setPanel(null);
          toast.success('Tax settings saved');
        }}
      />
      <NewCategoryPanel
        key={`c${panelKey}`}
        open={panel === 'category'}
        onClose={() => setPanel(null)}
        onSaved={(created) => {
          toast.flash('Tax category created', 'Add its rates next.');
          navigate(settingsUrls.taxClass(created._id));
        }}
      />
    </div>
  );
}

export default function TaxSettingsPage() {
  return (
    <AdminToaster>
      <TaxSettings />
    </AdminToaster>
  );
}
