'use client';

// The engagement add/edit dialog. The timeline (timeline.tsx) opens it —
// either blank with a preselected type (from the add-menu) or loaded with
// an existing engagement.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createEngagement, updateEngagement } from '../actions';
import type { EngagementRow, EngagementType, TriggerKind } from '@/lib/thread-types';
import {
  ENGAGEMENT_META,
  metaFor,
  type EngagementFamily,
} from '@/lib/engagement-meta';
import { Dialog } from '@/components/ui/dialog';
import { TextField, TextAreaField, SelectField } from '@/components/ui/field';
import { DateTimeField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';

/** ISO → value for <input type="datetime-local"> in the browser's zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

const TRIGGER_DAY_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '10', '14', '21', '30'];
const TRIGGER_TIME_OPTIONS = Array.from({ length: 15 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);

export function EngagementDialog({
  threadId,
  engagement,
  initialType,
  threadStartsOn,
  threadEndsOn,
  requiresApproval,
  onClose,
}: {
  threadId: string;
  engagement: EngagementRow | null;
  /** Preselected type when creating (from the timeline's add-menu). */
  initialType?: EngagementType;
  /** Thread window — activities must fall inside it. */
  threadStartsOn?: string | null;
  threadEndsOn?: string | null;
  /** Only threads with approval offer the on_approval trigger. */
  requiresApproval?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isNew = !engagement;
  const [type, setType] = useState<EngagementType>(
    engagement?.type ?? initialType ?? 'event',
  );
  const [triggerKind, setTriggerKind] = useState<TriggerKind>(
    engagement?.trigger_kind ?? 'fixed',
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const meta = metaFor(type);
  const family: EngagementFamily = meta.family;
  // Editing: only offer types within the same family (API enforces it too).
  const typeOptions = ENGAGEMENT_META.filter((m) =>
    isNew ? m.family === family : m.family === metaFor(engagement.type).family,
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return setError('Give it a title.');

    const common = {
      title,
      type,
      description: String(fd.get('description') ?? '').trim() || null,
      show_in_agenda: fd.get('show_in_agenda') === 'on',
    };
    // Message trigger fields — one shape per kind, everything else nulled
    // so switching kinds never leaves stale values behind.
    const trigger: Record<string, unknown> = {
      trigger_kind: triggerKind,
      trigger_anchor: null,
      trigger_offset_days: null,
      trigger_time: null,
      scheduled_at: null,
    };
    if (triggerKind === 'fixed') {
      trigger.scheduled_at = fromLocalInput(String(fd.get('scheduled_at') ?? ''));
    } else if (triggerKind === 'relative') {
      const days = Number(fd.get('trigger_days') ?? 3);
      const direction = String(fd.get('trigger_direction') ?? 'before');
      trigger.trigger_anchor = String(fd.get('trigger_anchor') ?? 'start');
      trigger.trigger_offset_days = direction === 'before' ? -days : days;
      trigger.trigger_time = String(fd.get('trigger_time') ?? '09:00');
    }

    const payload =
      family === 'activity'
        ? {
            ...common,
            starts_at: fromLocalInput(String(fd.get('starts_at') ?? '')),
            ends_at: fromLocalInput(String(fd.get('ends_at') ?? '')),
            location: String(fd.get('location') ?? '').trim() || null,
            meeting_url: String(fd.get('meeting_url') ?? '').trim() || null,
          }
        : {
            ...common,
            ...trigger,
            content: contentFromForm(type, fd),
          };

    startTransition(async () => {
      const r = isNew
        ? await createEngagement(threadId, payload)
        : await updateEngagement(threadId, engagement.id, {
            ...payload,
            status: String(fd.get('status') ?? 'draft'),
          });
      if (!r.ok) return setError(r.error);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? `Add ${meta.label.toLowerCase()}` : `Edit — ${engagement.title}`}
      size="xl"
      footer={
        <>
          {error && (
            <span className="mr-auto text-sm text-red-700 truncate max-w-md">{error}</span>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="engagement-form" disabled={pending}>
            {pending ? 'Saving…' : isNew ? 'Add to timeline' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="engagement-form" onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SelectField
            label="Type"
            name="type_display"
            value={type}
            onChange={(e) => setType(e.target.value as EngagementType)}
            options={typeOptions.map((m) => ({ value: m.type, label: m.label }))}
            hint={isNew ? meta.description : 'Only types within the same family.'}
          />
          {!isNew && (
            <SelectField
              label="Status"
              name="status"
              defaultValue={engagement.status}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
                { value: 'closed', label: 'Closed' },
              ]}
            />
          )}
        </div>

        <TextField label="Title" name="title" defaultValue={engagement?.title ?? ''} required />
        <TextAreaField
          label="Description"
          name="description"
          rows={3}
          defaultValue={engagement?.description ?? ''}
        />

        {family === 'activity' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <DateTimeField
                label="Starts"
                name="starts_at"
                defaultValue={toLocalInput(engagement?.starts_at ?? null)}
                min={threadStartsOn}
                max={threadEndsOn}
                hint={
                  threadStartsOn || threadEndsOn
                    ? `Within the thread dates${threadStartsOn ? ` (${threadStartsOn}` : ''}${threadEndsOn ? ` → ${threadEndsOn})` : threadStartsOn ? ')' : ''}`
                    : undefined
                }
              />
              <DateTimeField
                label="Ends"
                name="ends_at"
                defaultValue={toLocalInput(engagement?.ends_at ?? null)}
                min={threadStartsOn}
                max={threadEndsOn}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <TextField
                label="Location"
                name="location"
                placeholder="Venue or address"
                defaultValue={engagement?.location ?? ''}
              />
              <TextField
                label="Meeting link"
                name="meeting_url"
                type="url"
                placeholder="Zoom, Teams or Meet URL"
                defaultValue={engagement?.meeting_url ?? ''}
              />
            </div>
          </>
        ) : (
          <>
            <TriggerFields
              triggerKind={triggerKind}
              onKindChange={setTriggerKind}
              engagement={engagement}
              requiresApproval={requiresApproval ?? false}
            />
            <MessageContentFields type={type} content={engagement?.content ?? {}} />
          </>
        )}

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="show_in_agenda"
            defaultChecked={engagement?.show_in_agenda ?? true}
          />
          <span className="text-sm text-ink-subtle">Show on the public agenda</span>
        </label>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// "When to send" — the message-family trigger control (Sjoerd 2026-07-02).
// ---------------------------------------------------------------------------

function TriggerFields({
  triggerKind,
  onKindChange,
  engagement,
  requiresApproval,
}: {
  triggerKind: TriggerKind;
  onKindChange: (k: TriggerKind) => void;
  engagement: EngagementRow | null;
  requiresApproval: boolean;
}) {
  const off = engagement?.trigger_offset_days ?? -3;
  const defaultDays = String(Math.min(30, Math.max(1, Math.abs(off || 3))));
  const defaultDirection = (engagement?.trigger_offset_days ?? -3) < 0 ? 'before' : 'after';
  const defaultAnchor = engagement?.trigger_anchor ?? 'start';
  const defaultTime = engagement?.trigger_time ?? '09:00';

  const kindOptions = [
    { value: 'fixed', label: 'On a fixed date' },
    { value: 'relative', label: 'Relative to the thread dates' },
    { value: 'on_enrolment', label: 'When someone enrols' },
    ...(requiresApproval
      ? [{ value: 'on_approval', label: 'When their enrolment is approved' }]
      : []),
    { value: 'on_completion', label: 'When they complete the thread' },
  ];

  return (
    <div className="rounded-lg border border-line bg-surface-sunken/50 p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <SelectField
          label="When to send"
          name="trigger_kind_display"
          value={triggerKind}
          onChange={(e) => onKindChange(e.target.value as TriggerKind)}
          options={kindOptions}
        />
        {triggerKind === 'fixed' && (
          <DateTimeField
            label="Send at"
            name="scheduled_at"
            defaultValue={toLocalInput(engagement?.scheduled_at ?? null)}
            hint="Leave empty to keep it unscheduled."
          />
        )}
      </div>

      {triggerKind === 'relative' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SelectField
            label="Days"
            name="trigger_days"
            defaultValue={defaultDays}
            options={TRIGGER_DAY_OPTIONS.map((d) => ({
              value: d,
              label: `${d} day${d === '1' ? '' : 's'}`,
            }))}
          />
          <SelectField
            label="Direction"
            name="trigger_direction"
            defaultValue={defaultDirection}
            options={[
              { value: 'before', label: 'before' },
              { value: 'after', label: 'after' },
            ]}
          />
          <SelectField
            label="Anchor"
            name="trigger_anchor"
            defaultValue={defaultAnchor}
            options={[
              { value: 'start', label: 'thread start' },
              { value: 'end', label: 'thread end' },
            ]}
          />
          <SelectField
            label="At"
            name="trigger_time"
            defaultValue={defaultTime}
            options={TRIGGER_TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
          />
        </div>
      )}

      {(triggerKind === 'on_enrolment' ||
        triggerKind === 'on_approval' ||
        triggerKind === 'on_completion') && (
        <p className="text-xs text-ink-muted">
          Sent automatically to each participant the moment it happens — no
          date needed.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type-specific message content (kept deliberately simple)
// ---------------------------------------------------------------------------

function contentFromForm(type: EngagementType, fd: FormData): Record<string, unknown> {
  switch (type) {
    case 'reflection':
      return {
        questions: String(fd.get('questions') ?? '')
          .split('\n')
          .map((q) => q.trim())
          .filter(Boolean),
      };
    case 'practice':
      return {
        assignments: String(fd.get('assignments') ?? '')
          .split('\n')
          .map((a) => a.trim())
          .filter(Boolean),
      };
    case 'document':
      return {
        external_url: String(fd.get('external_url') ?? '').trim() || null,
        body: String(fd.get('body') ?? '').trim() || null,
      };
    case 'inspiration':
      return {
        body: String(fd.get('body') ?? '').trim() || null,
        external_url: String(fd.get('external_url') ?? '').trim() || null,
      };
    case 'message':
    default:
      return { body: String(fd.get('body') ?? '').trim() || null };
  }
}

function MessageContentFields({
  type,
  content,
}: {
  type: EngagementType;
  content: Record<string, unknown>;
}) {
  const str = (k: string) => (typeof content[k] === 'string' ? (content[k] as string) : '');
  const lines = (k: string) =>
    Array.isArray(content[k]) ? (content[k] as string[]).join('\n') : '';

  switch (type) {
    case 'reflection':
      return (
        <TextAreaField
          label="Questions"
          name="questions"
          rows={4}
          defaultValue={lines('questions')}
          hint="One question per line."
        />
      );
    case 'practice':
      return (
        <TextAreaField
          label="Assignments"
          name="assignments"
          rows={4}
          defaultValue={lines('assignments')}
          hint="One assignment per line."
        />
      );
    case 'document':
      return (
        <>
          <TextField
            label="Link"
            name="external_url"
            type="url"
            placeholder="https://…"
            defaultValue={str('external_url')}
          />
          <TextAreaField label="Note" name="body" rows={2} defaultValue={str('body')} />
        </>
      );
    case 'inspiration':
      return (
        <>
          <TextAreaField label="Text" name="body" rows={3} defaultValue={str('body')} />
          <TextField
            label="Link (optional)"
            name="external_url"
            type="url"
            placeholder="https://…"
            defaultValue={str('external_url')}
          />
        </>
      );
    case 'message':
    default:
      return (
        <TextAreaField
          label="Body"
          name="body"
          rows={5}
          defaultValue={str('body')}
          hint="Tokens: {name}, {thread}, {organiser}, {date} — replaced per participant when sent."
        />
      );
  }
}
