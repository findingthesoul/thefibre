'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { User, Users as TeamIcon, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TextField, SelectField, TextAreaField } from '@/components/ui/field';
import { DateTimeField } from '@/components/ui/date-field';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import { EVENT_TYPES, EventTypePicker } from '@/components/event-type-picker';
import { IntakeFieldsEditor } from '@/components/intake-fields-editor';
import type { IntakeField } from '@/lib/intake';
import {
  WorkingHoursEditor,
  coerceSchedule,
  type Schedule,
} from '@/components/working-hours-editor';
import { t, type Locale } from '@/lib/i18n-ui';
import { createMeetingType, savePollSlots, saveIntakeFields, updateMeetingType, type SaveResult } from './actions';
import { MEET_HOST } from '@/lib/public-host';

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
  requires_approval?: boolean | null;
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

type Tab = 'basics' | 'availability' | 'conferencing' | 'pricing' | 'intake';

export function MeetingTypeForm({
  initial,
  hostSlug,
  teams = [],
  calendars = [],
  locale,
}: {
  initial: MeetingTypeFormValues;
  /** The current user's own host slug — used to render the personal URL prefix. */
  hostSlug?: string | null;
  teams?: TeamOption[];
  calendars?: CalendarOption[];
  locale: Locale;
}) {
  const isEdit = !!initial.id;
  const action = isEdit
    ? updateMeetingType.bind(null, initial.id!)
    : createMeetingType;
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    action as (prev: SaveResult, fd: FormData) => Promise<SaveResult>,
    {},
  );

  const CAPACITY_OPTIONS = [2, 4, 6, 8, 10, 12, 15, 20, 30, 50].map((n) => ({
    value: String(n),
    label: t(locale, 'opt_n_invitees', { n }),
  }));

  const PROVIDERS = [
    { value: 'google_meet', label: 'Google Meet' },
    // Zoom + Teams need OAuth integrations not yet built; show them disabled
    // so the user sees they're planned without being able to pick a broken
    // option (which previously saved fine but generated no meeting URL).
    { value: 'zoom', label: 'Zoom', disabled: true },
    { value: 'teams', label: 'Microsoft Teams', disabled: true },
    { value: 'in_person', label: t(locale, 'provider_in_person') },
    { value: 'personal_room', label: t(locale, 'provider_personal_room') },
    { value: 'none', label: t(locale, 'provider_none') },
  ];

  const DURATION_OPTIONS = [
    ...[15, 20, 30, 45, 60, 90].map((n) => ({
      value: String(n),
      label: t(locale, 'opt_n_minutes', { n }),
    })),
    { value: '120', label: t(locale, 'opt_n_hours', { n: 2 }) },
  ];

  const BUFFER_OPTIONS = [
    { value: '0', label: t(locale, 'opt_none') },
    ...[5, 10, 15, 30, 60].map((n) => ({
      value: String(n),
      label: t(locale, 'opt_n_min', { n }),
    })),
  ];

  const NOTICE_OPTIONS = [
    { value: '0', label: t(locale, 'opt_none') },
    { value: '15', label: t(locale, 'opt_n_min', { n: 15 }) },
    { value: '30', label: t(locale, 'opt_n_min', { n: 30 }) },
    { value: '60', label: t(locale, 'opt_1_hour') },
    { value: '120', label: t(locale, 'opt_n_hours', { n: 2 }) },
    { value: '240', label: t(locale, 'opt_n_hours', { n: 4 }) },
    { value: '1440', label: t(locale, 'opt_1_day') },
    { value: '2880', label: t(locale, 'opt_n_days', { n: 2 }) },
    { value: '10080', label: t(locale, 'opt_1_week') },
  ];

  const ADVANCE_OPTIONS = [
    { value: '1', label: t(locale, 'opt_1_day') },
    ...[3, 7, 14, 30, 60, 90, 180].map((n) => ({
      value: String(n),
      label: t(locale, 'opt_n_days', { n }),
    })),
    { value: '365', label: t(locale, 'opt_1_year') },
  ];

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
      : EVENT_TYPES.filter((x) => PERSONAL_EVENT_TYPES.has(x.value))
  );
  const validEventType = eventTypeOptions.some((x) => x.value === eventType)
    ? eventType
    : 'one_on_one';
  const effectiveEventType = validEventType;
  // Fall back to the first team when the user has flipped scope to "team"
  // but hasn't actively changed the Team select. Without this fallback the
  // hidden team_id input posts "" and the server stores the MT as personal.
  const effectiveTeamId =
    scope === 'team' ? teamId || teams[0]?.id || '' : '';

  // Slug prefix depends on scope. For personal: <meet-host>/<host-slug>/
  // For team: <meet-host>/<team-slug>/
  // If the team scope is selected but no team is picked yet, fall back to
  // the first team in the list (which is the visible default).
  const fallbackTeamId = effectiveTeamId || teams[0]?.id;
  const teamSlugForPrefix = teams.find((x) => x.id === fallbackTeamId)?.slug;
  const prefix =
    scope === 'team' && teamSlugForPrefix
      ? `${MEET_HOST}/${teamSlugForPrefix}/`
      : hostSlug
        ? `${MEET_HOST}/${hostSlug}/`
        : `${MEET_HOST}/`;

  // Availability is hidden for one_off (single fixed time, nothing to schedule)
  // and repurposed for poll into a candidate-slots editor (label changes).
  const isOneOff = effectiveEventType === 'one_off';
  const isPoll = effectiveEventType === 'poll';
  const tabs: { value: Tab; label: string }[] = [
    { value: 'basics', label: t(locale, 'tab_basics') },
    ...(isOneOff
      ? []
      : [
          {
            value: 'availability' as Tab,
            label: isPoll ? t(locale, 'candidate_slots') : t(locale, 'st_availability'),
          },
        ]),
    { value: 'conferencing', label: t(locale, 'tab_conferencing') },
    { value: 'pricing', label: t(locale, 'tab_pricing') },
    { value: 'intake', label: t(locale, 'tab_intake') },
  ];
  const visibleTab: Tab = tabs.some((x) => x.value === tab) ? tab : 'basics';

  return (
    <form action={formAction} className="space-y-6">
      <div className="sticky top-0 z-10 -mx-10 px-10 bg-surface/80 backdrop-blur border-b border-line">
        <div className="flex items-center justify-between gap-3 py-3">
          <nav className="flex items-center gap-1 text-sm">
            {tabs.map((x) => (
              <button
                key={x.value}
                type="button"
                onClick={() => setTab(x.value)}
                className={`px-3 py-1.5 rounded-md ${
                  visibleTab === x.value
                    ? 'bg-ink text-surface-raised'
                    : 'text-ink-subtle hover:text-ink hover:bg-surface-sunken'
                }`}
              >
                {x.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {state.ok && <span className="text-xs text-emerald-700">{t(locale, 'saved')}</span>}
            {state.error && <span className="text-xs text-red-700">{state.error}</span>}
            <Button type="submit" disabled={pending}>
              {pending ? t(locale, 'saving') : isEdit ? t(locale, 'save_changes') : t(locale, 'create')}
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
          <Section title={t(locale, 'scope')} desc={t(locale, 'scope_section_desc')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ScopeCard
                Icon={User}
                title={t(locale, 'personal')}
                desc={t(locale, 'scope_personal_desc')}
                active={scope === 'personal'}
                onClick={() => setScope('personal')}
              />
              <ScopeCard
                Icon={TeamIcon}
                title={t(locale, 'team')}
                desc={teams.length === 0 ? t(locale, 'scope_team_none') : t(locale, 'scope_team_desc')}
                active={scope === 'team'}
                disabled={teams.length === 0}
                onClick={() => setScope('team')}
              />
            </div>
            {scope === 'team' && teams.length > 0 && (
              <SelectField
                label={t(locale, 'team')}
                name="team_id_visible"
                value={teamId || teams[0]!.id}
                onChange={(e) => setTeamId(e.target.value)}
                options={teams.map((x) => ({ value: x.id, label: x.name }))}
              />
            )}
            {showEventType && (
              <EventTypePicker
                value={effectiveEventType}
                onChange={setEventType}
                hasTeams={scope === 'team' && teams.length > 0}
                locale={locale}
              />
            )}
          </Section>

          <Section title={t(locale, 'details_section')} desc={t(locale, 'details_desc')}>
            <NameAndSlugFields
              nameLabel={t(locale, 'name')}
              slugLabel={t(locale, 'public_url')}
              initialName={initial.name ?? ''}
              initialSlug={initial.slug ?? ''}
              prefix={prefix}
              locale={locale}
            />
            <TextAreaField
              label={t(locale, 'description_optional')}
              name="description"
              defaultValue={initial.description ?? ''}
              rows={3}
            />
            <SelectField
              label={t(locale, 'duration')}
              name="duration_minutes"
              defaultValue={String(initial.duration_minutes ?? 30)}
              options={DURATION_OPTIONS}
              required
            />
            {effectiveEventType === 'group' && (
              <SelectField
                label={t(locale, 'capacity')}
                name="capacity"
                defaultValue={String(initial.capacity ?? 12)}
                options={CAPACITY_OPTIONS}
                hint={t(locale, 'capacity_hint')}
                required
              />
            )}
            {isOneOff && (
              <>
                <DateTimeField
                  label={t(locale, 'datetime_label')}
                  name="fixed_starts_at_local"
                  defaultValue={toLocalDatetimeInput(initial.fixed_starts_at)}
                  hint={t(locale, 'datetime_hint')}
                  required
                />
                <SelectField
                  label={t(locale, 'capacity')}
                  name="capacity"
                  defaultValue={String(initial.capacity ?? 1)}
                  options={[{ value: '1', label: t(locale, 'opt_1_invitee_interview') }, ...CAPACITY_OPTIONS]}
                  hint={t(locale, 'capacity_one_hint')}
                />
              </>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={initial.is_active ?? true}
              />
              <span>{t(locale, 'active_accept')}</span>
            </label>
          </Section>
        </>
      </div>

      <div className={visibleTab === 'availability' && isPoll ? '' : 'hidden'}>
        <PollSlotsEditor
          mtId={initial.id}
          duration={initial.duration_minutes ?? 30}
          initial={initial.poll_slots ?? []}
          locale={locale}
        />
      </div>

      <div className={visibleTab === 'availability' && !isPoll ? '' : 'hidden'}>
        <>
          <Section
            title={t(locale, 'st_availability')}
            desc={
              <>
                {t(locale, 'av_defaults_prefix')}{' '}
                <Link href="/settings/availability" className="underline underline-offset-2">
                  {t(locale, 'working_hours_link')}
                </Link>
                {t(locale, 'av_defaults_suffix')}
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
                <span>{t(locale, 'use_default_hours')}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={availabilityMode === 'custom'}
                  onChange={() => setAvailabilityMode('custom')}
                />
                <span>{t(locale, 'custom_for_mt')}</span>
              </label>
            </div>
            {availabilityMode === 'custom' && (
              <div className="pt-2">
                <WorkingHoursEditor value={hours} onChange={setHours} locale={locale} />
              </div>
            )}
          </Section>

          <Section
            title={t(locale, 'scheduling_rules')}
            desc={t(locale, 'scheduling_desc')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label={t(locale, 'buffer_before')}
                name="buffer_before_minutes"
                defaultValue={String(initial.buffer_before_minutes ?? 0)}
                options={BUFFER_OPTIONS}
                hint={t(locale, 'buffer_before_hint')}
              />
              <SelectField
                label={t(locale, 'buffer_after')}
                name="buffer_after_minutes"
                defaultValue={String(initial.buffer_after_minutes ?? 0)}
                options={BUFFER_OPTIONS}
                hint={t(locale, 'buffer_after_hint')}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label={t(locale, 'min_notice')}
                name="min_notice_minutes"
                defaultValue={String(initial.min_notice_minutes ?? 60)}
                options={NOTICE_OPTIONS}
                hint={t(locale, 'min_notice_hint')}
              />
              <SelectField
                label={t(locale, 'bookable_up_to')}
                name="max_advance_days"
                defaultValue={String(initial.max_advance_days ?? 60)}
                options={ADVANCE_OPTIONS}
                hint={t(locale, 'bookable_hint')}
              />
            </div>
          </Section>

          <Section
            title={t(locale, 'visibility_section')}
            desc={t(locale, 'mt_visibility_desc')}
          >
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="is_public_listed"
                defaultChecked={initial.is_public_listed ?? true}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{t(locale, 'public_listed')}</span>
                <span className="block text-xs text-ink-muted mt-0.5">
                  {t(locale, 'public_listed_hint', {
                    url: `${MEET_HOST}/${prefix.replace(`${MEET_HOST}/`, '').replace(/\/$/, '') || 'your-slug'}`,
                  })}
                </span>
              </span>
            </label>
          </Section>

          <Section
            title={t(locale, 'approval_section')}
            desc={t(locale, 'approval_desc')}
          >
            {/* Radio group with 3 modes encoded as a string: default/always/never.
                bodyFromForm maps to: null / true / false respectively. */}
            <div className="space-y-2 text-sm">
              {(
                [
                  {
                    value: 'default',
                    label: t(locale, 'approval_default'),
                    hint: t(locale, 'approval_default_hint'),
                  },
                  {
                    value: 'always',
                    label: t(locale, 'approval_always'),
                    hint: t(locale, 'approval_always_hint'),
                  },
                  {
                    value: 'never',
                    label: t(locale, 'approval_never'),
                    hint: t(locale, 'approval_never_hint'),
                  },
                ] as const
              ).map((opt) => {
                const checked =
                  (initial.requires_approval === null || initial.requires_approval === undefined) && opt.value === 'default'
                    ? true
                    : initial.requires_approval === true && opt.value === 'always'
                      ? true
                      : initial.requires_approval === false && opt.value === 'never'
                        ? true
                        : false;
                return (
                  <label key={opt.value} className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="approval_mode"
                      value={opt.value}
                      defaultChecked={checked}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">{opt.label}</span>
                      <span className="block text-xs text-ink-muted mt-0.5">{opt.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Section>
        </>
      </div>

      <div className={visibleTab === 'conferencing' ? '' : 'hidden'}>
        <>
          <Section title={t(locale, 'tab_conferencing')} desc={t(locale, 'conferencing_section_desc')}>
            <SelectField
              label={t(locale, 'provider')}
              name="conferencing_provider"
              defaultValue={initial.conferencing_provider ?? 'google_meet'}
              options={PROVIDERS}
            />
            <TextField
              label={t(locale, 'default_location_optional')}
              name="default_location"
              defaultValue={initial.default_location ?? ''}
              placeholder={t(locale, 'location_placeholder')}
            />
          </Section>
          <Section
            title={t(locale, 'conflict_cals_section')}
            desc={
              <>
                {t(locale, 'conflict_cals_prefix')}{' '}
                <Link href="/settings/calendars" className="underline underline-offset-2">
                  {t(locale, 'settings_calendars_link')}
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
                <span>{t(locale, 'use_host_default_cals')}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={calMode === 'custom'}
                  onChange={() => setCalMode('custom')}
                />
                <span>{t(locale, 'custom_for_mt')}</span>
              </label>
            </div>
            {calMode === 'custom' && (
              <div className="space-y-1.5 pt-2">
                {calendars.length === 0 ? (
                  <p className="text-sm text-ink-subtle">
                    {t(locale, 'no_cals_prefix')}{' '}
                    <Link href="/settings/integrations" className="underline underline-offset-2">
                      {t(locale, 'integrations_link')}
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
          title={t(locale, 'tab_pricing')}
          desc={t(locale, 'pricing_section_desc')}
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="pricing_visible"
                value="free"
                checked={pricing === 'free'}
                onChange={() => setPricing('free')}
              />
              <span>{t(locale, 'free')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="pricing_visible"
                value="paid"
                checked={pricing === 'paid'}
                onChange={() => setPricing('paid')}
              />
              <span>{t(locale, 'paid_via_stripe')}</span>
            </label>
          </div>

          {pricing === 'paid' && (
            <div className="mt-4 grid grid-cols-[1fr_140px] gap-3">
              <TextField
                label={t(locale, 'price')}
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
                hint={t(locale, 'price_hint')}
              />
              <SelectField
                label={t(locale, 'currency')}
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
            {t(locale, 'pricing_note_prefix')}{' '}
            <Link href="/settings/payments" className="underline underline-offset-2">
              {t(locale, 'settings_payments_link')}
            </Link>{' '}
            {t(locale, 'pricing_note_suffix')}
          </p>
        </Section>
      </div>

      <div className={visibleTab === 'intake' ? '' : 'hidden'}>
        <Section
          title={t(locale, 'intake_section')}
          desc={t(locale, 'intake_desc')}
        >
          {initial.id ? (
            <IntakeEditorSection
              mtId={initial.id}
              initialFields={initial.intake_form?.fields ?? []}
              locale={locale}
            />
          ) : (
            <p className="text-sm text-ink-subtle">
              {t(locale, 'intake_create_first')}
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
  locale,
}: {
  mtId: string | undefined;
  duration: number;
  initial: { starts_at: string; ends_at: string }[];
  locale: Locale;
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
          {t(locale, 'poll_save_first')}
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
      setMsg(t(locale, 'poll_pick_valid'));
      return;
    }
    setBusy(true);
    const r = await savePollSlots(mtId!, valid);
    setBusy(false);
    setMsg(r.error ?? t(locale, 'saved'));
  }

  return (
    <section className="rounded-lg border border-line bg-surface-raised p-6 space-y-4">
      <div>
        <div className="text-base font-medium">{t(locale, 'candidate_slots')}</div>
        <p className="mt-1 text-sm text-ink-subtle">
          {t(locale, 'poll_editor_desc')}
        </p>
      </div>
      <ul className="space-y-2">
        {slots.map((v, i) => (
          <li key={i} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <DateTimeField value={v} onChange={(nv) => setAt(i, nv)} />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={slots.length <= 2}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-sunken disabled:opacity-30"
              aria-label={t(locale, 'remove_slot')}
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
          <Plus className="h-4 w-4" strokeWidth={1.5} /> {t(locale, 'add_slot')}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-ink text-surface-raised px-4 py-1.5 text-sm font-medium hover:bg-ink/90 disabled:opacity-40"
        >
          {busy ? t(locale, 'saving') : t(locale, 'save_slots')}
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
  locale,
}: {
  mtId: string;
  initialFields: IntakeField[];
  locale: Locale;
}) {
  const [fields, setFields] = useState<IntakeField[]>(initialFields);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setMsg(null);
    const r = await saveIntakeFields(mtId, fields);
    setPending(false);
    setMsg(r.error ? r.error : t(locale, 'saved'));
  }

  return (
    <div className="space-y-4">
      <IntakeFieldsEditor fields={fields} onChange={setFields} locale={locale} />
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? t(locale, 'saving') : t(locale, 'save_intake')}
        </Button>
        {msg && (
          <span className={`text-xs ${msg === t(locale, 'saved') ? 'text-emerald-700' : 'text-red-700'}`}>
            {msg}
          </span>
        )}
        {fields.length === 0 && (
          <span className="text-xs text-ink-muted">
            {t(locale, 'intake_none_note')}
          </span>
        )}
      </div>
    </div>
  );
}
