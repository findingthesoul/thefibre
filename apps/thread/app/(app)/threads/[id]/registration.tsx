'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { updateThread } from '../actions';
import type { RegistrationField } from '@/lib/thread-types';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionLabel } from '@/components/ui/page';

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
  threadId,
  fields: initial,
  sharePublic: initialSharePublic = false,
  shareParticipants: initialShareParticipants = false,
  onSaved,
}: {
  threadId: string;
  fields: RegistrationField[];
  sharePublic?: boolean;
  shareParticipants?: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<RegistrationField[]>(initial);
  const [sharePublic, setSharePublic] = useState(initialSharePublic);
  const [shareParticipants, setShareParticipants] = useState(initialShareParticipants);
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

  function onSave() {
    setError(null);
    const taken = new Set<string>();
    const cleaned: RegistrationField[] = [];
    for (const f of fields) {
      const label = f.label.trim();
      if (!label) return setError('Every question needs a label.');
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
      });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
      onSaved?.();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <SectionLabel>Registration questions</SectionLabel>
        <Button size="sm" variant="secondary" leading={<Plus size={15} />} onClick={addField}>
          Add question
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Asked on the public enrolment form, after name and email. Answers stay
        in The Thread — they never cross to the platform timeline.
      </p>

      {fields.length === 0 && (
        <EmptyState>No extra questions — enrolment asks only name and email.</EmptyState>
      )}

      {fields.length > 0 && (
        <ul className="mt-4 space-y-3">
          {fields.map((f, i) => (
            <li key={i} className="rounded-lg border border-line bg-surface-raised p-3.5">
              <div className="flex items-start gap-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_150px_auto] gap-3 items-center">
                  <input
                    className={INPUT}
                    placeholder="Question label"
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
                    <option value="short">Short answer</option>
                    <option value="long">Long answer</option>
                    <option value="select">Choice</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-ink-subtle whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={f.required}
                      onChange={(e) => patch(i, { required: e.target.checked })}
                    />
                    Required
                  </label>
                </div>
                <button
                  type="button"
                  aria-label="Remove question"
                  onClick={() => removeField(i)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              {f.type === 'select' && (
                <input
                  className={`${INPUT} mt-2.5`}
                  placeholder="Options, comma-separated"
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
        <SectionLabel>Participant visibility</SectionLabel>
        <p className="mt-2 text-xs text-ink-muted">
          Names show only for people who tick “show my name” when they enrol — opt-in, never
          default.
        </p>
        <div className="mt-3 space-y-2.5">
          <label className="flex items-start gap-2 text-sm text-ink-subtle">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={sharePublic}
              onChange={(e) => {
                setSharePublic(e.target.checked);
                setSaved(false);
              }}
            />
            <span>
              Share participants <strong>publicly</strong> — a “Who&apos;s coming” list on the
              public thread page (first name + initial).
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink-subtle">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={shareParticipants}
              onChange={(e) => {
                setShareParticipants(e.target.checked);
                setSaved(false);
              }}
            />
            <span>
              Share participants <strong>with other participants</strong> — the cohort sees each
              other on their personal page.
            </span>
          </label>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={onSave} disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="text-sm text-ink-subtle">Saved.</span>}
      </div>
    </div>
  );
}
