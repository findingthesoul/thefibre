'use client';

// Thread templates list + the two dialogs: edit (title/scope) and
// "Use template" (title/slug/start date → instantiate → jump to the new
// thread). Structure editing happens on the source thread — save it as a
// template again to refresh the design; this screen manages the catalog.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarRange, Trash2, Play, Pencil } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { RichTextField } from '@/components/ui/rich-text';
import { EmptyState } from '@/components/ui/page';
import type { Locale } from '@thefibre/shared';
import { t, engagementTypeLabel } from '@/lib/i18n-ui';
import { metaFor } from '@/lib/engagement-meta';
import type { EngagementType, TeamOption } from '@/lib/thread-types';
// A template is a full duplicate of the thread (texts, message bodies,
// triggers) — so its editor reuses the engagement dialog's content fields.
import {
  MessageContentFields,
  contentFromForm,
} from '../../threads/[id]/engagements';
import {
  deleteThreadTemplate,
  instantiateTemplate,
  updateThreadTemplate,
  type TemplateEngagement,
  type TemplateScope,
  type ThreadTemplate,
  type ThreadTemplateStructure,
} from './actions';

const INPUT =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted';

function scopeLabel(locale: Locale, scope: TemplateScope): string {
  return scope === 'personal'
    ? t(locale, 'personal')
    : scope === 'team'
      ? t(locale, 'team')
      : t(locale, 'workspace');
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);
}

