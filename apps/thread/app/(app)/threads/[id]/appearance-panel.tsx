'use client';

// Appearance tab — how this thread LOOKS in public, and where it shows up.
//
// Sjoerd asked for it (2026-09-09, deferred then; built 2026-09-10) after
// losing half an hour to the thing this tab exists to stop. soul.com's
// Community Member Year Agenda had five conversations, all published, all
// with "Show on the public agenda" ticked, and none of them appeared. Two
// thread-level switches were off, and neither was anywhere near the item he
// was looking at — one buried in a general settings list, the other three
// screens away. A control that looks like it worked is the shape of bug this
// codebase spent two days removing.
//
// So the switches that decide the public face of a thread live together, in
// the order somebody actually asks the questions:
//
//   is it visible at all      → List publicly
//   what does it look like    → the image
//   what does it contain      → the agenda
//   how does it open          → page or popup
//
// The image moved out of Basics with them: it is branding, not a fact about
// the thread, and Sjoerd named it as belonging here.

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, MousePointerClick, PanelTop, X } from 'lucide-react';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { updateThread } from '../actions';
import type { ThreadRow } from '@/lib/thread-types';
import { SwitchField } from '@/components/ui/switch';
import { uploadAsset } from '@/lib/upload';

export function AppearancePanel({
  locale,
  thread,
  onSaved,
}: {
  locale: Locale;
  thread: ThreadRow;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [coverUrl, setCoverUrl] = useState<string | null>(thread.cover_url);
  const [uploading, setUploading] = useState(false);
  const [interaction, setInteraction] = useState<'page' | 'popup'>(
    thread.public_interaction ?? 'page',
  );
  // Controlled so the agenda switch can explain itself the moment it is off,
  // rather than after a save and a trip to the public page.
  const [agenda, setAgenda] = useState<boolean>(thread.public_agenda ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
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
    startTransition(async () => {
      const r = await updateThread(thread.id, {
        cover_url: coverUrl,
        is_public_listed: fd.get('is_public_listed') === 'on',
        public_agenda: agenda,
        public_interaction: interaction,
      });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
      onSaved?.();
    });
  }

  return (
    // Saved from the shared dialog footer, which submits by form id.
    <form id="thread-appearance-form" onSubmit={onSubmit} className="space-y-6">
      <SwitchField
        label={t(locale, 'list_public')}
        hint={t(locale, 'list_public_hint')}
        name="is_public_listed"
        defaultChecked={thread.is_public_listed}
      />

      {/* Branding. Shown on the public page, in embeds, and on the card an
          overview renders for this thread. */}
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

      <div>
        <SwitchField
          label={t(locale, 'public_agenda')}
          hint={t(locale, 'public_agenda_hint')}
          checked={agenda}
          onChange={setAgenda}
        />
        {/* The whole reason this tab exists. With this off, every item's own
            "Show on the public agenda" switch is inert, and nothing on the
            item said so. */}
        {!agenda && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            {t(locale, 'public_agenda_off_warning')}
          </p>
        )}
      </div>

      {/* How an overview opens this thread (Luma-style choice). */}
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

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {(pending || saved) && (
        <p className="text-sm text-ink-subtle">
          {pending ? t(locale, 'saving') : t(locale, 'saved')}
        </p>
      )}
    </form>
  );
}
