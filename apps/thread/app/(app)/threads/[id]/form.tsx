'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateThread } from '../actions';
import { one, type ThreadRow } from '@/lib/thread-types';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import { TextField, TextAreaField, SelectField } from '@/components/ui/field';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/page';

const THREAD_HOST =
  process.env.NEXT_PUBLIC_THREAD_URL?.replace(/^https?:\/\//, '') ?? 'thread.thefibre.app';

export function ThreadEditorForm({
  thread,
  compact = false,
  teams = [],
  organisations = [],
}: {
  thread: ThreadRow;
  compact?: boolean;
  teams?: { id: string; name: string }[];
  organisations?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const program = one(thread.program);
  const organiser = one(thread.organiser);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);

    // Status is deliberately NOT part of this form — the timeline header's
    // status pill owns it. Including it here would reset it on every save.
    const patch = {
      title: String(fd.get('name') ?? '').trim(),
      slug: String(fd.get('slug') ?? '').trim(),
      intention: String(fd.get('intention') ?? '').trim() || null,
      starts_on: String(fd.get('starts_on') ?? '') || null,
      ends_on: String(fd.get('ends_on') ?? '') || null,
      timezone: String(fd.get('timezone') ?? '').trim() || 'Europe/Amsterdam',
      is_public_listed: fd.get('is_public_listed') === 'on',
      team_id: String(fd.get('team_id') ?? '') || null,
      organisation_id: String(fd.get('organisation_id') ?? '') || null,
    };
    if (!patch.title) return setError('The thread needs a name.');
    if (!patch.slug) return setError('The thread needs a URL slug.');

    startTransition(async () => {
      const r = await updateThread(thread.id, patch);
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-8">
      <div>
        <SectionLabel>Basics</SectionLabel>
        <div className="mt-3 space-y-6">
          <NameAndSlugFields
            nameLabel="Name"
            initialName={program?.title ?? ''}
            initialSlug={thread.slug}
            prefix={`${THREAD_HOST}/${organiser?.slug ?? ''}/`}
          />

          <TextAreaField
            label="Intention"
            name="intention"
            rows={3}
            defaultValue={thread.intention ?? ''}
            hint="Why this thread exists — shown on the public page."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateField
              label="Starts on"
              name="starts_on"
              defaultValue={program?.starts_on ?? ''}
            />
            <DateField
              label="Ends on"
              name="ends_on"
              defaultValue={program?.ends_on ?? ''}
            />
          </div>

          <TextField
            label="Timezone"
            name="timezone"
            defaultValue={thread.timezone}
            hint="IANA name, e.g. Europe/Amsterdam."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Team"
              name="team_id"
              defaultValue={thread.team_id ?? ''}
              options={[
                { value: '', label: 'Personal — no team' },
                ...teams.map((t) => ({ value: t.id, label: t.name })),
              ]}
              hint="Team members share this thread."
            />
            <SelectField
              label="Organisation"
              name="organisation_id"
              defaultValue={thread.organisation_id ?? ''}
              options={[
                { value: '', label: 'None' },
                ...organisations.map((o) => ({ value: o.id, label: o.name })),
              ]}
              hint="Shown as the thread's public face."
            />
          </div>

          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="is_public_listed"
              defaultChecked={thread.is_public_listed}
              className="mt-0.5"
            />
            <span className="text-sm text-ink-subtle">
              List on the organiser&apos;s public page
              <span className="block text-xs text-ink-muted">
                Unlisted threads stay reachable by direct link.
              </span>
            </span>
          </label>
        </div>
      </div>

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
