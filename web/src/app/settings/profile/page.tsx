'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Muted, SectionCard, SectionRow } from '@/components/admin/SectionCard';
import { SidePanel } from '@/components/admin/SidePanel';
import { ErrorState, InlineError } from '@/components/admin/StateViews';
import { Field, TextInput } from '@/components/admin/fields';
import { useDarkMode } from '@/components/admin/ThemeToggle';
import { AdminToaster, toast } from '@/components/admin/toast';
import { CustomerAvatar } from '@/components/customers/CustomerBits';
import { PanelButtons, Segmented, useLoader } from '@/components/settings/SettingsBits';
import { ApiError } from '@/lib/products/api';
import { settingsUrls } from '@/lib/products/urls';
import { fieldErrorsOf } from '@/lib/request';
import { getProfile, saveProfile, type Profile } from '@/lib/settings';

function EditDetailsPanel({ open, profile, onClose, onSaved }: { open: boolean; profile: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const [draft, setDraft] = React.useState(profile);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    setSaving(true);
    setFormError(null);
    try {
      onSaved(await saveProfile({ displayName: draft.displayName, jobTitle: draft.jobTitle, phone: draft.phone }));
    } catch (err) {
      const fields = fieldErrorsOf(err);
      setErrors(fields ?? {});
      if (!fields) setFormError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel open={open} onOpenChange={(o) => !o && !saving && onClose()} title="Edit your details" onSubmit={submit} footer={<PanelButtons onCancel={onClose} saving={saving} />}>
      <div className="space-y-4">
        {formError && <InlineError message={formError} />}
        <Field id="display-name" label="Display name" optional hint="How you appear in this admin.">
          <TextInput id="display-name" value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} autoFocus />
        </Field>
        <Field id="job-title" label="Job title" optional>
          <TextInput id="job-title" value={draft.jobTitle} placeholder="e.g. Store manager" onChange={(e) => setDraft({ ...draft, jobTitle: e.target.value })} />
        </Field>
        <Field id="phone" label="Phone" optional error={errors.phone}>
          <TextInput id="phone" type="tel" value={draft.phone} error={errors.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
        </Field>
      </div>
    </SidePanel>
  );
}

function ProfileSettings() {
  const { data, error, reload, setData } = useLoader(getProfile);
  const [editing, setEditing] = React.useState(false);
  const [panelKey, setPanelKey] = React.useState(0);
  const [savingRange, setSavingRange] = React.useState(false);
  const [dark, setDark] = useDarkMode();
  const crumbs = [{ label: 'Settings', href: settingsUrls.overview() }, { label: 'Profile' }];

  if (!data) {
    const signedOut = error instanceof ApiError && error.status === 401;
    return (
      <div className="space-y-5">
        <AdminPageHeader breadcrumbs={crumbs} title="Profile" description="Your details and preferences in this admin." />
        {error ? (
          <div className="rounded-lg border bg-card">
            <ErrorState message={signedOut ? 'Sign in to OpenExt again, then reload this page.' : error.message} onRetry={reload} />
          </div>
        ) : (
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-36 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  const { user, profile } = data;
  const shownName = profile.displayName || user.email || 'Admin';

  const setRange = async (days: Profile['dashboardDays']) => {
    const previous = profile;
    setData({ user, profile: { ...profile, dashboardDays: days } });
    setSavingRange(true);
    try {
      await saveProfile({ dashboardDays: days });
      toast.success('Preference saved');
    } catch (err) {
      setData({ user, profile: previous });
      toast.error('Could not save', err instanceof Error ? err.message : undefined);
    } finally {
      setSavingRange(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader breadcrumbs={crumbs} title="Profile" description="Your details and preferences in this admin." />

      <SectionCard>
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <CustomerAvatar name={profile.displayName} email={user.email || user.id} className="size-12 text-base" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">{shownName}</h2>
            <p className="truncate text-[13px] text-muted-foreground">{[profile.jobTitle, user.roleLabel].filter(Boolean).join(' · ') || 'OpenExt user'}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-md"
            onClick={() => {
              setPanelKey((k) => k + 1);
              setEditing(true);
            }}
          >
            Edit
          </Button>
        </div>
        <dl className="divide-y border-t">
          <SectionRow label="Display name">{profile.displayName || <Muted />}</SectionRow>
          <SectionRow label="Job title">{profile.jobTitle || <Muted />}</SectionRow>
          <SectionRow label="Phone">{profile.phone || <Muted />}</SectionRow>
        </dl>
      </SectionCard>

      <SectionCard title="Account" description="Managed by OpenExt. Change your email or password in OpenExt's own settings.">
        <dl className="divide-y">
          <SectionRow label="Email">{user.email || <Muted />}</SectionRow>
          <SectionRow label="Role">{user.roleLabel || <Muted />}</SectionRow>
          <SectionRow label="User ID">
            <span className="font-mono text-xs text-muted-foreground">{user.id}</span>
          </SectionRow>
        </dl>
      </SectionCard>

      <SectionCard title="Preferences">
        <div className="divide-y">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">Dashboard date range</p>
              <p className="text-xs text-muted-foreground">The period the dashboard opens with. Saved to your profile.</p>
            </div>
            <Segmented
              label="Dashboard date range"
              value={profile.dashboardDays}
              disabled={savingRange}
              options={[
                { value: 7, label: '7 days' },
                { value: 30, label: '30 days' },
                { value: 90, label: '90 days' },
              ]}
              onChange={(d) => d !== profile.dashboardDays && setRange(d)}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">Appearance</p>
              <p className="text-xs text-muted-foreground">Saved in this browser.</p>
            </div>
            <Segmented
              label="Appearance"
              value={dark ? 'dark' : 'light'}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              onChange={(v) => setDark(v === 'dark')}
            />
          </div>
        </div>
      </SectionCard>

      <EditDetailsPanel
        key={panelKey}
        open={editing}
        profile={profile}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setData({ user, profile: saved });
          setEditing(false);
          toast.success('Profile saved');
        }}
      />
    </div>
  );
}

export default function ProfileSettingsPage() {
  return (
    <AdminToaster>
      <ProfileSettings />
    </AdminToaster>
  );
}
