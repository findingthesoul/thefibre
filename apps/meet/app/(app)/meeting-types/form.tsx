'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { User, Users as TeamIcon, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import { EVENT_TYPES, EventTypePicker } from '@/components/event-type-picker';
import { IntakeFieldsEditor } from '@/components/intake-fields-editor';
import type { IntakeField } from '@/lib/intake';
import {
  WorkingHoursEditor,
  coerceSchedule,
  type Schedule,
} from '@/components/working-hours-editor';
import { createMeetingType, savePollSlots, saveIntakeFields, updateMeetingType, type SaveResult } from './actions';

export type MeetingTypeFormValues = {
  id?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  duration_minutes?: number;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  min_notice_minutes?: number;
  max_advance_days?: number;
  conferencing_provider?: string;
  default_location?: string | null;
  is_active?: boolean;
  is_public_listed?: boolean;
  team_id?: string | null;
  event_type?: string;
  capacity?: number | null;
  fixed_starts_at?: string | null;
  fixed_ends_at?: string | null;
  poll_slots?: { starts_at: string; ends_at: string }[];
  working_hours_override?: Schedule | null;
  conflict_calendar_ids?: string[] | null;
  intake_form_id?: string | null;
  intake_form?: { id: string; name: string; fields: IntakeField[] } | null;
  price_cents?: number | null;
  price_currency?: string | null;
};

export type TeamOption = { id: string; name: string; slug?: string };
export type CalendarOption = {
  id: string;
  summary: string | null;
  role: 'primary' | 'conflict_check' | 'write_target' | 'ignore';
};

const CAPACITY_OPTIONS = [
  { value: '2', label: '2 invitees' },
  { value: '4', label: '4 invitees' },
  { value: '6', label: '6 invitees' },
  { value: '8', label: '8 invitees' },
  { value: '10', label: '10 invitees' },
  { value: '12', label: '12 invitees' },
  { value: '15', label: '15 invitees' },
  { value: '20', label: '20 invitees' },
  { value: '30', label: '30 invitees' },
  { value: '50', label: '50 invitees' },
];

const PROVIDERS = [
  { value: 'google_meet', label: 'Google Meet' },
  // Zoom + Teams need OAuth integrations not yet built; show them disabled
  // so the user sees they're planned without being able to pick a broken
  // option (which previously saved fine but generated no meeting URL).
  { value: 'zoom', label: 'Zoom', disabled: true },
  { value: 'teams', label: 'Microsoft Teams', disabled: true },
  { value: 'in_person', label: 'In person' },
  { value: 'personal_room', label: 'Personal room' },
  { value: 'none', label: 'No conferencing' },
];

const DURATION_OPTIONS = [
  { value: '15', label: '15 minutes' },
  { value: '20', label: '20 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '60 minutes' },
  { value: '90', label: '90 minutes' },
  { value: '120', label: '2 hours' },
];

const BUFFER_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '60 min' },
];

const NOTICE_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '240', label: '4 hours' },
  { value: '1440', label: '1 day' },
  { value: '2880', label: '2 days' },
  { value: '10080', label: '1 week' },
];

const ADVANCE_OPTIONS = [
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '1 year' },
];

type Tab = 'basics' | 'availability' | 'conferencing' | 'pricing' | 'intake';

