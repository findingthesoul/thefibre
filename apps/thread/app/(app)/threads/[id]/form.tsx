'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@thefibre/shared';
import { setThreadCategories, updateThread } from '../actions';
import { one, type ThreadRow } from '@/lib/thread-types';
import { t } from '@/lib/i18n-ui';
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
  process.env.NEXT_PUBLIC_THREAD_URL?.replace(/^https?:\/\//, '') ?? 'app.thethread.app';

export function ThreadEditorForm({
  locale,
  thread,
  compact = false,
  teams = [],
  categories = [],
  onSaved,
}: {
  locale: Locale;
  thread: ThreadRow;
  compact?: boolean;
  teams?: { id: string; name: string }[];
  /** The workspace's curated category list (Settings → Categories). */
  categories?: { id: string; name: string; slug: string }[];
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
  const [selectedCats, setSelectedCats] = useState<Set<string>>(
    () =>
      new Set(
        (thread.categories ?? [])
          .map((r) => (Array.isArray(r.category) ? r.category[0] : r.category))
          .filter(Boolean)
          .map((cat) => cat!.id),
      ),
  );
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
      setError(err instanceof Error ? err.message : t(locale, 'upload_failed'));
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
      public_agenda: fd.get('public_agenda') === 'on',
      team_id: String(fd.get('team_id') ?? '') || null,
      language: String(fd.get('language') ?? 'en'),
      facilitation_language: String(fd.get('facilitation_language') ?? '').trim() || null,
      cover_url: coverUrl,
      public_interaction: interaction,
    };
    if (!patch.title) return setError(t(locale, 'err_thread_needs_name'));
    if (!patch.slug) return setError(t(locale, 'err_thread_needs_slug'));

    startTransition(async () => {
      const r = await updateThread(thread.id, patch);
      if (!r.ok) return setError(r.error);
      const rc = await setThreadCategories(thread.id, [...selectedCats]);
      if (!rc.ok) return setError(rc.error);
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
        <SectionLabel>{t(locale, 'basics')}</SectionLabel>
        <div className="mt-3 space-y-6">
          <NameAndSlugFields
            locale={locale}
            nameLabel={t(locale, 'name')}
            initialName={program?.title ?? ''}
            initialSlug={thread.slug}
            prefix={`${THREAD_HOST}/${urlOwner}/`}
          />

          <TextAreaField
            label={t(locale, 'intention')}
            name="intention"
            rows={3}
            defaultValue={thread.intention ?? ''}
            hint={t(locale, 'intention_hint')}
          />

          {/* Thread image — shown on the public page + embeds */}
          <div>
            <span className="text-sm text-ink-subtle">{t(locale, 'thread_image')}</span>
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
                    {t(locale, 'replace')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverUrl(null)}
                    className="text-xs text-ink-subtle hover:text-ink inline-flex items-center gap-1"
                  >
                    <X size={11} strokeWidth={1.75} /> {t(locale, 'remove')}
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
                {uploading ? t(locale, 'uploading') : t(locale, 'upload_image')}
              </button>
            )}
            <span className="mt-1 block text-xs text-ink-muted">{t(locale, 'cover_hint')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateField
              label={t(locale, 'starts_on')}
              name="starts_on"
              defaultValue={program?.starts_on ?? ''}
              onValueChange={setStartsOn}
            />
            <DateField
              label={t(locale, 'ends_on')}
              name="ends_on"
              defaultValue={program?.ends_on ?? ''}
              min={startsOn || null}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label={t(locale, 'timezone')}
              name="timezone"
              defaultValue={thread.timezone}
              hint={t(locale, 'timezone_hint')}
            />
            <SelectField
              label={t(locale, 'page_language')}
              name="language"
              defaultValue={thread.language ?? 'en'}
              options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))}
              hint={t(locale, 'page_language_hint')}
            />
          </div>

          <TextField
            label={t(locale, 'facilitation_language')}
            name="facilitation_language"
            defaultValue={thread.facilitation_language ?? ''}
            placeholder={t(locale, 'facilitation_placeholder')}
            hint={t(locale, 'facilitation_hint')}
          />

          <SelectField
              label={t(locale, 'team')}
              name="team_id"
              defaultValue={thread.team_id ?? ''}
              options={[
                { value: '', label: t(locale, 'personal_no_team') },
                ...teams.map((tm) => ({ value: tm.id, label: tm.name })),
              ]}
              hint={t(locale, 'team_hint')}
            />

          {/* How an overview opens this thread (Luma-style choice) */}
          <div>
            <span className="text-sm text-ink-subtle">{t(locale, 'when_clicked')}</span>
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
                  <span className="text-sm font-medium">{t(locale, 'thread_page')}</span>
                </div>
                <p className="mt-1 text-xs text-ink-subtle leading-relaxed">
                  {t(locale, 'thread_page_desc')}
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
                  <span className="text-sm font-medium">{t(locale, 'enrol_popup')}</span>
                </div>
                <p className="mt-1 text-xs text-ink-subtle leading-relaxed">
                  {t(locale, 'enrol_popup_desc')}
                </p>
              </button>
            </div>
          </div>

          <SwitchField
            label={t(locale, 'list_public')}
            hint={t(locale, 'list_public_hint')}
            name="is_public_listed"
            defaultChecked={thread.is_public_listed}
          />

          <SwitchField
            label={t(locale, 'public_agenda')}
            hint={t(locale, 'public_agenda_hint')}
            name="public_agenda"
            defaultChecked={thread.public_agenda ?? true}
          />

          {categories.length > 0 && (
            <div>
              <span className="text-sm text-ink-subtle">{t(locale, 'categories')}</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {categories.map((cat) => {
                  const on = selectedCats.has(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setSelectedCats((prev) => {
                          const next = new Set(prev);
                          if (next.has(cat.id)) next.delete(cat.id);
                          else next.add(cat.id);
                          return next;
                        })
                      }
                      className={`rounded-full px-3 py-1 text-xs ring-1 transition-colors ${
                        on
                          ? 'bg-ink text-ink-inverse ring-ink'
                          : 'bg-surface text-ink-subtle ring-line hover:text-ink hover:ring-line-strong'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">
                {t(locale, 'manage_categories_note')}
              </p>
            </div>
          )}
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
            {pending ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
          {saved && <span className="text-sm text-ink-subtle">{t(locale, 'saved')}</span>}
        </div>
      )}
    </form>
  );
}
