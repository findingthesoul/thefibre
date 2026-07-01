'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Video,
  MapPin,
  Clock,
} from 'lucide-react';
import {
  createEngagement,
  updateEngagement,
  deleteEngagement,
  moveEngagement,
} from '../actions';
import type { EngagementRow, EngagementType } from '@/lib/thread-types';
import {
  ENGAGEMENT_META,
  metaFor,
  type EngagementFamily,
} from '@/lib/engagement-meta';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { TextField, TextAreaField, SelectField } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionLabel } from '@/components/ui/page';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-surface-sunken text-ink-subtle ring-line',
  published: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-surface-sunken text-ink-muted ring-line',
};

function fmtDateTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** ISO → value for <input type="datetime-local"> in the browser's zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

export function EngagementsPanel({
  threadId,
  engagements,
}: {
  threadId: string;
  engagements: EngagementRow[];
}) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<EngagementRow | null>(null);
  const [deleting, setDeleting] = useState<EngagementRow | null>(null);
  const [pending, startTransition] = useTransition();

  const sorted = useMemo(
    () => [...engagements].sort((a, b) => a.position - b.position),
    [engagements],
  );

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(e: EngagementRow) {
    setEditing(e);
    setEditorOpen(true);
  }

  function onMove(index: number, dir: -1 | 1) {
    const a = sorted[index];
    const b = sorted[index + dir];
    if (!a || !b) return;
    startTransition(async () => {
      await moveEngagement(threadId, a, b);
      router.refresh();
    });
  }

  function onDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      await deleteEngagement(threadId, target.id);
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <SectionLabel>Timeline</SectionLabel>
        <Button size="sm" variant="secondary" leading={<Plus size={15} />} onClick={openNew}>
          Add engagement
        </Button>
      </div>

      {sorted.length === 0 && (
        <EmptyState>
          Nothing on the timeline yet. Activities (events, conversations,
          workshops) carry a time and place; messages (reflections, practices,
          documents…) are sent to participants at a scheduled moment.
        </EmptyState>
      )}

      {sorted.length > 0 && (
        <ul className="mt-3 space-y-2">
          {sorted.map((e, i) => {
            const meta = metaFor(e.type);
            const Icon = meta.icon;
            const when =
              meta.family === 'activity'
                ? fmtDateTime(e.starts_at)
                : e.scheduled_at
                  ? `Sends ${fmtDateTime(e.scheduled_at)}`
                  : 'Not scheduled';
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-lg border border-line bg-surface-raised px-3.5 py-3"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunken ring-1 ring-line shrink-0">
                  <Icon size={16} strokeWidth={1.75} className="text-ink-subtle" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{e.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ring-1 capitalize shrink-0 ${
                        STATUS_STYLES[e.status] ?? STATUS_STYLES.draft
                      }`}
                    >
                      {e.status}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-ink-subtle">
                    <span>{meta.label}</span>
                    {when && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} strokeWidth={1.75} />
                        {when}
                      </span>
                    )}
                    {e.meeting_url && (
                      <span className="inline-flex items-center gap-1">
                        <Video size={11} strokeWidth={1.75} />
                        Online
                      </span>
                    )}
                    {e.location && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin size={11} strokeWidth={1.75} />
                        {e.location}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <IconBtn
                    label="Move up"
                    disabled={i === 0 || pending}
                    onClick={() => onMove(i, -1)}
                  >
                    <ChevronUp size={15} />
                  </IconBtn>
                  <IconBtn
                    label="Move down"
                    disabled={i === sorted.length - 1 || pending}
                    onClick={() => onMove(i, 1)}
                  >
                    <ChevronDown size={15} />
                  </IconBtn>
                  <IconBtn label="Edit" onClick={() => openEdit(e)}>
                    <Pencil size={15} />
                  </IconBtn>
                  <IconBtn label="Delete" onClick={() => setDeleting(e)}>
                    <Trash2 size={15} />
                  </IconBtn>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editorOpen && (
        <EngagementDialog
          threadId={threadId}
          engagement={editing}
          onClose={() => setEditorOpen(false)}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={onDelete}
        title="Delete engagement"
        message={
          <>
            Delete <strong>{deleting?.title}</strong> from the timeline? This
            can&apos;t be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        pending={pending}
      />
    </div>
  );
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Add / edit dialog
// ---------------------------------------------------------------------------

function EngagementDialog({
  threadId,
  engagement,
  onClose,
}: {
  threadId: string;
  engagement: EngagementRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const isNew = !engagement;
  const [type, setType] = useState<EngagementType>(engagement?.type ?? 'event');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const meta = metaFor(type);
  const family: EngagementFamily = meta.family;
  // Editing: only offer types within the same family (API enforces it too).
  const typeOptions = ENGAGEMENT_META.filter((m) =>
    isNew ? true : m.family === metaFor(engagement.type).family,
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
      title={isNew ? 'Add engagement' : `Edit — ${engagement.title}`}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {isNew && (
          <div>
            <SectionLabel>Type</SectionLabel>
            <div className="mt-2 space-y-3">
              <TypePickerRow
                label="Activities"
                items={ENGAGEMENT_META.filter((m) => m.family === 'activity')}
                current={type}
                onPick={setType}
              />
              <TypePickerRow
                label="Messages"
                items={ENGAGEMENT_META.filter((m) => m.family === 'message')}
                current={type}
                onPick={setType}
              />
            </div>
            <p className="mt-2 text-xs text-ink-muted">{meta.description}</p>
          </div>
        )}

        {!isNew && (
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Type"
              name="type_display"
              value={type}
              onChange={(e) => setType(e.target.value as EngagementType)}
              options={typeOptions.map((m) => ({ value: m.type, label: m.label }))}
              hint="Only types within the same family."
            />
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
          </div>
        )}

        <TextField label="Title" name="title" defaultValue={engagement?.title ?? ''} required />
        <TextAreaField
          label="Description"
          name="description"
          rows={2}
          defaultValue={engagement?.description ?? ''}
        />

        {family === 'activity' ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Starts"
                name="starts_at"
                type="datetime-local"
                defaultValue={toLocalInput(engagement?.starts_at ?? null)}
              />
              <TextField
                label="Ends"
                name="ends_at"
                type="datetime-local"
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
            <TextField
              label="Send at"
              name="scheduled_at"
              type="datetime-local"
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

function TypePickerRow({
  label,
  items,
  current,
  onPick,
}: {
  label: string;
  items: { type: EngagementType; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }[];
  current: EngagementType;
  onPick: (t: EngagementType) => void;
}) {
  return (
    <div>
      <div className="text-xs text-ink-muted mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((m) => {
          const Icon = m.icon;
          const active = m.type === current;
          return (
            <button
              key={m.type}
              type="button"
              onClick={() => onPick(m.type)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
                active
                  ? 'border-ink bg-surface-sunken'
                  : 'border-line bg-surface hover:bg-surface-sunken'
              }`}
            >
              <Icon size={14} strokeWidth={1.75} className="text-ink-subtle" />
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type-specific message content (kept deliberately simple in Phase 2)
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
