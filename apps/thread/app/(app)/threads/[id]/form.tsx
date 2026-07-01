'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateThread } from '../actions';
import { one, type ThreadRow } from '@/lib/thread-types';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import { TextField, TextAreaField, SelectField } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/page';

const THREAD_HOST =
  process.env.NEXT_PUBLIC_THREAD_URL?.replace(/^https?:\/\//, '') ?? 'thread.thefibre.app';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft — not visible publicly' },
  { value: 'active', label: 'Active — published' },
  { value: 'completed', label: 'Completed — visible, enrolment closed' },
  { value: 'archived', label: 'Archived — hidden' },
];

export function ThreadEditorForm({ thread }: { thread: ThreadRow }) {
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

    const patch = {
      title: String(fd.get('name') ?? '').trim(),
      slug: String(fd.get('slug') ?? '').trim(),
      status: String(fd.get('status') ?? 'draft') as
        | 'draft'
        | 'active'
        | 'completed'
        | 'archived',
      intention: String(fd.get('intention') ?? '').trim() || null,
      starts_on: String(fd.get('starts_on') ?? '') || null,
      ends_on: String(fd.get('ends_on') ?? '') || null,
      timezone: String(fd.get('timezone') ?? '').trim() || 'Europe/Amsterdam',
      is_public_listed: fd.get('is_public_listed') === 'on',
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
            <TextField
              label="Starts on"
              name="starts_on"
              type="date"
              defaultValue={program?.starts_on ?? ''}
            />
            <TextField
              label="Ends on"
              name="ends_on"
              type="date"
              defaultValue={program?.ends_on ?? ''}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Status"
              name="status"
              options={STATUS_OPTIONS}
              defaultValue={program?.status ?? 'draft'}
            />
            <TextField
              label="Timezone"
              name="timezone"
              defaultValue={thread.timezone}
              hint="IANA name, e.g. Europe/Amsterdam."
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
