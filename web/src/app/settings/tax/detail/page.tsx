'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Archive02Icon, Edit02Icon, PercentSquareIcon } from '@hugeicons/core-free-icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ActionMenu } from '@/components/admin/ActionMenu';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { Muted, SectionCard, SectionRow } from '@/components/admin/SectionCard';
import { SidePanel } from '@/components/admin/SidePanel';
import { EmptyState, ErrorState } from '@/components/admin/StateViews';
import { CheckboxField, Field, TextArea, TextInput } from '@/components/admin/fields';
import { AdminToaster, toast } from '@/components/admin/toast';
import { ActiveBadge, PanelButtons, useLoader } from '@/components/settings/SettingsBits';
import { TaxRatePanel } from '@/components/settings/TaxRatePanel';
import { ApiError } from '@/lib/products/api';
import { settingsUrls } from '@/lib/products/urls';
import { fieldErrorsOf } from '@/lib/request';
import {
  SHIPPING_TAX_LABEL,
  classIdOf,
  getCoreSettings,
  getTaxClass,
  listTaxRules,
  scopeLabel,
  totalRate,
  updateTaxClass,
  updateTaxRule,
  type TaxClass,
  type TaxRule,
} from '@/lib/settings';
import { cn } from '@/lib/utils';

function EditCategoryPanel({ open, taxClass, onClose, onSaved }: { open: boolean; taxClass: TaxClass; onClose: () => void; onSaved: (c: TaxClass) => void }) {
  const [name, setName] = React.useState(taxClass.name);
  const [description, setDescription] = React.useState(taxClass.description ?? '');
  const [active, setActive] = React.useState(taxClass.status === 'Active');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    if (!name.trim()) return setError('Enter a name.');
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateTaxClass(taxClass._id, { name: name.trim(), description: description.trim(), status: active ? 'Active' : 'Inactive' }));
    } catch (err) {
      setError(fieldErrorsOf(err)?.name ?? (err instanceof Error ? err.message : 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel open={open} onOpenChange={(o) => !o && !saving && onClose()} title="Edit tax category" onSubmit={submit} footer={<PanelButtons onCancel={onClose} saving={saving} />}>
      <div className="space-y-4">
        <Field id="class-name" label="Name" error={error ?? undefined}>
          <TextInput id="class-name" value={name} error={error ?? undefined} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field id="class-description" label="Description" optional>
          <TextArea id="class-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <CheckboxField id="class-active" checked={active} onChange={setActive} label="Active" hint="Inactive categories can't be picked for products, and their rates stop applying." />
      </div>
    </SidePanel>
  );
}

async function loadCategory(id: string) {
  const [taxClass, rules, settings] = await Promise.all([getTaxClass(id), listTaxRules(), getCoreSettings()]);
  return { taxClass, rules: rules.filter((r) => classIdOf(r) === id), isDefault: settings.defaultTaxClassId === id };
}

function TaxCategory() {
  const id = useSearchParams().get('id') ?? '';
  const { data, error, reload, setData } = useLoader(() => (id ? loadCategory(id) : Promise.reject(new ApiError('Missing id', 400))));
  const [panel, setPanel] = React.useState<{ kind: 'category' } | { kind: 'rate'; rule: TaxRule | null } | null>(null);
  const [panelKey, setPanelKey] = React.useState(0);
  const { confirm, dialog } = useConfirm();
  const crumbs = [{ label: 'Settings', href: settingsUrls.overview() }, { label: 'Tax', href: settingsUrls.tax() }, { label: data?.taxClass.name ?? (error ? 'Category' : 'Loading…') }];
  const open = (p: NonNullable<typeof panel>) => {
    setPanelKey((k) => k + 1);
    setPanel(p);
  };

  if (!data) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400 || error.status === 500);
    return (
      <div className="space-y-5">
        <AdminPageHeader breadcrumbs={crumbs} />
        {error ? (
          <div className="rounded-lg border bg-card">
            {notFound ? (
              <EmptyState icon={PercentSquareIcon} title="Tax category not found" action={<a href={settingsUrls.tax()} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'rounded-md')}>Back to tax</a>} />
            ) : (
              <ErrorState message={error.message} onRetry={reload} />
            )}
          </div>
        ) : (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-56 rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  const { taxClass, rules, isDefault } = data;
  const sorted = [...rules].sort((a, b) => (a.status === b.status ? b.priority - a.priority : a.status === 'Active' ? -1 : 1));

  const setRuleActive = (rule: TaxRule, active: boolean) =>
    confirm({
      title: active ? 'Turn this rate back on?' : 'Turn off this rate?',
      description: active
        ? `${rule.name} for ${scopeLabel(rule)} will apply to new orders again.`
        : `${rule.name} for ${scopeLabel(rule)} stops applying to new orders. Existing orders keep the tax they were charged.`,
      confirmLabel: active ? 'Turn on' : 'Turn off',
      destructive: !active,
      onConfirm: async () => {
        try {
          const saved = await updateTaxRule(rule._id, { ...rule, taxClassId: taxClass._id, status: active ? 'Active' : 'Inactive' });
          setData({ ...data, rules: rules.map((r) => (r._id === saved._id ? saved : r)) });
          toast.success(active ? 'Rate turned on' : 'Rate turned off');
        } catch (err) {
          toast.error('Could not update the rate', err instanceof Error ? err.message : undefined);
        }
      },
    });

  return (
    <div className="space-y-5">
      <AdminPageHeader breadcrumbs={crumbs} />

      <SectionCard
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base">{taxClass.name}</span>
            {isDefault && <span className="rounded border px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">Default category</span>}
          </span>
        }
        actions={
          <>
            <ActiveBadge status={taxClass.status} />
            <Button variant="outline" size="sm" className="rounded-md" onClick={() => open({ kind: 'category' })}>
              Edit
            </Button>
          </>
        }
      >
        <dl className="divide-y">
          <SectionRow label="Description">{taxClass.description || <Muted />}</SectionRow>
          <SectionRow label="Code">
            <span className="font-mono text-xs">{taxClass.code}</span>
          </SectionRow>
        </dl>
      </SectionCard>

      <SectionCard
        title="Rates"
        description="Which rate applies depends on where the order ships."
        actions={
          <Button size="sm" className="rounded-md" onClick={() => open({ kind: 'rate', rule: null })}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            Add rate
          </Button>
        }
      >
        {sorted.length === 0 ? (
          <EmptyState
            icon={PercentSquareIcon}
            title="No rates yet"
            description="Products in this category aren't taxed until you add a rate. For GST, add CGST + SGST for your home state and IGST for everywhere else."
            action={<Button size="sm" className="rounded-md" onClick={() => open({ kind: 'rate', rule: null })}>Add rate</Button>}
          />
        ) : (
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 pl-5 text-xs font-medium text-muted-foreground">Region</TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">Rate</TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">Shipping</TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="h-9 w-10 pr-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r._id} className={cn('cursor-pointer', r.status !== 'Active' && 'text-muted-foreground')} onClick={(e) => !(e.target as HTMLElement).closest('a,button,[role=menu]') && open({ kind: 'rate', rule: r })}>
                  <TableCell className="py-2.5 pl-5">
                    <span className="font-medium">{scopeLabel(r)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.name}
                      {r.priority ? ` · priority ${r.priority}` : ''}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="font-medium tabular-nums">{totalRate(r.components)}%</span>
                    <span className="block text-xs text-muted-foreground">{r.components.map((c) => `${c.label} ${c.rate}%`).join(' + ')}</span>
                  </TableCell>
                  <TableCell className="py-2.5">{SHIPPING_TAX_LABEL[r.shippingTaxPolicy] ?? SHIPPING_TAX_LABEL.UseGlobal}</TableCell>
                  <TableCell className="py-2.5">
                    <ActiveBadge status={r.status} />
                  </TableCell>
                  <TableCell className="py-2.5 pr-3 text-right">
                    <ActionMenu
                      label={`Actions for ${scopeLabel(r)}`}
                      groups={[
                        [{ label: 'Edit', icon: Edit02Icon, onSelect: () => open({ kind: 'rate', rule: r }) }],
                        [
                          r.status === 'Active'
                            ? { label: 'Turn off', icon: Archive02Icon, destructive: true, onSelect: () => setRuleActive(r, false) }
                            : { label: 'Turn on', icon: Archive02Icon, onSelect: () => setRuleActive(r, true) },
                        ],
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {panel?.kind === 'category' && (
        <EditCategoryPanel
          key={panelKey}
          open
          taxClass={taxClass}
          onClose={() => setPanel(null)}
          onSaved={(saved) => {
            setData({ ...data, taxClass: saved });
            setPanel(null);
            toast.success('Category saved');
          }}
        />
      )}
      {panel?.kind === 'rate' && (
        <TaxRatePanel
          key={panelKey}
          open
          taxClassId={taxClass._id}
          rule={panel.rule}
          onClose={() => setPanel(null)}
          onSaved={(saved, created) => {
            setData({ ...data, rules: created ? [...rules, saved] : rules.map((r) => (r._id === saved._id ? saved : r)) });
            setPanel(null);
            toast.success(created ? 'Rate added' : 'Rate saved');
          }}
        />
      )}
      {dialog}
    </div>
  );
}

export default function TaxCategoryPage() {
  return (
    <AdminToaster>
      <Suspense fallback={null}>
        <TaxCategory />
      </Suspense>
    </AdminToaster>
  );
}
