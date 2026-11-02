'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Muted, SectionCard, SectionRow } from '@/components/admin/SectionCard';
import { SidePanel } from '@/components/admin/SidePanel';
import { ErrorState, InlineError } from '@/components/admin/StateViews';
import { AddressFields } from '@/components/admin/AddressFields';
import { Field, TextInput } from '@/components/admin/fields';
import { AdminToaster, toast } from '@/components/admin/toast';
import { PanelButtons, clearErrors, useLoader } from '@/components/settings/SettingsBits';
import { settingsUrls } from '@/lib/products/urls';
import { fieldErrorsOf } from '@/lib/request';
import { getStore, saveStore, type StoreSettings } from '@/lib/settings';

// The low-stock number is edited as text so a cleared field doesn't turn into 0.
type Draft = Omit<StoreSettings, 'lowStockThreshold'> & { lowStockThreshold: string };

type Section = 'details' | 'contact' | 'address' | 'orders';
const PANEL_TITLE: Record<Section, string> = {
  details: 'Edit store details',
  contact: 'Edit contact details',
  address: 'Edit store address',
  orders: 'Edit orders & inventory',
};

function EditStorePanel({ section, store, onClose, onSaved }: { section: Section | null; store: StoreSettings; onClose: () => void; onSaved: (s: StoreSettings) => void }) {
  const [draft, setDraft] = React.useState<Draft>({ ...store, lowStockThreshold: String(store.lowStockThreshold) });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => clearErrors(e, Object.keys(patch)));
  };
  const setAddress = (patch: Partial<StoreSettings['address']>) => setDraft((d) => ({ ...d, address: { ...d.address, ...patch } }));

  const submit = async () => {
    if (draft.lowStockThreshold === '') return setErrors({ lowStockThreshold: 'Enter a whole number from 0 to 10,000.' });
    setSaving(true);
    setFormError(null);
    try {
      const saved = await saveStore({ ...draft, lowStockThreshold: Number(draft.lowStockThreshold) });
      onSaved(saved);
    } catch (err) {
      const fields = fieldErrorsOf(err);
      setErrors(fields ?? {});
      if (!fields) setFormError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open={section !== null}
      onOpenChange={(open) => !open && !saving && onClose()}
      title={section ? PANEL_TITLE[section] : ''}
      onSubmit={submit}
      footer={<PanelButtons onCancel={onClose} saving={saving} />}
    >
      <div className="space-y-4">
        {formError && <InlineError message={formError} />}
        {section === 'details' && (
          <>
            <Field id="store-name" label="Store name" error={errors.name} hint="Shown on the storefront and on orders.">
              <TextInput id="store-name" value={draft.name} error={errors.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
            </Field>
            <Field id="legal-name" label="Legal business name" optional hint="As registered, for invoices.">
              <TextInput id="legal-name" value={draft.legalName} onChange={(e) => set({ legalName: e.target.value })} />
            </Field>
            <Field id="gstin" label="GSTIN" optional error={errors.gstin} hint="15 characters, like 27AAPFU0939F1ZV.">
              <TextInput id="gstin" value={draft.gstin} error={errors.gstin} maxLength={15} className="font-mono uppercase" onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} />
            </Field>
          </>
        )}
        {section === 'contact' && (
          <>
            <Field id="store-email" label="Support email" optional error={errors.email} hint="Customers see this on the storefront.">
              <TextInput id="store-email" type="email" value={draft.email} error={errors.email} onChange={(e) => set({ email: e.target.value })} autoFocus />
            </Field>
            <Field id="store-phone" label="Support phone" optional error={errors.phone}>
              <TextInput id="store-phone" type="tel" value={draft.phone} error={errors.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
          </>
        )}
        {section === 'address' && (
          <AddressFields idPrefix="store" value={draft.address} savedPin={store.address.postalCode} onChange={setAddress} autoFocus />
        )}
        {section === 'orders' && (
          <>
            <Field id="prefix" label="Order number prefix" error={errors.orderPrefix} hint={`New orders look like #${(draft.orderPrefix || 'ORD-').toUpperCase()}482913507. Existing orders keep their numbers.`}>
              <TextInput id="prefix" value={draft.orderPrefix} error={errors.orderPrefix} maxLength={10} className="font-mono uppercase" onChange={(e) => set({ orderPrefix: e.target.value.toUpperCase() })} autoFocus />
            </Field>
            <Field id="low-stock" label="Low stock alert" error={errors.lowStockThreshold} hint="Published products at or below this many units show under Low stock on the dashboard.">
              <TextInput
                id="low-stock"
                inputMode="numeric"
                value={draft.lowStockThreshold}
                error={errors.lowStockThreshold}
                onChange={(e) => set({ lowStockThreshold: e.target.value.replace(/[^\d]/g, '') })}
              />
            </Field>
          </>
        )}
      </div>
    </SidePanel>
  );
}

function GeneralSettings() {
  const { data, error, reload, setData } = useLoader(getStore);
  const [section, setSection] = React.useState<Section | null>(null);
  const [panelKey, setPanelKey] = React.useState(0);
  const store = data?.store;
  const crumbs = [{ label: 'Settings', href: settingsUrls.overview() }, { label: 'General' }];

  const open = (s: Section) => {
    setPanelKey((k) => k + 1); // fresh draft each time the panel opens
    setSection(s);
  };
  const edit = (s: Section) => (
    <Button variant="outline" size="sm" className="rounded-md" onClick={() => open(s)}>
      Edit
    </Button>
  );

  if (!store) {
    return (
      <div className="space-y-5">
        <AdminPageHeader breadcrumbs={crumbs} title="General" description="Your store's identity and contact details." />
        {error ? (
          <div className="rounded-lg border bg-card">
            <ErrorState message={error.message} onRetry={reload} />
          </div>
        ) : (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-44 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  const a = store.address;
  const addressLines = [a.addressLine1, a.addressLine2, [a.city, a.state, a.postalCode].filter(Boolean).join(', '), a.addressLine1 ? a.country : ''].filter(Boolean);

  return (
    <div className="space-y-5">
      <AdminPageHeader breadcrumbs={crumbs} title="General" description="Your store's identity and contact details." />

      {!store.name && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-50 px-4 py-3 text-[13px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          Add your store name. It is shown on the storefront and on orders.
        </div>
      )}

      <SectionCard title="Store details" actions={edit('details')}>
        <dl className="divide-y">
          <SectionRow label="Store name">{store.name || <Muted />}</SectionRow>
          <SectionRow label="Legal business name">{store.legalName || <Muted />}</SectionRow>
          <SectionRow label="GSTIN">{store.gstin ? <span className="font-mono text-xs">{store.gstin}</span> : <Muted />}</SectionRow>
          <SectionRow label="Currency">
            {data.currency.code} ({data.currency.symbol}) <span className="text-xs text-muted-foreground">· all prices are in Indian rupees</span>
          </SectionRow>
        </dl>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Contact" actions={edit('contact')}>
          <dl className="divide-y">
            <SectionRow label="Support email">{store.email || <Muted />}</SectionRow>
            <SectionRow label="Support phone">{store.phone || <Muted />}</SectionRow>
          </dl>
        </SectionCard>
        <SectionCard title="Store address" actions={edit('address')}>
          <div className="px-5 py-4 text-[13px]">
            {addressLines.length ? addressLines.map((line, i) => <p key={i}>{line}</p>) : <Muted>No address yet</Muted>}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Orders & inventory" actions={edit('orders')}>
        <dl className="divide-y">
          <SectionRow label="Order number prefix">
            <span className="font-mono text-xs">{store.orderPrefix}</span>
            <span className="text-xs text-muted-foreground"> · e.g. #{store.orderPrefix}482913507</span>
          </SectionRow>
          <SectionRow label="Low stock alert">
            {store.lowStockThreshold} unit{store.lowStockThreshold === 1 ? '' : 's'} or fewer
          </SectionRow>
        </dl>
      </SectionCard>

      <EditStorePanel
        key={panelKey}
        section={section}
        store={store}
        onClose={() => setSection(null)}
        onSaved={(saved) => {
          setData({ ...data, store: saved });
          setSection(null);
          toast.success('Settings saved');
        }}
      />
    </div>
  );
}

export default function GeneralSettingsPage() {
  return (
    <AdminToaster>
      <GeneralSettings />
    </AdminToaster>
  );
}
