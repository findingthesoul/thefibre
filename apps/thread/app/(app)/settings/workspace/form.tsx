'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateWorkspaceSettings } from '../actions';
import { TextField, TextAreaField, SelectField } from '@/components/ui/field';
import { Button } from '@/components/ui/button';

const CUT_OPTIONS = ['100', '90', '80', '70', '60', '50'];

export function WorkspaceForm({
  settings,
}: {
  settings: {
    email_from_mode?: 'workspace' | 'team' | 'personal' | 'custom';
    email_from_name: string | null;
    email_footer_note: string | null;
    default_vendor_cut_percent: number;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fromMode, setFromMode] = useState(settings.email_from_mode ?? 'workspace');

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await updateWorkspaceSettings({
        email_from_mode: fromMode,
        email_from_name:
          fromMode === 'custom' ? String(fd.get('email_from_name') ?? '').trim() || null : null,
        email_footer_note: String(fd.get('email_footer_note') ?? '').trim() || null,
        default_vendor_cut_percent: Number(fd.get('default_vendor_cut_percent') ?? 100),
      });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <SelectField
        label="Email sender name"
        name="email_from_mode"
        value={fromMode}
        onChange={(e) => setFromMode(e.target.value as typeof fromMode)}
        options={[
          { value: 'workspace', label: 'Workspace name' },
          { value: 'team', label: "The thread's team name" },
          { value: 'personal', label: "The organiser's name" },
          { value: 'custom', label: 'Custom — fill in below' },
        ]}
        hint="Shown as the from-name on thread emails."
      />
      {fromMode === 'custom' && (
        <TextField
          label="Custom sender name"
          name="email_from_name"
          defaultValue={settings.email_from_name ?? ''}
          placeholder="The Thread"
        />
      )}
      <TextAreaField
        label="Email footer note"
        name="email_footer_note"
        rows={2}
        defaultValue={settings.email_footer_note ?? ''}
        hint="Optional line under every thread email."
      />
      <SelectField
        label="Default organiser share"
        name="default_vendor_cut_percent"
        defaultValue={String(Math.round(settings.default_vendor_cut_percent))}
        options={CUT_OPTIONS.map((v) => ({
          value: v,
          label: `${v}% to the organiser`,
        }))}
        hint="Of net revenue after the platform fee — the rest goes to the workspace. Takes effect with the payments phase."
      />
      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="text-sm text-ink-subtle">Saved.</span>}
      </div>
    </form>
  );
}
