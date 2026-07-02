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
  Settings,
  ExternalLink,
  Clock,
  MapPin,
  Video,
  ChevronLeft,
  Users,
  X,
} from 'lucide-react';
import { updateThread, updateEngagement, addThreadMember, removeThreadMember } from '../actions';
import {
  one,
  type ThreadRow,
  type EngagementRow,
  type EngagementType,
  type ThreadMember,
  type WorkspaceMember,
  type TeamOption,
} from '@/lib/thread-types';
import { ENGAGEMENT_META, metaFor } from '@/lib/engagement-meta';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DateTimeField } from '@/components/ui/date-field';
import { EngagementDialog, toLocalInput } from './engagements';
import { ThreadEditorForm } from './form';
import { RegistrationPanel } from './registration';
import { PricingPanel } from './pricing-panel';
import { CertificatePanel } from './certificate-panel';

const THREAD_HOST =
  process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://thread.thefibre.app';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-surface-sunken text-ink-subtle ring-line' },
  active: { label: 'Published', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  completed: { label: 'Completed', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  archived: { label: 'Archived', cls: 'bg-surface-sunken text-ink-muted ring-line' },
};

const LIFECYCLE_LABELS: Record<string, string> = {
  on_enrolment: 'On enrolment',
  on_approval: 'On approval',
  on_completion: 'On completion',
};

/**
 * Where an engagement sits in time. Activities use starts_at; fixed messages
 * use scheduled_at; relative messages compute from the thread window;
 * lifecycle-triggered messages have no date (they live in the Triggered group).
 */
function whenOf(
  e: EngagementRow,
  window?: { starts_on: string | null; ends_on: string | null } | null,
  byId?: Map<string, EngagementRow>,
): string | null {
  if (metaFor(e.type).family === 'activity') return e.starts_at;
  const kind = e.trigger_kind ?? 'fixed';
  if (kind === 'fixed') return e.scheduled_at;
  if (kind === 'relative') {
    let anchorDate: string | null = null;
    if (e.trigger_anchor === 'engagement' && e.trigger_engagement_id) {
      const target = byId?.get(e.trigger_engagement_id);
      anchorDate = target?.starts_at ? target.starts_at.slice(0, 10) : null;
    } else {
      anchorDate = e.trigger_anchor === 'end' ? window?.ends_on ?? null : window?.starts_on ?? null;
    }
    if (!anchorDate) return null;
    const d = new Date(`${anchorDate}T${e.trigger_time ?? '09:00'}:00`);
    d.setDate(d.getDate() + (e.trigger_offset_days ?? 0));
    return d.toISOString();
  }
  return null; // lifecycle triggers
}

function isLifecycle(e: EngagementRow): boolean {
  return e.trigger_kind in LIFECYCLE_LABELS;
}

/** Short human label for a message card's trigger. */
function triggerLabel(e: EngagementRow, byId?: Map<string, EngagementRow>): string | null {
  const kind = e.trigger_kind ?? 'fixed';
  if (kind === 'fixed') return e.scheduled_at ? `Sends ${fmtTime(e.scheduled_at)}` : 'Unscheduled';
  if (kind === 'relative') {
    const n = Math.abs(e.trigger_offset_days ?? 0);
    const dir = (e.trigger_offset_days ?? 0) < 0 ? 'before' : 'after';
    const anchorLabel =
      e.trigger_anchor === 'engagement'
        ? byId?.get(e.trigger_engagement_id ?? '')?.title ?? 'event'
        : e.trigger_anchor === 'end'
          ? 'end'
          : 'start';
    return `${n}d ${dir} ${anchorLabel} · ${e.trigger_time ?? '09:00'}`;
  }
  return LIFECYCLE_LABELS[kind] ?? null;
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
  members,
  workspaceMembers,
  teams,
  certTemplates,
  personalRoomUrl,
}: {
  thread: ThreadRow;
  engagements: EngagementRow[];
  members: ThreadMember[];
  workspaceMembers: WorkspaceMember[];
  teams: TeamOption[];
  certTemplates: { id: string; name: string }[];
  personalRoomUrl: string | null;
}) {
  const router = useRouter();
  const program = one(thread.program);
  const organiser = one(thread.organiser);
  const team = one(thread.team);
  const [, startTransition] = useTransition();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editorState, setEditorState] = useState<
    | { mode: 'closed' }
    | { mode: 'new'; type: EngagementType }
    | { mode: 'edit'; engagement: EngagementRow }
  >({ mode: 'closed' });
  const [quickTime, setQuickTime] = useState<EngagementRow | null>(null);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!addMenuOpen) return;
    function onDown(e: MouseEvent) {
      if (!addRef.current?.contains(e.target as Node)) setAddMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [addMenuOpen]);

  // Group: lifecycle-triggered messages first (no date), then dated
  // engagements by day (relative triggers get a computed date from the
  // thread window), then undated by position.
  const window = useMemo(
    () => ({ starts_on: program?.starts_on ?? null, ends_on: program?.ends_on ?? null }),
    [program?.starts_on, program?.ends_on],
  );
  const { triggered, groups, undated, byId } = useMemo(() => {
    const idMap = new Map(engagements.map((e) => [e.id, e]));
    const triggeredList = engagements
      .filter(isLifecycle)
      .sort((a, b) => a.position - b.position);
    const rest = engagements.filter((e) => !isLifecycle(e));
    const dated = rest.filter((e) => whenOf(e, window, idMap));
    const undatedList = rest
      .filter((e) => !whenOf(e, window, idMap))
      .sort((a, b) => a.position - b.position);
    dated.sort(
      (a, b) =>
        new Date(whenOf(a, window, idMap)!).getTime() -
        new Date(whenOf(b, window, idMap)!).getTime(),
    );
    const map = new Map<string, EngagementRow[]>();
    for (const e of dated) {
      const k = dayKey(whenOf(e, window, idMap)!);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return {
      triggered: triggeredList,
      groups: [...map.entries()],
      undated: undatedList,
      byId: idMap,
    };
  }, [engagements, window]);

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
          onClick={() => setMembersOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 px-2 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-sunken shrink-0"
          title="Hosts & facilitators"
        >
          <Users size={17} strokeWidth={1.75} />
          {members.length > 0 && <span className="text-xs tabular-nums">{members.length + 1}</span>}
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle hover:text-ink hover:bg-surface-sunken shrink-0"
          title="Thread settings"
        >
          <Settings size={17} strokeWidth={1.75} />
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

      {(thread.intention || team) && (
        <div className="mt-2 ml-12 max-w-xl">
          {thread.intention && (
            <p className="text-sm text-ink-subtle leading-relaxed">{thread.intention}</p>
          )}
          {team && (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-muted">
              <span className="px-2 py-0.5 rounded-full ring-1 ring-line bg-surface-raised">
                Team · {team.name}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Timeline ─────────────────────────────────────────────────── */}
      <div className="relative mt-8 ml-5 pl-11">
        {/* the vertical line */}
        <div className="absolute left-5 top-1 bottom-1 w-px bg-line" />

        {groups.length === 0 && undated.length === 0 && triggered.length === 0 && (
          <p className="text-sm text-ink-subtle py-6">
            Nothing on the timeline yet — add the first engagement below.
          </p>
        )}

        <div className="space-y-4">
          {triggered.length > 0 && (
            <div className="relative">
              <div className="absolute -left-[57px] top-1 w-10 text-center">
                <div
                  className="rounded-md border border-line bg-surface-raised px-1 py-1.5 text-[9px] uppercase tracking-wide text-ink-muted leading-tight"
                  title="Sent automatically when the trigger fires per participant"
                >
                  Auto
                </div>
              </div>
              <div>
                {triggered.map((e, i) => (
                  <EngagementCard
                    key={e.id}
                    engagement={e}
                    attachTop={i > 0}
                    attachBottom={i < triggered.length - 1}
                    triggerText={triggerLabel(e, byId)}
                    onEdit={() => setEditorState({ mode: 'edit', engagement: e })}
                    onQuickTime={() => setQuickTime(e)}
                  />
                ))}
              </div>
            </div>
          )}

          {groups.map(([key, items]) => (
            <div key={key} className="relative">
              <DateBadge iso={items[0] ? whenOf(items[0], window, byId)! : key} />
              <div>
                {items.map((e, i) => (
                  <EngagementCard
                    key={e.id}
                    engagement={e}
                    attachTop={i > 0}
                    attachBottom={i < items.length - 1}
                    triggerText={triggerLabel(e, byId)}
                    onEdit={() => setEditorState({ mode: 'edit', engagement: e })}
                    onQuickTime={() => setQuickTime(e)}
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
                    triggerText={triggerLabel(e, byId)}
                    onEdit={() => setEditorState({ mode: 'edit', engagement: e })}
                    onQuickTime={() => setQuickTime(e)}
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
              className="w-full rounded-lg border-2 border-dashed border-line hover:border-yellow-400 hover:bg-yellow-50/50 text-ink-subtle hover:text-ink py-3 text-sm inline-flex items-center justify-center gap-2 transition-colors"
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
          threadStartsOn={program?.starts_on ?? null}
          threadEndsOn={program?.ends_on ?? null}
          requiresApproval={thread.requires_approval}
          personalRoomUrl={personalRoomUrl}
          activities={engagements
            .filter((e) => metaFor(e.type).family === 'activity')
            .map((e) => ({ id: e.id, title: e.title }))}
          onClose={() => setEditorState({ mode: 'closed' })}
        />
      )}

      {membersOpen && (
        <MembersDialog
          thread={thread}
          organiserName={organiser?.display_name ?? organiser?.slug ?? ''}
          members={members}
          workspaceMembers={workspaceMembers}
          onClose={() => setMembersOpen(false)}
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
          <SettingsTabs thread={thread} teams={teams} certTemplates={certTemplates} />
        </Dialog>
      )}

      {quickTime && (
        <QuickTimeDialog
          threadId={thread.id}
          engagement={quickTime}
          threadStartsOn={program?.starts_on ?? null}
          threadEndsOn={program?.ends_on ?? null}
          onClose={() => setQuickTime(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

// Date chips carry the Thread brand yellow on the month bar (v3's accent).
function DateChip({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <div className="w-10 shrink-0 rounded-md border border-line bg-surface-raised text-center leading-tight overflow-hidden">
      <div className="bg-yellow-300 text-ink text-[9px] uppercase tracking-wide py-0.5 font-medium">
        {new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d)}
      </div>
      <div className="text-[15px] font-medium tabular-nums py-0.5">{d.getDate()}</div>
    </div>
  );
}

function DateBadge({ iso }: { iso: string }) {
  const d = new Date(iso);
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(d);
  return (
    <div className="absolute -left-[57px] top-1 w-10 text-center" title={weekday}>
      <div className="rounded-md border border-line bg-surface-raised leading-tight overflow-hidden">
        <div className="bg-yellow-300 text-ink text-[9px] uppercase tracking-wide py-0.5 font-medium">
          {new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(d)}
        </div>
        <div className="text-[15px] font-medium tabular-nums py-0.5">{d.getDate()}</div>
      </div>
    </div>
  );
}

function EngagementCard({
  engagement: e,
  attachTop,
  attachBottom,
  triggerText,
  onEdit,
  onQuickTime,
}: {
  engagement: EngagementRow;
  attachTop: boolean;
  attachBottom: boolean;
  triggerText: string | null;
  onEdit: () => void;
  onQuickTime: () => void;
}) {
  const meta = metaFor(e.type);
  const Icon = meta.icon;
  const when = metaFor(e.type).family === 'activity' ? e.starts_at : null;
  const rounded = `${attachTop ? 'rounded-t-none border-t-0' : 'rounded-t-lg'} ${
    attachBottom ? 'rounded-b-none' : 'rounded-b-lg'
  }`;

  return (
    <div className="relative group">
      {/* type dot on the line */}
      <span
        className={`absolute -left-[29px] top-1/2 -translate-y-1/2 h-3 w-3 rounded-full ring-[3px] ring-surface-sunken ${meta.dot}`}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={onEdit}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') onEdit();
        }}
        className={`w-full text-left border border-line bg-surface-raised px-4 py-3 cursor-pointer shadow-[0_1px_3px_rgb(0_0_0/0.05)] hover:shadow-[0_6px_16px_-6px_rgb(0_0_0/0.12)] hover:border-line-strong transition-all ${rounded}`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 shrink-0 ${meta.chip}`}
          >
            <Icon size={16} strokeWidth={1.75} className={meta.text} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px]">
              <span className={`font-medium ${meta.text}`}>{meta.label}</span>
              {e.status !== 'published' && (
                <span className="px-1.5 py-px rounded-full ring-1 ring-line bg-surface-sunken capitalize text-ink-muted">
                  {e.status}
                </span>
              )}
              {meta.family === 'message' && (
                <span className="text-ink-muted">{triggerText}</span>
              )}
            </div>
            <div className="mt-0.5 text-[15px] font-medium truncate">{e.title}</div>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-subtle shrink-0">
            {meta.family === 'activity' && when && (
              <button
                type="button"
                title="Change time"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onQuickTime();
                }}
                className="inline-flex items-center gap-1 tabular-nums rounded-md px-1.5 py-0.5 -mx-1.5 hover:bg-surface-sunken hover:text-ink transition-colors"
              >
                <Clock size={12} strokeWidth={1.75} />
                {fmtTime(when)}
                {e.ends_at && ` – ${fmtTime(e.ends_at)}`}
              </button>
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
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread settings — tabbed (Basics / Pricing / Registration / Certificate);
// more tabs will come. All tabs stay in the DOM (Meet's pattern).
// ---------------------------------------------------------------------------

function SettingsTabs({
  thread,
  teams,
  certTemplates,
}: {
  thread: ThreadRow;
  teams: TeamOption[];
  certTemplates: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<'basics' | 'pricing' | 'registration' | 'certificate'>('basics');
  const tabs = [
    { value: 'basics', label: 'Basics' },
    { value: 'pricing', label: 'Pricing' },
    { value: 'registration', label: 'Registration' },
    { value: 'certificate', label: 'Certificate' },
  ] as const;

  return (
    <div>
      <nav className="border-b border-line -mt-1">
        <ul className="flex gap-1 -mb-px">
          {tabs.map((t) => (
            <li key={t.value}>
              <button
                type="button"
                onClick={() => setTab(t.value)}
                className={`inline-block px-3 py-2 text-sm border-b-2 transition-colors ${
                  tab === t.value
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-subtle hover:text-ink hover:border-line-strong'
                }`}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className={`pt-5 ${tab === 'basics' ? '' : 'hidden'}`}>
        <ThreadEditorForm thread={thread} compact teams={teams} />
      </div>
      <div className={`pt-5 ${tab === 'pricing' ? '' : 'hidden'}`}>
        <PricingPanel thread={thread} />
      </div>
      <div className={`pt-5 ${tab === 'registration' ? '' : 'hidden'}`}>
        <RegistrationPanel threadId={thread.id} fields={thread.registration_fields ?? []} />
      </div>
      <div className={`pt-5 ${tab === 'certificate' ? '' : 'hidden'}`}>
        <CertificatePanel thread={thread} certTemplates={certTemplates} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick time edit — click the time on a card, change just the schedule.
// ---------------------------------------------------------------------------

function QuickTimeDialog({
  threadId,
  engagement,
  threadStartsOn,
  threadEndsOn,
  onClose,
}: {
  threadId: string;
  engagement: EngagementRow;
  threadStartsOn: string | null;
  threadEndsOn: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isActivity = metaFor(engagement.type).family === 'activity';

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const toIso = (v: string) => (v ? new Date(v).toISOString() : null);
    const patch = isActivity
      ? {
          starts_at: toIso(String(fd.get('starts_at') ?? '')),
          ends_at: toIso(String(fd.get('ends_at') ?? '')),
        }
      : { scheduled_at: toIso(String(fd.get('scheduled_at') ?? '')) };
    startTransition(async () => {
      const r = await updateEngagement(threadId, engagement.id, patch);
      if (!r.ok) return setError(r.error);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={engagement.title}
      description={isActivity ? 'Change when it runs.' : 'Change when it sends.'}
      footer={
        <>
          {error && <span className="mr-auto text-sm text-red-700 truncate">{error}</span>}
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="quick-time-form" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="quick-time-form" onSubmit={onSubmit} className="space-y-4">
        {isActivity ? (
          <>
            <DateTimeField
              label="Starts"
              name="starts_at"
              defaultValue={toLocalInput(engagement.starts_at)}
              min={threadStartsOn}
              max={threadEndsOn}
            />
            <DateTimeField
              label="Ends"
              name="ends_at"
              defaultValue={toLocalInput(engagement.ends_at)}
              min={threadStartsOn}
              max={threadEndsOn}
            />
          </>
        ) : (
          <DateTimeField
            label="Send at"
            name="scheduled_at"
            defaultValue={toLocalInput(engagement.scheduled_at)}
          />
        )}
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Hosts & facilitators
// ---------------------------------------------------------------------------

function MembersDialog({
  thread,
  organiserName,
  members,
  workspaceMembers,
  onClose,
}: {
  thread: ThreadRow;
  organiserName: string;
  members: ThreadMember[];
  workspaceMembers: WorkspaceMember[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pickUser, setPickUser] = useState('');
  const [pickRole, setPickRole] = useState<'host' | 'facilitator'>('host');

  const memberUserIds = new Set(
    members.map((m) => one(m.organiser)?.user_id).filter(Boolean) as string[],
  );
  const primaryUserId = one(thread.organiser)?.user_id;
  const candidates = workspaceMembers.filter(
    (w) => w.user_id !== primaryUserId && !memberUserIds.has(w.user_id),
  );

  function add() {
    if (!pickUser) return setError('Pick a member.');
    setError(null);
    startTransition(async () => {
      const r = await addThreadMember(thread.id, pickUser, pickRole);
      if (!r.ok) return setError(r.error);
      setPickUser('');
      router.refresh();
    });
  }

  function remove(organiserId: string) {
    startTransition(async () => {
      await removeThreadMember(thread.id, organiserId);
      router.refresh();
    });
  }

  const select =
    'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none';

  return (
    <Dialog
      open
      onClose={onClose}
      title="Hosts & facilitators"
      description="Hosts can edit the thread; facilitators run sessions."
    >
      <ul className="space-y-2">
        <li className="flex items-center gap-3 rounded-md border border-line bg-surface-sunken/50 px-3 py-2.5">
          <span className="text-sm font-medium flex-1 truncate">{organiserName}</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-yellow-300 bg-yellow-50 text-ink">
            Organiser
          </span>
        </li>
        {members.map((m) => {
          const o = one(m.organiser);
          if (!o) return null;
          return (
            <li
              key={o.id}
              className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5"
            >
              <span className="text-sm flex-1 truncate">{o.display_name ?? o.slug}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-line bg-surface-sunken capitalize">
                {m.role}
              </span>
              <button
                type="button"
                aria-label="Remove"
                disabled={pending}
                onClick={() => remove(o.id)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 border-t border-line pt-4">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted mb-2">Invite</div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <select value={pickUser} onChange={(e) => setPickUser(e.target.value)} className={select}>
            <option value="">Choose a workspace member…</option>
            {candidates.map((w) => (
              <option key={w.user_id} value={w.user_id}>
                {w.full_name ?? w.email}
              </option>
            ))}
          </select>
          <select
            value={pickRole}
            onChange={(e) => setPickRole(e.target.value as 'host' | 'facilitator')}
            className={select}
          >
            <option value="host">Host</option>
            <option value="facilitator">Facilitator</option>
          </select>
          <Button size="sm" onClick={add} disabled={pending} leading={<Plus size={14} />}>
            Add
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    </Dialog>
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
