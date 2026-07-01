'use client';

// The thread editor, thethread-v3 style: no tabs — the thread itself is the
// main item up top (inline-editable title, date chip, status, settings gear),
// and the engagements flow immediately under it as a vertical timeline with
// date badges on a left rail. Click a card to edit; dashed add-button with a
// type menu at the bottom. Thread settings live behind the gear in a dialog.

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Settings2,
  ExternalLink,
  Clock,
  MapPin,
  Video,
  Trash2,
  ChevronLeft,
} from 'lucide-react';
import { updateThread, deleteEngagement } from '../actions';
import { one, type ThreadRow, type EngagementRow, type EngagementType } from '@/lib/thread-types';
import { ENGAGEMENT_META, metaFor } from '@/lib/engagement-meta';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { EngagementDialog } from './engagements';
import { ThreadEditorForm } from './form';
import { RegistrationPanel } from './registration';
import { SectionLabel } from '@/components/ui/page';

const THREAD_HOST =
  process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://thread.thefibre.app';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-surface-sunken text-ink-subtle ring-line' },
  active: { label: 'Published', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  completed: { label: 'Completed', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  archived: { label: 'Archived', cls: 'bg-surface-sunken text-ink-muted ring-line' },
};

function whenOf(e: EngagementRow): string | null {
  return metaFor(e.type).family === 'activity' ? e.starts_at : e.scheduled_at;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

export function ThreadTimeline({
  thread,
  engagements,
}: {
  thread: ThreadRow;
  engagements: EngagementRow[];
}) {
  const router = useRouter();
  const program = one(thread.program);
  const organiser = one(thread.organiser);
  const [, startTransition] = useTransition();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editorState, setEditorState] = useState<
    | { mode: 'closed' }
    | { mode: 'new'; type: EngagementType }
    | { mode: 'edit'; engagement: EngagementRow }
  >({ mode: 'closed' });
  const [deleting, setDeleting] = useState<EngagementRow | null>(null);
  const [pendingDelete, startDelete] = useTransition();
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    function onDown(e: MouseEvent) {
      if (!addRef.current?.contains(e.target as Node)) setAddMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [addMenuOpen]);

  // Group: dated engagements by day (ascending), undated by position at the end.
  const { groups, undated } = useMemo(() => {
    const dated = engagements.filter((e) => whenOf(e));
    const undatedList = engagements
      .filter((e) => !whenOf(e))
      .sort((a, b) => a.position - b.position);
    dated.sort((a, b) => new Date(whenOf(a)!).getTime() - new Date(whenOf(b)!).getTime());
    const map = new Map<string, EngagementRow[]>();
    for (const e of dated) {
      const k = dayKey(whenOf(e)!);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return { groups: [...map.entries()], undated: undatedList };
  }, [engagements]);

  const status = program?.status ?? 'draft';
  const statusMeta = STATUS_META[status] ?? STATUS_META.draft;
  const publicUrl = `${THREAD_HOST}/${organiser?.slug}/${thread.slug}`;

  function setStatus(next: string) {
    startTransition(async () => {
      await updateThread(thread.id, { status: next });
      router.refresh();
    });
  }

  function saveTitle(title: string) {
    const t = title.trim();
    if (!t || t === program?.title) return;
    startTransition(async () => {
      await updateThread(thread.id, { title: t });
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    startDelete(async () => {
      await deleteEngagement(thread.id, target.id);
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div>
      {/* ── Main item: the thread itself ─────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link
          href="/threads"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle hover:text-ink hover:bg-surface-sunken shrink-0"
          title="All threads"
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </Link>

        {program?.starts_on && <DateChip iso={program.starts_on} />}

        <input
          key={program?.title}
          defaultValue={program?.title ?? ''}
          onBlur={(e) => saveTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="flex-1 min-w-0 bg-transparent text-2xl font-medium tracking-tight focus:outline-none rounded-md px-1 -mx-1 focus:bg-surface-raised focus:ring-1 focus:ring-line"
          aria-label="Thread title"
        />

        {/* Status pill (select disguised) */}
        <div className="relative shrink-0">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`appearance-none text-xs px-3 py-1.5 pr-7 rounded-full ring-1 cursor-pointer focus:outline-none ${statusMeta.cls}`}
            aria-label="Thread status"
          >
            <option value="draft">Draft</option>
            <option value="active">Published</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] opacity-60">
            ▾
          </span>
        </div>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle hover:text-ink hover:bg-surface-sunken shrink-0"
          title="Thread settings"
        >
          <Settings2 size={17} strokeWidth={1.75} />
        </button>
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle hover:text-ink hover:bg-surface-sunken shrink-0"
          title="Open public page"
        >
          <ExternalLink size={16} strokeWidth={1.75} />
        </a>
      </div>

      {thread.intention && (
        <p className="mt-2 ml-12 text-sm text-ink-subtle leading-relaxed max-w-xl">
          {thread.intention}
        </p>
      )}

      {/* ── Timeline ─────────────────────────────────────────────────── */}
      <div className="relative mt-8 ml-5 pl-11">
        {/* the vertical line */}
        <div className="absolute left-5 top-1 bottom-1 w-px bg-line" />

        {groups.length === 0 && undated.length === 0 && (
          <p className="text-sm text-ink-subtle py-6">
            Nothing on the timeline yet — add the first engagement below.
          </p>
        )}

        <div className="space-y-4">
          {groups.map(([key, items]) => (
            <div key={key} className="relative">
              <DateBadge iso={items[0] ? whenOf(items[0])! : key} />
              <div>
                {items.map((e, i) => (
                  <EngagementCard
                    key={e.id}
                    engagement={e}
                    attachTop={i > 0}
                    attachBottom={i < items.length - 1}
                    onEdit={() => setEditorState({ mode: 'edit', engagement: e })}
                    onDelete={() => setDeleting(e)}
                  />
                ))}
              </div>
            </div>
          ))}

          {undated.length > 0 && (
            <div className="relative">
              <div className="absolute -left-[57px] top-1 w-10 text-center">
                <div className="rounded-md border border-dashed border-line bg-surface-raised px-1 py-1.5 text-[9px] uppercase tracking-wide text-ink-muted leading-tight">
                  No date
                </div>
              </div>
              <div>
                {undated.map((e, i) => (
                  <EngagementCard
                    key={e.id}
                    engagement={e}
                    attachTop={i > 0}
                    attachBottom={i < undated.length - 1}
                    onEdit={() => setEditorState({ mode: 'edit', engagement: e })}
                    onDelete={() => setDeleting(e)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Add engagement ─────────────────────────────────────── */}
          <div ref={addRef} className="relative">
            <button
              type="button"
              onClick={() => setAddMenuOpen((o) => !o)}
              className="w-full rounded-lg border-2 border-dashed border-line hover:border-line-strong text-ink-subtle hover:text-ink py-3 text-sm inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={16} strokeWidth={1.75} />
              Add engagement
            </button>
            {addMenuOpen && (
              <div className="absolute z-40 mt-2 w-72 rounded-lg border border-line bg-surface-raised shadow-lg py-2">
                <TypeMenuSection
                  label="Activities"
                  family="activity"
                  onPick={(t) => {
                    setAddMenuOpen(false);
                    setEditorState({ mode: 'new', type: t });
                  }}
                />
                <div className="my-1 border-t border-line" />
                <TypeMenuSection
                  label="Messages"
                  family="message"
                  onPick={(t) => {
                    setAddMenuOpen(false);
                    setEditorState({ mode: 'new', type: t });
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────── */}
      {editorState.mode !== 'closed' && (
        <EngagementDialog
          threadId={thread.id}
          engagement={editorState.mode === 'edit' ? editorState.engagement : null}
          initialType={editorState.mode === 'new' ? editorState.type : undefined}
          onClose={() => setEditorState({ mode: 'closed' })}
        />
      )}

      {settingsOpen && (
        <Dialog
          open
          onClose={() => setSettingsOpen(false)}
          title="Thread settings"
          description="Basics, dates and the public registration form."
          size="xl"
        >
          <div className="space-y-10 pb-2">
            <ThreadEditorForm thread={thread} compact />
            <div>
              <SectionLabel>Registration</SectionLabel>
              <div className="mt-3">
                <RegistrationPanel
                  threadId={thread.id}
                  fields={thread.registration_fields ?? []}
                />
              </div>
            </div>
          </div>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Delete engagement"
        message={
          <>
            Delete <strong>{deleting?.title}</strong> from the timeline? This
            can&apos;t be undone.
          </>
        }
        confirmLabel="Delete"
        destructive
        pending={pendingDelete}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function DateChip({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <div className="w-10 shrink-0 rounded-md border border-line bg-surface-raised text-center py-1 leading-tight">
      <div className="text-[9px] uppercase tracking-wide text-ink-muted">
        {new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d)}
      </div>
      <div className="text-[15px] font-medium tabular-nums">{d.getDate()}</div>
    </div>
  );
}

function DateBadge({ iso }: { iso: string }) {
  const d = new Date(iso);
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(d);
  return (
    <div className="absolute -left-[57px] top-1 w-10 text-center" title={weekday}>
      <div className="rounded-md border border-line bg-surface-raised py-1 leading-tight">
        <div className="text-[9px] uppercase tracking-wide text-ink-muted">
          {new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d)}
        </div>
        <div className="text-[15px] font-medium tabular-nums">{d.getDate()}</div>
      </div>
    </div>
  );
}

function EngagementCard({
  engagement: e,
  attachTop,
  attachBottom,
  onEdit,
  onDelete,
}: {
  engagement: EngagementRow;
  attachTop: boolean;
  attachBottom: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = metaFor(e.type);
  const when = whenOf(e);
  const rounded = `${attachTop ? 'rounded-t-none border-t-0' : 'rounded-t-lg'} ${
    attachBottom ? 'rounded-b-none' : 'rounded-b-lg'
  }`;

  return (
    <div className="relative group">
      {/* type dot on the line */}
      <span
        className={`absolute -left-[27.5px] top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full ring-2 ring-surface-sunken ${meta.dot}`}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') onEdit();
        }}
        className={`w-full text-left border border-line bg-surface-raised px-4 py-3 cursor-pointer hover:shadow-sm hover:border-line-strong transition-all ${rounded}`}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] text-ink-muted">
              <span>{meta.label}</span>
              {e.status !== 'published' && (
                <span className="px-1.5 py-px rounded-full ring-1 ring-line bg-surface-sunken capitalize">
                  {e.status}
                </span>
              )}
              {meta.family === 'message' && when && <span>Sends {fmtTime(when)}</span>}
            </div>
            <div className="mt-0.5 text-[15px] font-medium truncate">{e.title}</div>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-subtle shrink-0">
            {meta.family === 'activity' && when && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock size={12} strokeWidth={1.75} />
                {fmtTime(when)}
                {e.ends_at && ` – ${fmtTime(e.ends_at)}`}
              </span>
            )}
            {e.location && (
              <span className="hidden sm:inline-flex items-center gap-1 max-w-[140px] truncate">
                <MapPin size={12} strokeWidth={1.75} />
                {e.location}
              </span>
            )}
            {e.meeting_url && (
              <span className="inline-flex items-center gap-1">
                <Video size={12} strokeWidth={1.75} />
                Online
              </span>
            )}
            <button
              type="button"
              aria-label="Delete"
              onClick={(ev) => {
                ev.stopPropagation();
                onDelete();
              }}
              className="opacity-0 group-hover:opacity-100 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken transition-opacity"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypeMenuSection({
  label,
  family,
  onPick,
}: {
  label: string;
  family: 'activity' | 'message';
  onPick: (t: EngagementType) => void;
}) {
  return (
    <div>
      <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      {ENGAGEMENT_META.filter((m) => m.family === family).map((m) => (
        <button
          key={m.type}
          type="button"
          onClick={() => onPick(m.type)}
          className="w-full text-left px-3 py-1.5 flex items-center gap-2.5 hover:bg-surface-sunken text-sm"
        >
          <span className={`h-2 w-2 rounded-full ${m.dot}`} />
          <span className="flex-1">{m.label}</span>
        </button>
      ))}
    </div>
  );
}
