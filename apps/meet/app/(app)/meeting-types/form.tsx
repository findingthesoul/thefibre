'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { User, Users as TeamIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import {
  WorkingHoursEditor,
  defaultSchedule,
  type Schedule,
} from '@/components/working-hours-editor';
import { createMeetingType, updateMeetingType, type SaveResult } from './actions';

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
  team_id?: string | null;
  event_type?: string;
  working_hours_override?: Schedule | null;
  conflict_calendar_ids?: string[] | null;
  intake_form_id?: string | null;
  price_cents?: number | null;
  price_currency?: string | null;
};

export type TeamOption = { id: string; name: string; slug?: string };
export type CalendarOption = {
  id: string;
  summary: string | null;
  role: 'primary' | 'conflict_check' | 'write_target' | 'ignore';
};

const EVENT_TYPES = [
  {
    value: 'one_on_one',
    label: 'One-on-one',
    hint: 'Single host. The classic booking.',
  },
  {
    value: 'round_robin',
    label: 'Round-robin',
    hint: 'Multiple eligible hosts; bookings rotate to the least-loaded one.',
  },
  {
    value: 'collective',
    label: 'Collective',
    hint: 'Every assigned host attends. Slots intersect their availability.',
  },
];

const PROVIDERS = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'teams', label: 'Microsoft Teams' },
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
  const [hours, setHours] = useState<Schedule>(
    (initial.working_hours_override as Schedule | null) ?? defaultSchedule(),
  );
  const [calMode, setCalMode] = useState<'default' | 'custom'>(
    initial.conflict_calendar_ids ? 'custom' : 'default',
  );
  const [calIds, setCalIds] = useState<Set<string>>(
    new Set(initial.conflict_calendar_ids ?? []),
  );
  const [pricing, setPricing] = useState<'free' | 'paid'>(
    initial.price_cents && initial.price_cents > 0 ? 'paid' : 'free',
  );

  const showEventType = scope === 'team' && teams.length > 0;
  const effectiveEventType = scope === 'team' ? eventType : 'one_on_one';
  const effectiveTeamId = scope === 'team' && teamId ? teamId : '';

  // Slug prefix depends on scope. For personal: meet.thefibre.app/<host-slug>/
  // For team: meet.thefibre.app/<team-slug>/
  const teamSlugForPrefix = teams.find((t) => t.id === effectiveTeamId)?.slug;
  const prefix =
    scope === 'team' && teamSlugForPrefix
      ? `meet.thefibre.app/${teamSlugForPrefix}/`
      : hostSlug
        ? `meet.thefibre.app/${hostSlug}/`
        : `meet.thefibre.app/your-handle/`;

  const tabs: { value: Tab; label: string }[] = [
    { value: 'basics', label: 'Basics' },
    { value: 'availability', label: 'Availability' },
    { value: 'conferencing', label: 'Conferencing' },
    { value: 'pricing', label: 'Pricing' },
    { value: 'intake', label: 'Intake' },
  ];

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
                  tab === t.value
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

      {tab === 'basics' && (
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
              <SelectField
                label="Event type"
                name="event_type_visible"
                value={effectiveEventType}
                onChange={(e) => setEventType(e.target.value)}
                options={EVENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                hint={EVENT_TYPES.find((t) => t.value === effectiveEventType)?.hint}
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
      )}

      {tab === 'availability' && (
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
        </>
      )}

      {tab === 'conferencing' && (
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
      )}

      {tab === 'pricing' && (
        <Section
          title="Pricing"
          desc="Charge invitees through Stripe Checkout before the booking is confirmed. Free meetings skip payment entirely."
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={pricing === 'free'}
                onChange={() => setPricing('free')}
              />
              <span>Free</span>
            </label>
            <label className="flex items-center gap-2 text-sm opacity-50">
              <input
                type="radio"
                checked={pricing === 'paid'}
                disabled
                onChange={() => setPricing('paid')}
              />
              <span>
                Paid (via Stripe Checkout) —{' '}
                <span className="text-ink-muted">Coming when Stripe is wired</span>
              </span>
            </label>
          </div>
        </Section>
      )}

      {tab === 'intake' && (
        <Section
          title="Intake form"
          desc="Ask invitees structured questions when they book. Edit fields after creating the meeting type."
        >
          <p className="text-sm text-ink-subtle">
            Intake-form editor coming in the next pass. Today every booking accepts free-form notes via the Description field.
          </p>
        </Section>
      )}
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
