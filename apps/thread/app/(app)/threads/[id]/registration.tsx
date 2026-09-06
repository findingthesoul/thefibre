'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { updateThread } from '../actions';
import type { RegistrationField } from '@/lib/thread-types';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionLabel } from '@/components/ui/page';
import { SwitchField } from '@/components/ui/switch';

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted';

function keyFromLabel(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'field';
  let key = base;
  let i = 2;
  while (taken.has(key)) key = `${base}_${i++}`;
  return key;
}

export function RegistrationPanel({
  locale,
  threadId,
  fields: initial,
  sharePublic: initialSharePublic = false,
  shareParticipants: initialShareParticipants = false,
  requiresApproval: initialRequiresApproval = false,
  enrolmentNote: initialNote = null,
  workspaceNote = null,
  onSaved,
}: {
  locale: Locale;
  threadId: string;
  fields: RegistrationField[];
  sharePublic?: boolean;
  shareParticipants?: boolean;
  requiresApproval?: boolean;
  /** This thread's own words. Null means it uses the workspace's. */
  enrolmentNote?: string | null;
  /** The workspace default, shown so you can see what you are replacing. */
  workspaceNote?: string | null;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<RegistrationField[]>(initial);
  const [sharePublic, setSharePublic] = useState(initialSharePublic);
  const [shareParticipants, setShareParticipants] = useState(initialShareParticipants);
  const [requiresApproval, setRequiresApproval] = useState(initialRequiresApproval);
  // Null and '' are different answers: null inherits the workspace's note, ''
  // says this thread deliberately adds nothing. A textarea cannot express both,
  // so the switch carries the distinction.
  const [ownNote, setOwnNote] = useState(initialNote !== null && initialNote !== undefined);
  const [note, setNote] = useState(initialNote ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function patch(i: number, p: Partial<RegistrationField>) {
    setFields((f) => f.map((x, j) => (j === i ? { ...x, ...p } : x)));
    setSaved(false);
  }

  function addField() {
    const taken = new Set(fields.map((f) => f.key));
    setFields((f) => [
      ...f,
      { key: keyFromLabel('New question', taken), label: '', type: 'short', required: false },
    ]);
    setSaved(false);
  }

  function removeField(i: number) {
    setFields((f) => f.filter((_, j) => j !== i));
    setSaved(false);
  }

  function onSave(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setError(null);
    const taken = new Set<string>();
    const cleaned: RegistrationField[] = [];
    for (const f of fields) {
      const label = f.label.trim();
      if (!label) return setError(t(locale, 'err_question_label'));
      const key = f.key || keyFromLabel(label, taken);
      taken.add(key);
      cleaned.push({
        key,
        label,
        type: f.type,
        required: f.required,
        ...(f.type === 'select'
          ? { options: (f.options ?? []).map((o) => o.trim()).filter(Boolean) }
          : {}),
      });
    }
    startTransition(async () => {
      const r = await updateThread(threadId, {
        registration_fields: cleaned,
        share_participants_public: sharePublic,
        share_participants_participants: shareParticipants,
        requires_approval: requiresApproval,
        enrolment_note: ownNote ? note : null,
      });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
      onSaved?.();
    });
  }

  return (
    // Saved from the shared dialog footer (submits by form id).
    <form id="thread-registration-form" onSubmit={onSave}>
      <div className="flex items-center justify-between">
        <SectionLabel>{t(locale, 'registration_questions')}</SectionLabel>
        <Button type="button" size="sm" variant="secondary" leading={<Plus size={15} />} onClick={addField}>
          {t(locale, 'add_question')}
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-muted">{t(locale, 'reg_questions_note')}</p>

      {fields.length === 0 && (
        <EmptyState>{t(locale, 'reg_no_questions')}</EmptyState>
      )}

      {fields.length > 0 && (
        <ul className="mt-4 space-y-3">
          {fields.map((f, i) => (
            <li key={i} className="rounded-lg border border-line bg-surface-raised p-3.5">
              <div className="flex items-start gap-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_150px_auto] gap-3 items-center">
                  <input
                    className={INPUT}
                    placeholder={t(locale, 'question_label_placeholder')}
                    value={f.label}
                    onChange={(e) => patch(i, { label: e.target.value })}
                  />
                  <select
                    className={INPUT}
                    value={f.type}
                    onChange={(e) =>
                      patch(i, { type: e.target.value as RegistrationField['type'] })
                    }
                  >
                    <option value="short">{t(locale, 'q_short')}</option>
                    <option value="long">{t(locale, 'q_long')}</option>
                    <option value="select">{t(locale, 'q_choice')}</option>
                    <option value="checkbox">{t(locale, 'q_checkbox')}</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-ink-subtle whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => patch(i, { required: e.target.checked })}
                    />
                    {t(locale, 'required')}
                  </label>
                </div>
                <button
                  type="button"
                  aria-label={t(locale, 'remove_question')}
                  onClick={() => removeField(i)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {f.type === 'select' && (
                <input
                  className={`${INPUT} mt-2.5`}
                  placeholder={t(locale, 'options_comma')}
                  value={(f.options ?? []).join(', ')}
                  onChange={(e) =>
                    patch(i, { options: e.target.value.split(',').map((s) => s.trimStart()) })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <SectionLabel>{t(locale, 'approval')}</SectionLabel>
        <div className="mt-3">
          <SwitchField
            label={
              <>
                <strong>{t(locale, 'approval_required_strong')}</strong>{' '}
                {t(locale, 'approval_required_rest')}
              </>
            }
            checked={requiresApproval}
            onChange={(v) => {
              setRequiresApproval(v);
              setSaved(false);
            }}
          />
        </div>
      </div>

      <div className="mt-8">
        <SectionLabel>{t(locale, 'participant_visibility')}</SectionLabel>
        <p className="mt-2 text-xs text-ink-muted">{t(locale, 'visibility_note')}</p>
        <div className="mt-3 space-y-2.5">
          <SwitchField
            label={
              <>
                {t(locale, 'share_participants_pre')}{' '}
                <strong>{t(locale, 'share_publicly_strong')}</strong>{' '}
                {t(locale, 'share_publicly_rest')}
              </>
            }
            checked={sharePublic}
            onChange={(v) => {
              setSharePublic(v);
              setSaved(false);
            }}
          />
          <SwitchField
            label={
              <>
                {t(locale, 'share_participants_pre')}{' '}
                <strong>{t(locale, 'share_with_participants_strong')}</strong>{' '}
                {t(locale, 'share_with_participants_rest')}
              </>
            }
            checked={shareParticipants}
            onChange={(v) => {
              setShareParticipants(v);
              setSaved(false);
            }}
          />
        </div>
      </div>

      <div className="mt-8">
        <SectionLabel>{t(locale, 'your_words')}</SectionLabel>
        <p className="mt-2 text-xs text-ink-muted">{t(locale, 'your_words_note')}</p>
        <div className="mt-3 space-y-3">
          <SwitchField
            label={<>{t(locale, 'write_for_thread')}</>}
            checked={ownNote}
            onChange={(v) => {
              setOwnNote(v);
              setSaved(false);
            }}
          />
          {ownNote ? (
            <textarea
              className={INPUT}
              rows={6}
              value={note}
              placeholder={t(locale, 'welcome_placeholder')}
              onChange={(e) => {
                setNote(e.target.value);
                setSaved(false);
              }}
            />
          ) : (
            <p className="rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm whitespace-pre-wrap text-ink-subtle">
              {workspaceNote?.trim()
                ? workspaceNote
                : t(locale, 'no_workspace_note')}
            </p>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {(pending || saved) && (
        <p className="mt-4 text-sm text-ink-subtle">
          {pending ? t(locale, 'saving') : t(locale, 'saved')}
        </p>
      )}
    </form>
  );
}
