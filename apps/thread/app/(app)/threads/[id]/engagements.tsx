'use client';

// The engagement add/edit dialog — v3-style big modal, two-column layout
// (Sjoerd 2026-07-02): left = what it is (title, description/content),
// right = when + where. Delete/Duplicate live in the footer next to Save.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Copy, MapPin, Video } from 'lucide-react';
import { createEngagement, updateEngagement, deleteEngagement } from '../actions';
import type { EngagementRow, EngagementType, TriggerKind, DailyTime } from '@/lib/thread-types';
import {
  ENGAGEMENT_META,
  metaFor,
  type EngagementFamily,
} from '@/lib/engagement-meta';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form-error';
import { DangerConfirmDialog } from '@/components/ui/danger-confirm';
import { TextField, TextAreaField, SelectField } from '@/components/ui/field';
import { DateField, DateTimeField } from '@/components/ui/date-field';
import { RichTextField } from '@/components/ui/rich-text';
import { Button } from '@/components/ui/button';
import { Switch, SwitchField } from '@/components/ui/switch';

/** ISO → value for the date-time picker in the browser's zone. */
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

/** 'YYYY-MM-DD' of an ISO instant, in the browser's zone. */
function datePart(iso: string | null): string {
  if (!iso) return '';
  return toLocalInput(iso).slice(0, 10);
}
/** 'HH:MM' of an ISO instant, in the browser's zone. */
function timePart(iso: string | null, fallback: string): string {
  const t = iso ? toLocalInput(iso).slice(11, 16) : '';
  return /^\d{2}:\d{2}$/.test(t) ? t : fallback;
}
/** Inclusive list of 'YYYY-MM-DD' between two dates (capped, DST-safe via UTC). */
function daysBetween(a: string, b: string): string[] {
  if (!a) return [];
  if (!b || b < a) return [a];
  const out: string[] = [];
  let d = new Date(`${a}T00:00:00Z`);
  const end = new Date(`${b}T00:00:00Z`);
  let guard = 0;
  while (d <= end && guard++ < 400) {
    out.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 86_400_000);
  }
  return out;
}
/** 15-minute time options across the day (matches the date-field picker). */
const TIME_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: (24 * 60) / 15 },
  (_, i) => {
    const m = i * 15;
    const v = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return { value: v, label: v };
  },
);
function fmtDayLabel(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T00:00:00`));
}

const PROVIDER_OPTIONS = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'personal_room', label: 'Personal meeting room' },
  { value: 'custom', label: 'Custom link' },
];

const TRIGGER_DAY_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '10', '14', '21', '30'];
const TRIGGER_TIME_OPTIONS = Array.from({ length: 15 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);

export function EngagementDialog({
  threadId,
  engagement,
  initialType,
  threadStartsOn,
  threadEndsOn,
  requiresApproval,
  personalRoomUrl,
  activities = [],
  onClose,
}: {
  threadId: string;
  engagement: EngagementRow | null;
  initialType?: EngagementType;
  threadStartsOn?: string | null;
  threadEndsOn?: string | null;
  requiresApproval?: boolean;
  /** Meet's personal room, shared across the Fibre apps. */
  personalRoomUrl?: string | null;
  /** The thread's activities — anchor options for relative message triggers. */
  activities?: { id: string; title: string; hasDate: boolean }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const isNew = !engagement;
  const [type, setType] = useState<EngagementType>(engagement?.type ?? initialType ?? 'event');
  const [triggerKind, setTriggerKind] = useState<TriggerKind>(engagement?.trigger_kind ?? 'fixed');
  // New engagements go out published (Sjoerd 2026-07-04) — the header pill
  // toggles back to draft.
  const [status, setStatus] = useState<'draft' | 'published'>(
    !engagement || engagement.status === 'published' ? 'published' : 'draft',
  );
  const [locationMode, setLocationMode] = useState<'in_person' | 'virtual'>(
    engagement?.meeting_url || engagement?.meeting_provider ? 'virtual' : 'in_person',
  );
  const [provider, setProvider] = useState<string>(engagement?.meeting_provider ?? 'custom');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  // Ends can only follow Starts within the thread window — and it MOVES with
  // it. Ends used to be uncontrolled with a `min`, so picking a new start
  // tightened the constraint but left the old value sitting there: the dialog
  // would show "Starts 17 Sept, Ends 2 Sept" until you noticed (Sjoerd
  // 2026-08-31). Now the gap between them is preserved, the way a thread's
  // engagements shift when the thread's own start date moves.
  const [startsAt, setStartsAt] = useState<string>(toLocalInput(engagement?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState<string>(toLocalInput(engagement?.ends_at ?? null));

  // Location + its link. Controlled so typing an address can offer a maps
  // link (Sjoerd 2026-08-31). No geocoding service and no API key: Google's
  // documented search URL takes the address as a query, so the suggestion is
  // built locally and the address never leaves the browser until someone
  // clicks it. It is offered, never auto-written — a venue with its own page
  // deserves that link instead, and silently overwriting would bury it.
  const [location, setLocation] = useState<string>(engagement?.location ?? '');
  const [locationUrl, setLocationUrl] = useState<string>(engagement?.location_url ?? '');
  const mapsSuggestion =
    location.trim().length > 3 && !locationUrl.trim()
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`
      : null;

  /** Local "YYYY-MM-DDTHH:mm" → ms, and back. No timezone maths: these are
   *  the literal wall-clock strings the inputs speak. */
  const localMs = (v: string): number | null => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  };
  const localStr = (ms: number): string => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const DEFAULT_SPAN_MS = 60 * 60 * 1000;

  function onStartChange(next: string) {
    const prevStart = localMs(startsAt);
    const nextStart = localMs(next);
    setStartsAt(next);
    if (!nextStart) return;
    const end = localMs(endsAt);
    // Keep the duration when there was one; otherwise open an hour.
    const span = prevStart && end && end > prevStart ? end - prevStart : DEFAULT_SPAN_MS;
    setEndsAt(localStr(nextStart + span));
  }
  // Per-day timing (multi-day activities): a master window fills every day,
  // any day can be overridden (Sjoerd 2026-07-10).
  const initialSched = engagement?.daily_schedule ?? null;
  const [timePerDay, setTimePerDay] = useState<boolean>(!!initialSched?.length);
  const [firstDay, setFirstDay] = useState<string>(
    initialSched?.[0]?.date ?? datePart(engagement?.starts_at ?? null),
  );
  const [lastDay, setLastDay] = useState<string>(
    initialSched?.[initialSched.length - 1]?.date ?? datePart(engagement?.ends_at ?? null),
  );
  const [masterStart, setMasterStart] = useState<string>(
    initialSched?.[0]?.start ?? timePart(engagement?.starts_at ?? null, '09:00'),
  );
  const [masterEnd, setMasterEnd] = useState<string>(
    initialSched?.[0]?.end ?? timePart(engagement?.ends_at ?? null, '17:00'),
  );
  const [dayOverrides, setDayOverrides] = useState<Record<string, { start: string; end: string }>>(
    () => Object.fromEntries((initialSched ?? []).map((d) => [d.date, { start: d.start, end: d.end }])),
  );
  const dayFor = (date: string) => dayOverrides[date] ?? { start: masterStart, end: masterEnd };
  function buildDailySchedule(): DailyTime[] {
    return daysBetween(firstDay, lastDay).map((date) => ({ date, ...dayFor(date) }));
  }
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  function requestClose() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  const meta = metaFor(type);
  const family: EngagementFamily = meta.family;
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
      status,
    };

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
      const anchor = String(fd.get('trigger_anchor') ?? 'start');
      if (anchor.startsWith('eng:')) {
        trigger.trigger_anchor = 'engagement';
        trigger.trigger_engagement_id = anchor.slice(4);
      } else {
        trigger.trigger_anchor = anchor;
        trigger.trigger_engagement_id = null;
      }
      trigger.trigger_offset_days = direction === 'before' ? -days : days;
      trigger.trigger_time = String(fd.get('trigger_time') ?? '09:00');
    }

    const where =
      locationMode === 'virtual'
        ? {
            meeting_provider: provider as EngagementRow['meeting_provider'],
            meeting_url:
              provider === 'personal_room'
                ? personalRoomUrl ?? null
                : String(fd.get('meeting_url') ?? '').trim() || null,
            location: null,
            location_url: null,
          }
        : {
            meeting_provider: null,
            meeting_url: null,
            location: String(fd.get('location') ?? '').trim() || null,
            location_url: String(fd.get('location_url') ?? '').trim() || null,
          };

    const schedule = timePerDay ? buildDailySchedule() : [];
    const perDayPayload =
      timePerDay && schedule.length
        ? {
            daily_schedule: schedule,
            starts_at: fromLocalInput(`${schedule[0]!.date}T${schedule[0]!.start}`),
            ends_at: fromLocalInput(
              `${schedule[schedule.length - 1]!.date}T${schedule[schedule.length - 1]!.end}`,
            ),
          }
        : {
            daily_schedule: null,
            starts_at: fromLocalInput(String(fd.get('starts_at') ?? '')),
            ends_at: fromLocalInput(String(fd.get('ends_at') ?? '')),
          };
    const payload =
      family === 'activity'
        ? {
            ...common,
            ...perDayPayload,
            ...where,
          }
        : {
            ...common,
            ...trigger,
            content: contentFromForm(type, fd),
          };

    startTransition(async () => {
      const r = isNew
        ? await createEngagement(threadId, payload)
        : await updateEngagement(threadId, engagement.id, payload);
      if (!r.ok) return setError(r.error);
      onClose();
      router.refresh();
    });
  }

  function duplicate() {
    if (!engagement) return;
    startTransition(async () => {
      const r = await createEngagement(threadId, {
        title: `${engagement.title} (copy)`,
        type: engagement.type,
        status: engagement.status === 'published' ? 'published' : 'draft',
        description: engagement.description,
        starts_at: engagement.starts_at,
        ends_at: engagement.ends_at,
        daily_schedule: engagement.daily_schedule,
        location: engagement.location,
        location_url: engagement.location_url,
        meeting_url: engagement.meeting_url,
        meeting_provider: engagement.meeting_provider,
        scheduled_at: engagement.scheduled_at,
        trigger_kind: engagement.trigger_kind,
        trigger_anchor: engagement.trigger_anchor,
        trigger_engagement_id: engagement.trigger_engagement_id,
        trigger_offset_days: engagement.trigger_offset_days,
        trigger_time: engagement.trigger_time,
        content: engagement.content,
        show_in_agenda: engagement.show_in_agenda,
      });
      if (!r.ok) return setError(r.error);
      onClose();
      router.refresh();
    });
  }

  function doDelete() {
    if (!engagement) return;
    startTransition(async () => {
      // The result used to be discarded: a refused delete (a message that has
      // already gone out is frozen) closed the dialog anyway and the item was
      // still there afterwards, looking like "delete does nothing" (Sjoerd
      // 2026-08-31). Say why instead.
      const r = await deleteEngagement(threadId, engagement.id);
      setConfirmDelete(false);
      if (!r.ok) return setError(r.error);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open
      onClose={requestClose}
      title={isNew ? `Add ${meta.label.toLowerCase()}` : `Edit — ${engagement.title}`}
      size="xl"
      footer={
        <>
          {!isNew && (
            <div className="mr-auto flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leading={<Trash2 size={14} />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leading={<Copy size={14} />}
                onClick={duplicate}
                disabled={pending}
              >
                Duplicate
              </Button>
            </div>
          )}
          {error && <FormError message={error} />}
          <Button type="button" variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="submit" form="engagement-form" disabled={pending}>
            {pending ? 'Saving…' : isNew ? 'Add to timeline' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="engagement-form" onSubmit={onSubmit} onInput={() => setDirty(true)}>
        <div className="mb-6 flex items-end gap-5">
          <div className="flex-1 min-w-0">
            <TextField label="Title" name="title" defaultValue={engagement?.title ?? ''} required />
          </div>
          {/* Publish toggle rides next to the title (Sjoerd 2026-07-07) —
              new engagements start published; off = draft. */}
          <div className="shrink-0 pb-2.5">
            <Switch
              checked={status === 'published'}
              onChange={(v) => {
                setStatus(v ? 'published' : 'draft');
                setDirty(true);
              }}
              label="Published"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-x-8 gap-y-6">
          {/* ── Left: what it is ─────────────────────────────────────── */}
          <div className="space-y-5">
            <RichTextField
              label="Description"
              name="description"
              defaultValue={engagement?.description ?? ''}
            />
            {family === 'message' && (
              <MessageContentFields type={type} content={engagement?.content ?? {}} />
            )}
            {family === 'activity' && (
              <>
            {/* Where: in person / virtual */}
            <div>
              <span className="text-sm text-ink-subtle">Where</span>
              <div className="mt-1 grid grid-cols-2 rounded-md border border-line overflow-hidden h-[38px]">
                <ModeButton
                  Icon={MapPin}
                  label="In person"
                  active={locationMode === 'in_person'}
                  onClick={() => setLocationMode('in_person')}
                />
                <ModeButton
                  Icon={Video}
                  label="Virtual"
                  active={locationMode === 'virtual'}
                  onClick={() => setLocationMode('virtual')}
                />
              </div>
            </div>

            {locationMode === 'in_person' ? (
              <>
                <TextField
                  label="Location"
                  name="location"
                  placeholder="Venue or address"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <div>
                  <TextField
                    label="Location link"
                    name="location_url"
                    type="url"
                    placeholder="Maps or venue URL"
                    value={locationUrl}
                    onChange={(e) => setLocationUrl(e.target.value)}
                  />
                  {mapsSuggestion && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocationUrl(mapsSuggestion);
                        setDirty(true);
                      }}
                      className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-ink-subtle hover:text-ink"
                    >
                      <MapPin size={12} strokeWidth={1.75} />
                      Use a Google Maps link for “{location.trim()}”
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-sm text-ink-subtle">Provider</span>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none"
                  >
                    {PROVIDER_OPTIONS.map((o) => {
                      const disabled = o.value === 'personal_room' && !personalRoomUrl;
                      return (
                        <option key={o.value} value={o.value} disabled={disabled}>
                          {o.label}
                          {disabled ? ' — not set' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {provider === 'personal_room' ? (
                  <p className="text-xs text-ink-muted rounded-md border border-line bg-surface-sunken/50 px-3 py-2">
                    {personalRoomUrl ? (
                      <>
                        Uses your personal room from Meet:{' '}
                        <span className="text-ink break-all">{personalRoomUrl}</span>
                      </>
                    ) : (
                      <>
                        No personal room configured — set one in Settings →
                        Connections.
                      </>
                    )}
                  </p>
                ) : (
                  <TextField
                    label="Meeting link"
                    name="meeting_url"
                    type="url"
                    placeholder="https://…"
                    defaultValue={engagement?.meeting_url ?? ''}
                  />
                )}
              </>
            )}
              </>
            )}
          </div>

          {/* ── Right: when + where ──────────────────────────────────── */}
          <div className="space-y-5">
            <div className="space-y-4">
              <SelectField
                label="Type"
                name="type_display"
                value={type}
                onChange={(e) => setType(e.target.value as EngagementType)}
                options={typeOptions.map((m) => ({ value: m.type, label: m.label }))}
              />
            </div>

            {family === 'activity' ? (
              <>
                <SwitchField
                  label="Time per day"
                  hint="Set a begin/end time for each day of a multi-day activity."
                  checked={timePerDay}
                  onChange={(v) => {
                    setTimePerDay(v);
                    setDirty(true);
                  }}
                />
                {!timePerDay ? (
                  <>
                    <DateTimeField
                      label="Starts"
                      name="starts_at"
                      value={startsAt}
                      min={threadStartsOn}
                      max={threadEndsOn}
                      onChange={onStartChange}
                    />
                    <DateTimeField
                      label="Ends"
                      name="ends_at"
                      value={endsAt}
                      min={startsAt || threadStartsOn}
                      max={threadEndsOn}
                      onChange={setEndsAt}
                    />
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <DateField
                        label="First day"
                        name="_first_day"
                        defaultValue={firstDay}
                        min={threadStartsOn}
                        max={threadEndsOn}
                        onValueChange={(v) => {
                          setFirstDay(v);
                          setDirty(true);
                        }}
                      />
                      <DateField
                        label="Last day"
                        name="_last_day"
                        defaultValue={lastDay}
                        min={firstDay || threadStartsOn}
                        max={threadEndsOn}
                        onValueChange={(v) => {
                          setLastDay(v);
                          setDirty(true);
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <SelectField
                        label="Daily start"
                        value={masterStart}
                        onChange={(e) => {
                          setMasterStart(e.target.value);
                          setDirty(true);
                        }}
                        options={TIME_OPTIONS}
                      />
                      <SelectField
                        label="Daily end"
                        value={masterEnd}
                        onChange={(e) => {
                          setMasterEnd(e.target.value);
                          setDirty(true);
                        }}
                        options={TIME_OPTIONS}
                      />
                    </div>
                    {daysBetween(firstDay, lastDay).length > 0 && (
                      <div className="rounded-lg border border-line divide-y divide-line">
                        <p className="px-3 py-1.5 text-xs text-ink-muted">
                          Fills every day — edit a row to change one day.
                        </p>
                        {daysBetween(firstDay, lastDay).map((date) => {
                          const { start, end } = dayFor(date);
                          const setDay = (patch: { start?: string; end?: string }) => {
                            setDayOverrides((o) => ({
                              ...o,
                              [date]: { start, end, ...patch },
                            }));
                            setDirty(true);
                          };
                          return (
                            <div key={date} className="flex items-center gap-2 px-3 py-1.5">
                              <span className="w-24 shrink-0 text-sm text-ink-subtle">
                                {fmtDayLabel(date)}
                              </span>
                              <select
                                value={start}
                                onChange={(e) => setDay({ start: e.target.value })}
                                className="rounded-md border border-line bg-surface-raised px-2 py-1 text-sm tabular-nums focus:border-line-strong focus:outline-none"
                              >
                                {TIME_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                              <span className="text-ink-muted">–</span>
                              <select
                                value={end}
                                onChange={(e) => setDay({ end: e.target.value })}
                                className="rounded-md border border-line bg-surface-raised px-2 py-1 text-sm tabular-nums focus:border-line-strong focus:outline-none"
                              >
                                {TIME_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <TriggerFields
                triggerKind={triggerKind}
                onKindChange={setTriggerKind}
                engagement={engagement}
                requiresApproval={requiresApproval ?? false}
                activities={activities}
              />
            )}

            <div className="pt-1">
              {/* Activities belong on the public agenda; messages are the
                  participant journey — private by default (Sjoerd 2026-07-02). */}
              <SwitchField
                label="Show on the public agenda"
                name="show_in_agenda"
                defaultChecked={engagement?.show_in_agenda ?? family === 'activity'}
                onChange={() => setDirty(true)}
              />
            </div>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDiscard}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        title="Discard changes?"
        message="You have unsaved changes in this engagement."
        confirmLabel="Discard"
        destructive
      />

      <DangerConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title="Delete engagement"
        message={
          <>
            Delete <strong>{engagement?.title}</strong> from the timeline? This can&apos;t be
            undone.
          </>
        }
        pending={pending}
      />
    </Dialog>
  );
}

function ModeButton({
  Icon,
  label,
  active,
  onClick,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 text-sm transition-colors ${
        active
          ? 'bg-ink text-ink-inverse font-medium'
          : 'bg-surface-raised text-ink-subtle hover:text-ink'
      }`}
    >
      <Icon size={14} strokeWidth={1.75} />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// "When to send" — message-family trigger control
// ---------------------------------------------------------------------------

function TriggerFields({
  triggerKind,
  onKindChange,
  engagement,
  requiresApproval,
  activities,
}: {
  triggerKind: TriggerKind;
  onKindChange: (k: TriggerKind) => void;
  engagement: EngagementRow | null;
  requiresApproval: boolean;
  activities: { id: string; title: string; hasDate: boolean }[];
}) {
  const off = engagement?.trigger_offset_days ?? -3;
  const defaultDays = String(Math.min(30, Math.max(1, Math.abs(off || 3))));
  const defaultDirection = (engagement?.trigger_offset_days ?? -3) < 0 ? 'before' : 'after';
  const defaultAnchor =
    engagement?.trigger_anchor === 'engagement' && engagement.trigger_engagement_id
      ? `eng:${engagement.trigger_engagement_id}`
      : engagement?.trigger_anchor ?? 'start';
  const defaultTime = engagement?.trigger_time ?? '09:00';

  const kindOptions = [
    { value: 'fixed', label: 'On a fixed date' },
    { value: 'relative', label: 'Relative to a date or event' },
    { value: 'on_enrolment', label: 'When someone enrols' },
    ...(requiresApproval
      ? [{ value: 'on_approval', label: 'When their enrolment is approved' }]
      : []),
    { value: 'on_completion', label: 'When they complete the thread' },
  ];

  return (
    <div className="space-y-4">
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
      {triggerKind === 'relative' && (
        <div className="grid grid-cols-2 gap-3">
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
              // A dateless anchor can never resolve to a send time — the
              // scheduler would skip the message forever without a word. Say
              // so in the option itself rather than letting it be found out.
              ...activities.map((a) => ({
                value: `eng:${a.id}`,
                label: a.hasDate ? a.title : `${a.title} — has no date yet`,
              })),
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
        <p className="text-xs text-ink-muted rounded-md border border-line bg-surface-sunken/50 px-3 py-2">
          Sent automatically to each participant the moment it happens — no date needed.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type-specific message content
// ---------------------------------------------------------------------------

export function contentFromForm(type: EngagementType, fd: FormData): Record<string, unknown> {
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

export function MessageContentFields({
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
          <RichTextField label="Note" name="body" defaultValue={str('body')} minHeight={64} />
        </>
      );
    case 'inspiration':
      return (
        <>
          <RichTextField label="Text" name="body" defaultValue={str('body')} />
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
        <RichTextField
          label="Body"
          name="body"
          defaultValue={str('body')}
          minHeight={140}
          hint="Tokens: {name}, {thread}, {organiser}, {date} — replaced per participant when sent."
        />
      );
  }
}