export function MeetingTypeForm({
  initial,
  hostSlug,
  teams = [],
  calendars = [],
}: {
  initial: MeetingTypeFormValues;
  /** The current user's own host slug — used to render the personal URL prefix. */
  hostSlug?: string | null;
  teams?: TeamOption[];
  calendars?: CalendarOption[];
}) {
  const isEdit = !!initial.id;
  const action = isEdit
    ? updateMeetingType.bind(null, initial.id!)
    : createMeetingType;
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    action as (prev: SaveResult, fd: FormData) => Promise<SaveResult>,
    {},
  );

  const [tab, setTab] = useState<Tab>('basics');
  const [scope, setScope] = useState<'personal' | 'team'>(
    initial.team_id ? 'team' : 'personal',
  );
  const [teamId, setTeamId] = useState<string>(initial.team_id ?? '');
  const [eventType, setEventType] = useState<string>(initial.event_type ?? 'one_on_one');
  const [availabilityMode, setAvailabilityMode] = useState<'default' | 'custom'>(
    initial.working_hours_override ? 'custom' : 'default',
  );
  const [hours, setHours] = useState<Schedule>(coerceSchedule(initial.working_hours_override));
  // "Use host default" = null or empty array (we treat both the same so a
  // previously-saved empty array doesn't visually flip into custom mode).
  const [calMode, setCalMode] = useState<'default' | 'custom'>(
    initial.conflict_calendar_ids && initial.conflict_calendar_ids.length > 0
      ? 'custom'
      : 'default',
  );
  const [calIds, setCalIds] = useState<Set<string>>(
    new Set(initial.conflict_calendar_ids ?? []),
  );
  const [pricing, setPricing] = useState<'free' | 'paid'>(
    initial.price_cents && initial.price_cents > 0 ? 'paid' : 'free',
  );

  // Event-type chooser:
  //  - Personal scope: One-on-one, Group, One-off, Meeting poll (single-host all).
  //  - Team scope:     adds Round-robin + Collective.
  const showEventType = scope === 'team' ? teams.length > 0 : true;
  const PERSONAL_EVENT_TYPES = new Set(['one_on_one', 'group', 'one_off', 'poll']);
  const eventTypeOptions = (
    scope === 'team'
      ? EVENT_TYPES
      : EVENT_TYPES.filter((t) => PERSONAL_EVENT_TYPES.has(t.value))
  );
  const validEventType = eventTypeOptions.some((t) => t.value === eventType)
    ? eventType
    : 'one_on_one';
  const effectiveEventType = validEventType;
  // Fall back to the first team when the user has flipped scope to "team"
  // but hasn't actively changed the Team select. Without this fallback the
  // hidden team_id input posts "" and the server stores the MT as personal.
  const effectiveTeamId =
    scope === 'team' ? teamId || teams[0]?.id || '' : '';

  // Slug prefix depends on scope. For personal: meet.thefibre.app/<host-slug>/
  // For team: meet.thefibre.app/<team-slug>/
  // If the team scope is selected but no team is picked yet, fall back to
  // the first team in the list (which is the visible default).
  const fallbackTeamId = effectiveTeamId || teams[0]?.id;
  const teamSlugForPrefix = teams.find((t) => t.id === fallbackTeamId)?.slug;
  const prefix =
    scope === 'team' && teamSlugForPrefix
      ? `meet.thefibre.app/${teamSlugForPrefix}/`
      : hostSlug
        ? `meet.thefibre.app/${hostSlug}/`
        : 'meet.thefibre.app/';

  // Availability is hidden for one_off (single fixed time, nothing to schedule)
  // and repurposed for poll into a candidate-slots editor (label changes).
  const isOneOff = effectiveEventType === 'one_off';
  const isPoll = effectiveEventType === 'poll';
  const tabs: { value: Tab; label: string }[] = [
    { value: 'basics', label: 'Basics' },
    ...(isOneOff
      ? []
      : [
          {
            value: 'availability' as Tab,
            label: isPoll ? 'Candidate slots' : 'Availability',
          },
        ]),
    { value: 'conferencing', label: 'Conferencing' },
    { value: 'pricing', label: 'Pricing' },
    { value: 'intake', label: 'Intake' },
  ];
  const visibleTab: Tab = tabs.some((t) => t.value === tab) ? tab : 'basics';

  return (
    <form action={formAction} className="space-y-6">
      <div className="sticky top-0 z-10 -mx-10 px-10 bg-surface/80 backdrop-blur border-b border-line">
        <div className="flex items-center justify-between gap-3 py-3">
          <nav className="flex items-center gap-1 text-sm">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={`px-3 py-1.5 rounded-md ${
                  visibleTab === t.value
                    ? 'bg-ink text-surface-raised'
                    : 'text-ink-subtle hover:text-ink hover:bg-surface-sunken'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {state.ok && <span className="text-xs text-emerald-700">Saved.</span>}
            {state.error && <span className="text-xs text-red-700">{state.error}</span>}
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden inputs */}
      <input type="hidden" name="team_id" value={effectiveTeamId} />
      <input type="hidden" name="event_type" value={effectiveEventType} />
      <input
        type="hidden"
        name="working_hours_override_json"
        value={availabilityMode === 'custom' ? JSON.stringify(hours) : ''}
      />
      <input
        type="hidden"
        name="conflict_calendar_ids_json"
        value={calMode === 'custom' ? JSON.stringify(Array.from(calIds)) : ''}
      />
      <input type="hidden" name="pricing_mode" value={pricing} />

      {/*
        Each tab below stays in the DOM and is just hidden when inactive.
        Mounting only the active tab caused name/slug to drop out of
        FormData on Save when the user was on Conferencing / Availability
        / etc., and the API rejected with 400 (slug too short, name
        required). CSS hide preserves all inputs across tab switches.
      */}
      <div className={visibleTab === 'basics' ? '' : 'hidden'}>
        <>
          <Section title="Scope" desc="Personal types live under your handle. Team types live under a team's URL — bookings show up in the team's shared view.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ScopeCard
                Icon={User}
                title="Personal"
                desc="Just for you."
                active={scope === 'personal'}
                onClick={() => setScope('personal')}
              />
              <ScopeCard
                Icon={TeamIcon}
                title="Team"
                desc={teams.length === 0 ? 'You aren’t a lead of any team yet.' : 'Owned by a team you lead.'}
                active={scope === 'team'}
                disabled={teams.length === 0}
                onClick={() => setScope('team')}
              />
            </div>
            {scope === 'team' && teams.length > 0 && (
              <SelectField
                label="Team"
                name="team_id_visible"
                value={teamId || teams[0]!.id}
                onChange={(e) => setTeamId(e.target.value)}
                options={teams.map((t) => ({ value: t.id, label: t.name }))}
              />
            )}
            {showEventType && (
              <EventTypePicker
                value={effectiveEventType}
                onChange={setEventType}
                hasTeams={scope === 'team' && teams.length > 0}
              />
            )}
          </Section>

          <Section title="Details" desc="Name, slug, and duration are the essentials.">
            <NameAndSlugFields
              nameLabel="Name"
              initialName={initial.name ?? ''}
              initialSlug={initial.slug ?? ''}
              prefix={prefix}
            />
            <TextAreaField
              label="Description (optional)"
              name="description"
              defaultValue={initial.description ?? ''}
              rows={3}
            />
            <SelectField
              label="Duration"
              name="duration_minutes"
              defaultValue={String(initial.duration_minutes ?? 30)}
              options={DURATION_OPTIONS}
              required
            />
            {effectiveEventType === 'group' && (
              <SelectField
                label="Capacity"
                name="capacity"
                defaultValue={String(initial.capacity ?? 12)}
                options={CAPACITY_OPTIONS}
                hint="Max invitees who can share each slot. Once full, the slot disappears from the booking page."
                required
              />
            )}
            {isOneOff && (
              <>
                <TextField
                  label="Date & time"
                  name="fixed_starts_at_local"
                  type="datetime-local"
                  defaultValue={toLocalDatetimeInput(initial.fixed_starts_at)}
                  hint="The single, fixed time this meeting will run. Invitees confirm attendance instead of picking a slot."
                  required
                />
                <SelectField
                  label="Capacity"
                  name="capacity"
                  defaultValue={String(initial.capacity ?? 1)}
                  options={[{ value: '1', label: '1 invitee (interview)' }, ...CAPACITY_OPTIONS]}
                  hint="1 = traditional one-on-one. Higher = a small group event capped at N attendees."
                />
              </>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={initial.is_active ?? true}
              />
              <span>Active — accept new bookings</span>
            </label>
          </Section>
        </>
      </div>

      <div className={visibleTab === 'availability' && isPoll ? '' : 'hidden'}>
        <PollSlotsEditor
          mtId={initial.id}
          duration={initial.duration_minutes ?? 30}
          initial={initial.poll_slots ?? []}
        />
      </div>

      <div className={visibleTab === 'availability' && !isPoll ? '' : 'hidden'}>
        <>
          <Section
            title="Availability"
            desc={
              <>
                Defaults to your overall{' '}
                <Link href="/settings/availability" className="underline underline-offset-2">
                  working hours
                </Link>
                . Override here when this meeting type only happens at specific times.
              </>
            }
          >
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={availabilityMode === 'default'}
                  onChange={() => setAvailabilityMode('default')}
                />
                <span>Use my default working hours</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={availabilityMode === 'custom'}
                  onChange={() => setAvailabilityMode('custom')}
                />
                <span>Custom for this meeting type</span>
              </label>
            </div>
            {availabilityMode === 'custom' && (
              <div className="pt-2">
                <WorkingHoursEditor value={hours} onChange={setHours} />
              </div>
            )}
          </Section>

          <Section
            title="Scheduling rules"
            desc="Buffers, how soon people can book, and how far ahead."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="Buffer before"
                name="buffer_before_minutes"
                defaultValue={String(initial.buffer_before_minutes ?? 0)}
                options={BUFFER_OPTIONS}
                hint="Quiet time reserved before the meeting starts."
              />
              <SelectField
                label="Buffer after"
                name="buffer_after_minutes"
                defaultValue={String(initial.buffer_after_minutes ?? 0)}
                options={BUFFER_OPTIONS}
                hint="Quiet time reserved after the meeting ends."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="Minimum notice"
                name="min_notice_minutes"
                defaultValue={String(initial.min_notice_minutes ?? 60)}
                options={NOTICE_OPTIONS}
                hint="How late someone can still book."
              />
              <SelectField
                label="Bookable up to"
                name="max_advance_days"
                defaultValue={String(initial.max_advance_days ?? 60)}
                options={ADVANCE_OPTIONS}
                hint="How far in the future the calendar opens."
              />
            </div>
          </Section>

          <Section
            title="Visibility"
            desc="Controls whether this meeting type shows up in your public booking page list. Either way the direct link keeps working."
          >
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="is_public_listed"
                defaultChecked={initial.is_public_listed ?? true}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Available on personal overview page</span>
                <span className="block text-xs text-ink-muted mt-0.5">
                  When checked, this meeting type appears in the list at meet.thefibre.app/{prefix.replace('meet.thefibre.app/', '').replace(/\/$/, '') || 'your-slug'}. Uncheck to keep it bookable only via the direct link.
                </span>
              </span>
            </label>
          </Section>
        </>
      </div>

      <div className={visibleTab === 'conferencing' ? '' : 'hidden'}>
        <>
          <Section title="Conferencing" desc="Where the meeting happens. Zoom requires you to connect it in Settings.">
            <SelectField
              label="Provider"
              name="conferencing_provider"
              defaultValue={initial.conferencing_provider ?? 'google_meet'}
              options={PROVIDERS}
            />
            <TextField
              label="Default location (optional)"
              name="default_location"
              defaultValue={initial.default_location ?? ''}
              placeholder="Address, room, link…"
            />
          </Section>
          <Section
            title="Conflict calendars"
            desc={
              <>
                Which of your calendars block this meeting type. Default uses every
                conflict source you set in{' '}
                <Link href="/settings/calendars" className="underline underline-offset-2">
                  Settings → Calendars
                </Link>
                .
              </>
            }
          >
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={calMode === 'default'}
                  onChange={() => setCalMode('default')}
                />
                <span>Use host default (every conflict-source calendar)</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={calMode === 'custom'}
                  onChange={() => setCalMode('custom')}
                />
                <span>Custom for this meeting type</span>
              </label>
            </div>
            {calMode === 'custom' && (
              <div className="space-y-1.5 pt-2">
                {calendars.length === 0 ? (
                  <p className="text-sm text-ink-subtle">
                    No calendars synced yet. Connect Google in{' '}
                    <Link href="/settings/integrations" className="underline underline-offset-2">
                      Integrations
                    </Link>
                    .
                  </p>
                ) : (
                  calendars.map((cal) => {
                    const checked = calIds.has(cal.id);
                    return (
                      <label
                        key={cal.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = new Set(calIds);
                              if (next.has(cal.id)) next.delete(cal.id);
                              else next.add(cal.id);
                              setCalIds(next);
                            }}
                          />
                          <span className="truncate">{cal.summary ?? cal.id}</span>
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                          {cal.role}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </Section>
        </>
      </div>

      <div className={visibleTab === 'pricing' ? '' : 'hidden'}>
        <Section
          title="Pricing"
          desc="Charge invitees through Stripe Checkout before the booking is confirmed. Free meetings skip payment entirely."
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="pricing_visible"
                checked={pricing === 'free'}
                onChange={() => setPricing('free')}
              />
              <span>Free</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="pricing_visible"
                checked={pricing === 'paid'}
                onChange={() => setPricing('paid')}
              />
              <span>Paid (via Stripe Checkout)</span>
            </label>
          </div>

          {pricing === 'paid' && (
            <div className="mt-4 grid grid-cols-[1fr_140px] gap-3">
              <TextField
                label="Price"
                name="price_major"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                defaultValue={
                  initial.price_cents && initial.price_cents > 0
                    ? (initial.price_cents / 100).toFixed(2)
                    : ''
                }
                placeholder="49.00"
                hint="Excluding tax. Stripe minimum is roughly 0.50 in most currencies."
              />
              <SelectField
                label="Currency"
                name="price_currency"
                defaultValue={initial.price_currency ?? 'eur'}
                options={[
                  { value: 'eur', label: 'EUR' },
                  { value: 'usd', label: 'USD' },
                  { value: 'gbp', label: 'GBP' },
                ]}
              />
            </div>
          )}
          <p className="mt-3 text-xs text-ink-muted">
            Connect Stripe at{' '}
            <Link href="/settings/payments" className="underline underline-offset-2">
              Settings → Payments
            </Link>{' '}
            before saving a paid price. Stripe Checkout on the booking flow is
            queued for Phase 3 — saving a price today reserves the field but
            won't yet trigger payment.
          </p>
        </Section>
      </div>

      <div className={visibleTab === 'intake' ? '' : 'hidden'}>
        <Section
          title="Intake form"
          desc="Ask invitees structured questions when they book. Save the meeting type first, then add fields here."
        >
          {initial.id ? (
            <IntakeEditorSection
              mtId={initial.id}
              initialFields={initial.intake_form?.fields ?? []}
            />
          ) : (
            <p className="text-sm text-ink-subtle">
              Create the meeting type first — the intake editor unlocks once it exists.
            </p>
          )}
        </Section>
      </div>
    </form>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface-raised p-6 space-y-5">
      <div>
        <div className="text-base font-medium">{title}</div>
        {desc && <p className="mt-1 text-sm text-ink-subtle">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

function ScopeCard({
  Icon,
  title,
  desc,
  active,
  disabled,
  onClick,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`text-left rounded-lg border p-4 transition-colors ${
        disabled
          ? 'border-line bg-surface opacity-50 cursor-not-allowed'
          : active
            ? 'border-ink bg-surface-sunken'
            : 'border-line bg-surface hover:bg-surface-sunken'
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 mt-1 text-ink-subtle" strokeWidth={1.5} />
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          <div className="mt-0.5 text-xs text-ink-subtle">{desc}</div>
        </div>
      </div>
    </button>
  );
}

// Convert an ISO timestamp into the "YYYY-MM-DDTHH:MM" string that a
// <input type="datetime-local"> wants. Returns '' if input is empty.
function toLocalDatetimeInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Poll candidate-slots editor. Out-of-band from the main form save — slots
// are managed via PUT /meeting-types/:id/poll-slots once the MT exists.
function PollSlotsEditor({
  mtId,
  duration,
  initial,
}: {
  mtId: string | undefined;
  duration: number;
  initial: { starts_at: string; ends_at: string }[];
}) {
  const [slots, setSlots] = useState<string[]>(() =>
    initial.length > 0
      ? initial.map((s) => toLocalDatetimeInput(s.starts_at))
      : ['', ''],
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!mtId) {
    return (
      <section className="rounded-lg border border-line bg-surface-raised p-6">
        <p className="text-sm text-ink-subtle">
          Save the meeting type first, then add candidate slots here.
        </p>
      </section>
    );
  }

  function setAt(i: number, v: string) {
    const next = [...slots];
    next[i] = v;
    setSlots(next);
  }
  function add() {
    if (slots.length >= 5) return;
    setSlots([...slots, '']);
  }
  function remove(i: number) {
    if (slots.length <= 2) return;
    const next = [...slots];
    next.splice(i, 1);
    setSlots(next);
  }
  async function save() {
    setMsg(null);
    const valid = slots
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const start = new Date(s);
        if (Number.isNaN(start.getTime())) return null;
        return {
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + duration * 60_000).toISOString(),
        };
      })
      .filter((x): x is { starts_at: string; ends_at: string } => x !== null);
    if (valid.length < 2 || valid.length > 5) {
      setMsg('Pick between 2 and 5 valid candidate slots.');
      return;
    }
    setBusy(true);
    const r = await savePollSlots(mtId!, valid);
    setBusy(false);
    setMsg(r.error ?? 'Saved.');
  }

  return (
    <section className="rounded-lg border border-line bg-surface-raised p-6 space-y-4">
      <div>
        <div className="text-base font-medium">Candidate slots</div>
        <p className="mt-1 text-sm text-ink-subtle">
          Add 2–5 specific date/times. Invitees will tick the ones they can
          attend; you confirm the winner from the votes view below.
        </p>
      </div>
      <ul className="space-y-2">
        {slots.map((v, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={v}
              onChange={(e) => setAt(i, e.target.value)}
              className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={slots.length <= 2}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-sunken disabled:opacity-30"
              aria-label="Remove slot"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={add}
          disabled={slots.length >= 5}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm hover:bg-surface-sunken disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} /> Add slot
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-ink text-surface-raised px-4 py-1.5 text-sm font-medium hover:bg-ink/90 disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save slots'}
        </button>
        {msg && <span className="text-xs text-ink-subtle">{msg}</span>}
      </div>
    </section>
  );
}

// Intake editor wrapper: state for the field array + an explicit Save button.
// Saves out-of-band from the main MT PATCH so the form's "Save changes" stays
// focused on the basics — adding/removing intake fields shouldn't have to
// share a submit with slug/conferencing/etc.
function IntakeEditorSection({
  mtId,
  initialFields,
}: {
  mtId: string;
  initialFields: IntakeField[];
}) {
  const [fields, setFields] = useState<IntakeField[]>(initialFields);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setMsg(null);
    const r = await saveIntakeFields(mtId, fields);
    setPending(false);
    setMsg(r.error ? r.error : 'Saved.');
  }

  return (
    <div className="space-y-4">
      <IntakeFieldsEditor fields={fields} onChange={setFields} />
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? 'Saving…' : 'Save intake fields'}
        </Button>
        {msg && (
          <span className={`text-xs ${msg === 'Saved.' ? 'text-emerald-700' : 'text-red-700'}`}>
            {msg}
          </span>
        )}
        {fields.length === 0 && (
          <span className="text-xs text-ink-muted">
            No questions yet — invitees just enter name + email.
          </span>
        )}
      </div>
    </div>
  );
}
