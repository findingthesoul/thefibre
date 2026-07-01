'use client';

// The engagement add/edit dialog. The timeline (timeline.tsx) opens it —
// either blank with a preselected type (from the add-menu) or loaded with
// an existing engagement.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createEngagement, updateEngagement } from '../actions';
import type { EngagementRow, EngagementType } from '@/lib/thread-types';
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

export function EngagementDialog({
  threadId,
  engagement,
  initialType,
  onClose,
}: {
  threadId: string;
  engagement: EngagementRow | null;
  /** Preselected type when creating (from the timeline's add-menu). */
  initialType?: EngagementType;
  onClose: () => void;
}) {
  const router = useRouter();
  const isNew = !engagement;
  const [type, setType] = useState<EngagementType>(
    engagement?.type ?? initialType ?? 'event',
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
            scheduled_at: fromLocalInput(String(fd.get('scheduled_at') ?? '')),
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
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
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
          rows={2}
          defaultValue={engagement?.description ?? ''}
        />

        {family === 'activity' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateTimeField
                label="Starts"
                name="starts_at"
                defaultValue={toLocalInput(engagement?.starts_at ?? null)}
              />
              <DateTimeField
                label="Ends"
                name="ends_at"
                defaultValue={toLocalInput(engagement?.ends_at ?? null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            <DateTimeField
              label="Send at"
              name="scheduled_at"
              defaultValue={toLocalInput(engagement?.scheduled_at ?? null)}
              hint="When this goes out to enrolled participants. Leave empty to keep it unscheduled."
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

        {error && (
          <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : isNew ? 'Add to timeline' : 'Save'}
          </Button>
        </div>
      </form>
    </Dialog>
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