export function TemplatesClient({
  locale,
  templates,
  teams,
  initialUseId = null,
}: {
  locale: Locale;
  templates: ThreadTemplate[];
  teams: TeamOption[];
  /** Open this template's "Use" dialog on mount (from the New-thread menu). */
  initialUseId?: string | null;
}) {
  const [useFor, setUseFor] = useState<ThreadTemplate | null>(
    () => templates.find((t) => t.id === initialUseId) ?? null,
  );
  const [editFor, setEditFor] = useState<ThreadTemplate | null>(null);
  const [deleteFor, setDeleteFor] = useState<ThreadTemplate | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (templates.length === 0) {
    return (
      <EmptyState>{t(locale, 'templates_none')}</EmptyState>
    );
  }

  return (
    <>
      <ul className="mt-8 divide-y divide-line border border-line rounded-lg bg-surface-raised">
        {templates.map((tpl) => {
          const n = tpl.structure.engagements?.length ?? 0;
          return (
            <li key={tpl.id} className="flex items-center gap-3 px-4 py-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken ring-1 ring-line shrink-0">
                <CalendarRange size={16} strokeWidth={1.75} className="text-ink-subtle" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{tpl.title}</div>
                <div className="text-xs text-ink-subtle mt-0.5">
                  {scopeLabel(locale, tpl.scope)} · {t(locale, 'n_engagements', { n })}
                  {tpl.structure.duration_days != null &&
                    ` · ${t(locale, 'n_days', { n: tpl.structure.duration_days + 1 })}`}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leading={<Pencil size={14} />}
                onClick={() => setEditFor(tpl)}
              >
                {t(locale, 'edit')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leading={<Trash2 size={14} />}
                onClick={() => setDeleteFor(tpl)}
              >
                {t(locale, 'delete')}
              </Button>
              <Button
                type="button"
                size="sm"
                leading={<Play size={14} />}
                onClick={() => setUseFor(tpl)}
              >
                {t(locale, 'use_template')}
              </Button>
            </li>
          );
        })}
      </ul>

      {useFor && (
        <UseTemplateDialog locale={locale} template={useFor} onClose={() => setUseFor(null)} />
      )}
      {editFor && (
        <EditTemplateDialog
          locale={locale}
          template={editFor}
          teams={teams}
          onClose={() => setEditFor(null)}
        />
      )}
      <DangerConfirmDialog
        open={!!deleteFor}
        title={t(locale, 'delete_template')}
        message={
          <>
            {t(locale, 'delete_template_msg_1')} <strong>{deleteFor?.title}</strong>.{' '}
            {t(locale, 'delete_template_msg_2')}
          </>
        }
        pending={pending}
        onCancel={() => setDeleteFor(null)}
        onConfirm={() =>
          startTransition(async () => {
            if (!deleteFor) return;
            await deleteThreadTemplate(deleteFor.id);
            setDeleteFor(null);
            router.refresh();
          })
        }
      />
    </>
  );
}

function UseTemplateDialog({
  locale,
  template,
  onClose,
}: {
  locale: Locale;
  template: ThreadTemplate;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(template.title);
  const [slug, setSlug] = useState(slugify(template.title));
  const [slugTouched, setSlugTouched] = useState(false);
  const [startsOn, setStartsOn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    if (!title.trim()) return setError(t(locale, 'err_new_thread_name'));
    if (!slug.trim()) return setError(t(locale, 'err_new_thread_slug'));
    startTransition(async () => {
      const r = await instantiateTemplate(template.id, {
        title: title.trim(),
        slug: slug.trim(),
        starts_on: startsOn || null,
      });
      if (r.ok && r.id) {
        router.push(`/threads/${r.id}`);
      } else if (!r.ok) {
        setError(r.error);
      }
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(locale, 'use_template')}
      description={t(locale, 'use_template_desc', { title: template.title })}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? t(locale, 'creating') : t(locale, 'create_thread')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(locale, 'thread_name')}</span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            className={INPUT}
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(locale, 'slug')}</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            className={INPUT}
          />
        </label>
        <DateField
          label={t(locale, 'start_date')}
          name="starts_on"
          hint={t(locale, 'start_date_hint')}
          onValueChange={setStartsOn}
        />
        {error && (
          <p className="text-xs text-red-700 border border-red-200 bg-red-50 rounded-md px-2.5 py-2">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function EditTemplateDialog({
  locale,
  template,
  teams,
  onClose,
}: {
  locale: Locale;
  template: ThreadTemplate;
  teams: TeamOption[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState(template.title);
  const [scope, setScope] = useState<TemplateScope>(template.scope);
  const [teamId, setTeamId] = useState(template.owner_team_id ?? teams[0]?.id ?? '');
  // Full-duplicate editing: the structure lives in state; engagement rows
  // open a sub-editor and merge back here; Save persists the whole thing.
  const [structure, setStructure] = useState<ThreadTemplateStructure>(template.structure);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const engagements = useMemo(() => structure.engagements ?? [], [structure.engagements]);

  function submit() {
    setError(null);
    if (!title.trim()) return setError(t(locale, 'err_template_name'));
    if (scope === 'team' && !teamId) return setError(t(locale, 'err_template_team'));
    startTransition(async () => {
      const r = await updateThreadTemplate(template.id, {
        title: title.trim(),
        scope,
        owner_team_id: scope === 'team' ? teamId : null,
        structure,
      });
      if (r.ok) {
        onClose();
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(locale, 'edit_template')}
      description={t(locale, 'edit_template_desc')}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(locale, 'template_name')}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(locale, 'available_to')}</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as TemplateScope)}
            className={INPUT}
          >
            <option value="personal">{t(locale, 'just_me')}</option>
            <option value="team" disabled={teams.length === 0}>
              {t(locale, 'a_team')}
            </option>
            <option value="workspace">{t(locale, 'whole_workspace')}</option>
          </select>
        </label>
        {scope === 'team' && (
          <label className="block">
            <span className="text-xs text-ink-subtle">{t(locale, 'team')}</span>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={INPUT}>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div>
          <span className="text-xs text-ink-subtle">{t(locale, 'contents_click')}</span>
          {engagements.length === 0 ? (
            <p className="mt-1 text-xs text-ink-muted">{t(locale, 'no_engagements_captured')}</p>
          ) : (
            <ul className="mt-1.5 border border-line rounded-lg divide-y divide-line bg-surface">
              {engagements.map((e, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setEditIdx(i)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-sunken transition-colors"
                  >
                    <span className="text-xs text-ink-muted w-14 shrink-0 tabular-nums">
                      {e.day_offset != null ? t(locale, 'day_n', { n: e.day_offset + 1 }) : '—'}
                    </span>
                    <span className="truncate flex-1">{e.title}</span>
                    <span className="text-xs text-ink-muted shrink-0">
                      {engagementTypeLabel(locale, e.type)}
                    </span>
                    <Pencil size={13} strokeWidth={1.75} className="text-ink-muted shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-700 border border-red-200 bg-red-50 rounded-md px-2.5 py-2">
            {error}
          </p>
        )}
      </div>

      {editIdx !== null && engagements[editIdx] && (
        <TemplateEngagementDialog
          locale={locale}
          engagement={engagements[editIdx]}
          onClose={() => setEditIdx(null)}
          onSave={(updated) => {
            setStructure((s) => ({
              ...s,
              engagements: (s.engagements ?? []).map((e, i) => (i === editIdx ? updated : e)),
            }));
            setEditIdx(null);
          }}
        />
      )}
    </Dialog>
  );
}

// Edits ONE captured engagement — texts and content included, exactly the
// fields the live engagement dialog has for its family. Changes stay local
// until the template's own Save persists the structure.
function TemplateEngagementDialog({
  locale,
  engagement,
  onSave,
  onClose,
}: {
  locale: Locale;
  engagement: TemplateEngagement;
  onSave: (updated: TemplateEngagement) => void;
  onClose: () => void;
}) {
  const type = engagement.type as EngagementType;
  const family = metaFor(type).family;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return;
    const dayRaw = String(fd.get('day') ?? '').trim();
    const day = dayRaw === '' ? null : Math.max(1, Number(dayRaw) || 1) - 1;
    const time = String(fd.get('time_of_day') ?? '').trim() || null;
    const durRaw = String(fd.get('duration_minutes') ?? '').trim();
    onSave({
      ...engagement,
      title,
      description: String(fd.get('description') ?? '').trim() || null,
      day_offset: day,
      time_of_day: time,
      duration_minutes: durRaw === '' ? null : Number(durRaw) || null,
      ...(family === 'message' ? { content: contentFromForm(type, fd) } : {}),
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(locale, 'edit_item', { title: engagement.title })}
      description={t(locale, 'tpl_engagement_desc')}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="template-engagement-form">
            {t(locale, 'apply_btn')}
          </Button>
        </>
      }
    >
      <form id="template-engagement-form" onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-xs text-ink-subtle">{t(locale, 'title')}</span>
          <input name="title" defaultValue={engagement.title} required className={INPUT} />
        </label>

        <RichTextField
          locale={locale}
          label={t(locale, 'description')}
          name="description"
          defaultValue={engagement.description ?? ''}
          minHeight={72}
        />

        {family === 'message' && (
          <MessageContentFields
            locale={locale}
            type={type}
            content={(engagement.content ?? {}) as Record<string, unknown>}
          />
        )}

        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs text-ink-subtle">{t(locale, 'day')}</span>
            <input
              name="day"
              type="number"
              min={1}
              defaultValue={engagement.day_offset != null ? engagement.day_offset + 1 : ''}
              className={INPUT}
            />
          </label>
          <label className="block">
            <span className="text-xs text-ink-subtle">{t(locale, 'time')}</span>
            <input
              name="time_of_day"
              type="time"
              defaultValue={engagement.time_of_day ?? ''}
              className={INPUT}
            />
          </label>
          {family === 'activity' && (
            <label className="block">
              <span className="text-xs text-ink-subtle">{t(locale, 'duration_min')}</span>
              <input
                name="duration_minutes"
                type="number"
                min={0}
                step={15}
                defaultValue={engagement.duration_minutes ?? ''}
                className={INPUT}
              />
            </label>
          )}
        </div>
      </form>
    </Dialog>
  );
}
