'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateThread } from '../actions';
import { one, type ThreadRow } from '@/lib/thread-types';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import { TextField, TextAreaField, SelectField } from '@/components/ui/field';
import { DateField } from '@/components/ui/date-field';
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n';
import { uploadAsset } from '@/lib/upload';
import { ImagePlus, X, PanelTop, MousePointerClick } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SwitchField } from '@/components/ui/switch';
import { SectionLabel } from '@/components/ui/page';

const THREAD_HOST =
  process.env.NEXT_PUBLIC_THREAD_URL?.replace(/^https?:\/\//, '') ?? 'thread.thefibre.app';

export function ThreadEditorForm({
  thread,
  compact = false,
  teams = [],
  onSaved,
}: {
  thread: ThreadRow;
  compact?: boolean;
  teams?: { id: string; name: string }[];
  /** Popups close after save (Sjoerd 2026-07-02). */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const program = one(thread.program);
  const organiser = one(thread.organiser);
  const team = one(thread.team);
  // Team threads live under the TEAM's public slug; personal under the organiser's.
  const urlOwner = team?.slug ?? organiser?.slug ?? '';
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // End date can only follow the start date.
  const [startsOn, setStartsOn] = useState(program?.starts_on ?? '');
  const [pending, startTransition] = useTransition();
  const [coverUrl, setCoverUrl] = useState<string | null>(thread.cover_url);
  const [interaction, setInteraction] = useState<'page' | 'popup'>(
    thread.public_interaction ?? 'page',
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setCoverUrl(await uploadAsset(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

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
      language: String(fd.get('language') ?? 'en'),
      cover_url: coverUrl,
      public_interaction: interaction,
    };
    if (!patch.title) return setError('The thread needs a name.');
    if (!patch.slug) return setError('The thread needs a URL slug.');

    startTransition(async () => {
      const r = await updateThread(thread.id, patch);
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
      onSaved?.();
    });
  }

  return (
    // In the settings dialog (compact) the Save button lives in the shared
    // dialog footer and submits this form by id.
    <form id="thread-basics-form" onSubmit={onSubmit} className="mt-8 space-y-8">
      <div>
        <SectionLabel>Basics</SectionLabel>
        <div className="mt-3 space-y-6">
          <NameAndSlugFields
            nameLabel="Name"
            initialName={program?.title ?? ''}
            initialSlug={thread.slug}
            prefix={`${THREAD_HOST}/${urlOwner}/`}
          />

          <TextAreaField
            label="Intention"
            name="intention"
            rows={3}
            defaultValue={thread.intention ?? ''}
            hint="Why this thread exists — shown on the public page."
          />

          {/* Thread image — shown on the public page + embeds */}
          <div>
            <span className="text-sm text-ink-subtle">Thread image</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickCover}
            />
            {coverUrl ? (
              <div className="mt-1 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt=""
                  className="h-20 w-32 rounded-md object-cover ring-1 ring-line"
                />
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-xs text-ink-subtle hover:text-ink text-left"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverUrl(null)}
                    className="text-xs text-ink-subtle hover:text-ink inline-flex items-center gap-1"
                  >
                    <X size={11} strokeWidth={1.75} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="mt-1 w-full rounded-md border-2 border-dashed border-line hover:border-yellow-400 hover:bg-yellow-50/50 text-ink-subtle hover:text-ink py-4 text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <ImagePlus size={16} strokeWidth={1.75} />
                {uploading ? 'Uploading…' : 'Upload image'}
              </button>
            )}
            <span className="mt-1 block text-xs text-ink-muted">
              Cover on the public page and in embeds.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateField
              label="Starts on"
              name="starts_on"
              defaultValue={program?.starts_on ?? ''}
              onValueChange={setStartsOn}
            />
            <DateField
              label="Ends on"
              name="ends_on"
              defaultValue={program?.ends_on ?? ''}
              min={startsOn || null}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label="Timezone"
              name="timezone"
              defaultValue={thread.timezone}
              hint="IANA name, e.g. Europe/Amsterdam."
            />
            <SelectField
              label="Public language"
              name="language"
              defaultValue={thread.language ?? 'en'}
              options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))}
              hint="Public page, enrol form, embeds and participant emails."
            />
          </div>

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

          {/* How an overview opens this thread (Luma-style choice) */}
          <div>
            <span className="text-sm text-ink-subtle">When clicked in an overview</span>
            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInteraction('page')}
                className={`text-left rounded-lg border p-3.5 transition-colors ${
                  interaction === 'page'
                    ? 'border-ink bg-surface-sunken'
                    : 'border-line bg-surface hover:bg-surface-sunken'
                }`}
              >
                <div className="flex items-center gap-2">
                  <PanelTop size={15} strokeWidth={1.75} className="text-ink-subtle" />
                  <span className="text-sm font-medium">Thread page</span>
                </div>
                <p className="mt-1 text-xs text-ink-subtle leading-relaxed">
                  Opens the full public page with agenda and details.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setInteraction('popup')}
                className={`text-left rounded-lg border p-3.5 transition-colors ${
                  interaction === 'popup'
                    ? 'border-ink bg-surface-sunken'
                    : 'border-line bg-surface hover:bg-surface-sunken'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MousePointerClick size={15} strokeWidth={1.75} className="text-ink-subtle" />
                  <span className="text-sm font-medium">Enrol popup</span>
                </div>
                <p className="mt-1 text-xs text-ink-subtle leading-relaxed">
                  Opens a popup with thread info and direct enrolment.
                </p>
              </button>
            </div>
          </div>

          <SwitchField
            label="List on the organiser's public page"
            hint="Unlisted threads stay reachable by direct link."
            name="is_public_listed"
            defaultChecked={thread.is_public_listed}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {!compact && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
          {saved && <span className="text-sm text-ink-subtle">Saved.</span>}
        </div>
      )}
    </form>
  );
}
