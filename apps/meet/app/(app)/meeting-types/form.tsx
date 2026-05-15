'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
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

export type TeamOption = { id: string; name: string };
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

type Tab = 'basics' | 'availability' | 'conferencing' | 'pricing' | 'intake';

export function MeetingTypeForm({
  initial,
  teams = [],
  calendars = [],
}: {
  initial: MeetingTypeFormValues;
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

  // Controlled bits that need conditional rendering or input mode changes.
  const [tab, setTab] = useState<Tab>('basics');
  const [teamId, setTeamId] = useState<string>(initial.team_id ?? 'personal');
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

  const teamSelected = teamId !== 'personal';
  const showEventType = teamSelected && teams.length > 0;
  const effectiveEventType = teamSelected ? eventType : 'one_on_one';

  const tabs: { value: Tab; label: string }[] = [
    { value: 'basics', label: 'Basics' },
    { value: 'availability', label: 'Availability' },
    { value: 'conferencing', label: 'Conferencing' },
    { value: 'pricing', label: 'Pricing' },
    { value: 'intake', label: 'Intake' },
  ];

  return (
    <form action={formAction} className="space-y-6">
      {/* Sticky tabs + Save bar at top, like Suite. */}
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
            {state.ok && (
              <span className="text-xs text-emerald-700">Saved.</span>
            )}
            {state.error && (
              <span className="text-xs text-red-700">{state.error}</span>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden inputs that need to ship regardless of which tab is visible. */}
      <input type="hidden" name="team_id" value={teamId} />
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
        <Section title="Details" desc="Name, slug, and duration are the essentials.">
          {teams.length > 0 && (
            <SelectField
              label="Owned by"
              name="team_id_visible"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              options={[
                { value: 'personal', label: 'Personal (your booking page)' },
                ...teams.map((t) => ({ value: t.id, label: `Team — ${t.name}` })),
              ]}
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
          <NameAndSlugFields
            nameLabel="Name"
            initialName={initial.name ?? ''}
            initialSlug={initial.slug ?? ''}
            slugHint="meet.thefibre.app/your-handle/<this>"
          />
          <TextAreaField
            label="Description (optional)"
            name="description"
            defaultValue={initial.description ?? ''}
            rows={3}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TextField
              label="Duration (min)"
              name="duration_minutes"
              type="number"
              min={5}
              max={480}
              defaultValue={initial.duration_minutes ?? 30}
              required
            />
            <TextField
              label="Min notice (min)"
              name="min_notice_minutes"
              type="number"
              min={0}
              defaultValue={initial.min_notice_minutes ?? 60}
            />
            <TextField
              label="Bookable up to (days)"
              name="max_advance_days"
              type="number"
              min={1}
              max={365}
              defaultValue={initial.max_advance_days ?? 60}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              label="Buffer before (min)"
              name="buffer_before_minutes"
              type="number"
              min={0}
              defaultValue={initial.buffer_before_minutes ?? 0}
            />
            <TextField
              label="Buffer after (min)"
              name="buffer_after_minutes"
              type="number"
              min={0}
              defaultValue={initial.buffer_after_minutes ?? 0}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={initial.is_active ?? true}
            />
            <span>Active — accept new bookings</span>
          </label>
        </Section>
      )}

      {tab === 'availability' && (
        <Section
          title="Availability"
          desc={
            <>
              Defaults to your overall{' '}
              <Link
                href="/settings/availability"
                className="underline underline-offset-2"
              >
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
      )}

      {tab === 'conferencing' && (
        <>
          <Section
            title="Conferencing"
            desc="Where the meeting happens. Zoom requires you to connect it in Settings."
          >
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
                Which of your calendars block this meeting type. Default uses
                every conflict source you set in{' '}
                <Link
                  href="/settings/calendars"
                  className="underline underline-offset-2"
                >
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
                    <Link
                      href="/settings/integrations"
                      className="underline underline-offset-2"
                    >
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
            Intake-form editor coming in the next pass. Today every booking
            accepts free-form notes via the Description field.
          </p>
        </Section>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create meeting type'}
        </Button>
        <Link
          href="/meeting-types"
          className="text-sm text-ink-subtle hover:text-ink underline underline-offset-2"
        >
          Cancel
        </Link>
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
