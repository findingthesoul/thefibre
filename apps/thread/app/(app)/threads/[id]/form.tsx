'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@thefibre/shared';
import { setThreadCategories, updateThread } from '../actions';
import { one, type ThreadRow } from '@/lib/thread-types';
import { t } from '@/lib/i18n-ui';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import { TextField, SelectField } from '@/components/ui/field';
import { RichTextField } from '@/components/ui/rich-text';
import { DateField } from '@/components/ui/date-field';
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n';
import { uploadAsset } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { SwitchField } from '@/components/ui/switch';
import { SectionLabel } from '@/components/ui/page';

const THREAD_HOST =
  process.env.NEXT_PUBLIC_THREAD_URL?.replace(/^https?:\/\//, '') ?? 'app.thethread.app';

type PublishScope = 'personal' | 'team' | 'workspace';

export function ThreadEditorForm({
  locale,
  thread,
  compact = false,
  teams = [],
  categories = [],
  workspaceSlug = null,
  onSaved,
}: {
  locale: Locale;
  thread: ThreadRow;
  compact?: boolean;
  teams?: { id: string; name: string; slug?: string }[];
  /** The workspace's curated category list (Settings → Categories). */
  categories?: { id: string; name: string; slug: string }[];
  /** The workspace's public slug — the URL prefix for workspace-scoped
   *  threads (docs/brief-workspace-urls.md D1). */
  workspaceSlug?: string | null;
  /** Popups close after save (Sjoerd 2026-07-02). */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const program = one(thread.program);
  const organiser = one(thread.organiser);
  const team = one(thread.team);
  // Publish scope (docs/brief-workspace-urls.md D1): Personal / Team /
  // Workspace. Workspace-scoped threads keep team_id null and publish
  // under the WORKSPACE slug; team threads under the team's; else personal.
  const [scope, setScope] = useState<PublishScope>(
    thread.public_scope === 'workspace' ? 'workspace' : thread.team_id ? 'team' : 'personal',
  );
  const [teamId, setTeamId] = useState(thread.team_id ?? '');
  const selectedTeam = teams.find((tm) => tm.id === teamId) ?? null;
  // Live public-URL prefix — switches with the scope choice.
  const urlOwner =
    scope === 'workspace'
      ? workspaceSlug ?? '…'
      : scope === 'team'
        ? selectedTeam?.slug ?? team?.slug ?? '…'
        : organiser?.slug ?? '';
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // End date can only follow the start date.
  const [startsOn, setStartsOn] = useState(program?.starts_on ?? '');
  const [pending, startTransition] = useTransition();
  const [selectedCats, setSelectedCats] = useState<Set<string>>(
    () =>
      new Set(
        (thread.categories ?? [])
          .map((r) => (Array.isArray(r.category) ? r.category[0] : r.category))
          .filter(Boolean)
          .map((cat) => cat!.id),
      ),
  );


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
      // Scope → storage: Personal = no team, no scope; Team = team_id;
      // Workspace = public_scope 'workspace' with team_id null (D1).
      team_id: scope === 'team' ? teamId || null : null,
      public_scope: scope === 'workspace' ? ('workspace' as const) : null,
      language: String(fd.get('language') ?? 'en'),
      facilitation_language: String(fd.get('facilitation_language') ?? '').trim() || null,
    };
    if (!patch.title) return setError(t(locale, 'err_thread_needs_name'));
    if (!patch.slug) return setError(t(locale, 'err_thread_needs_slug'));
    if (scope === 'team' && !teamId) return setError(t(locale, 'err_pick_team'));

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

          {/* Rich text since 2026-09-10 (Sjoerd asked for bold, italic,
              headings and links). Everything written before is plain text and
              renders unchanged — the sanitiser leaves it alone and the public
              page keeps `whitespace-pre-line`, so old paragraph breaks
              survive alongside new markup. */}
          <RichTextField
            locale={locale}
            label={t(locale, 'intention')}
            name="intention"
            defaultValue={thread.intention ?? ''}
            hint={t(locale, 'intention_hint')}
          />

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

          {/* Publish scope (docs/brief-workspace-urls.md D1): Personal /
              Team / Workspace. The public URL prefix above follows it. */}
          <div>
            <span className="text-sm text-ink-subtle">{t(locale, 'scope')}</span>
            <div className="mt-1 inline-flex rounded-md ring-1 ring-line overflow-hidden">
              {(
                [
                  ['personal', t(locale, 'personal')],
                  ['team', t(locale, 'team')],
                  ['workspace', t(locale, 'workspace')],
                ] as [PublishScope, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={value === 'team' && teams.length === 0}
                  onClick={() => setScope(value)}
                  className={`px-3.5 py-1.5 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    scope === value
                      ? 'bg-ink text-ink-inverse'
                      : 'bg-surface text-ink-subtle hover:text-ink hover:bg-surface-sunken'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="mt-1 block text-xs text-ink-muted">
              {scope === 'workspace'
                ? t(locale, 'scope_workspace_desc')
                : scope === 'team'
                  ? t(locale, 'team_hint')
                  : t(locale, 'scope_personal_desc')}
              {' '}
              <span className="font-mono">{`${THREAD_HOST}/${urlOwner}/`}</span>
            </span>
            {scope === 'team' && (
              <div className="mt-3">
                <SelectField
                  label={t(locale, 'team')}
                  name="team_id"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  options={[
                    { value: '', label: '—' },
                    ...teams.map((tm) => ({ value: tm.id, label: tm.name })),
                  ]}
                />
              </div>
            )}
          </div>

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
