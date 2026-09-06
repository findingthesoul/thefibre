'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarRange, Route, User, Users, type LucideIcon } from 'lucide-react';
import type { Locale } from '@thefibre/shared';
import { createThread } from '../actions';
import type { TeamOption } from '@/lib/thread-types';
import { t } from '@/lib/i18n-ui';
import { NameAndSlugFields } from '@/components/ui/name-slug';
import { TextAreaField, SelectField } from '@/components/ui/field';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/page';

const THREAD_HOST =
  process.env.NEXT_PUBLIC_THREAD_URL?.replace(/^https?:\/\//, '') ?? 'app.thethread.app';

export function NewThreadForm({
  locale,
  organiserSlug,
  teams,
}: {
  locale: Locale;
  organiserSlug: string;
  teams: TeamOption[];
}) {
  const router = useRouter();
  const [format, setFormat] = useState<'event' | 'journey'>('event');
  const [scope, setScope] = useState<'personal' | 'team'>('personal');
  // Controlled so the URL preview follows: team threads live under the
  // team's public slug, not the organiser's.
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  // End date can only follow the start date.
  const [startsOn, setStartsOn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('name') ?? '').trim();
    const slug = String(fd.get('slug') ?? '').trim();
    const intention = String(fd.get('intention') ?? '').trim();
    const startsOn = String(fd.get('starts_on') ?? '');
    const endsOn = String(fd.get('ends_on') ?? '');
    if (!title) return setError(t(locale, 'err_thread_name'));
    if (!slug) return setError(t(locale, 'err_pick_slug'));

    const teamId = scope === 'team' ? String(fd.get('team_id') ?? '') : '';
    if (scope === 'team' && !teamId) return setError(t(locale, 'err_pick_team'));

    startTransition(async () => {
      const r = await createThread({
        title,
        format,
        slug,
        intention: intention || null,
        starts_on: startsOn || null,
        ends_on: endsOn || null,
        team_id: teamId || null,
      });
      if (!r.ok) return setError(r.error);
      // push alone fetches the new route fresh; a synchronous router.refresh()
      // here races the navigation and lands an empty page until a manual
      // reload (matches the working certificate/duplicate/template flows).
      router.push(`/threads/${r.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-8">
      {/* Compact toggles (Sjoerd 2026-07-02) — the explanation of the active
          choice sits underneath, so the form keeps its context without the
          big-card real estate. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
        <div>
          <SectionLabel>{t(locale, 'kind')}</SectionLabel>
          <div className="mt-2 grid grid-cols-2 rounded-md border border-line overflow-hidden h-[38px]">
            <ToggleButton
              Icon={CalendarRange}
              label={t(locale, 'event')}
              active={format === 'event'}
              onClick={() => setFormat('event')}
            />
            <ToggleButton
              Icon={Route}
              label={t(locale, 'journey')}
              active={format === 'journey'}
              onClick={() => setFormat('journey')}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
            {format === 'event' ? t(locale, 'kind_event_desc') : t(locale, 'kind_journey_desc')}
          </p>
        </div>

        <div>
          <SectionLabel>{t(locale, 'scope')}</SectionLabel>
          <div className="mt-2 grid grid-cols-2 rounded-md border border-line overflow-hidden h-[38px]">
            <ToggleButton
              Icon={User}
              label={t(locale, 'personal')}
              active={scope === 'personal'}
              onClick={() => setScope('personal')}
            />
            <ToggleButton
              Icon={Users}
              label={t(locale, 'team')}
              active={scope === 'team'}
              disabled={!teams.length}
              onClick={() => teams.length && setScope('team')}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
            {scope === 'personal'
              ? t(locale, 'scope_personal_desc')
              : t(locale, 'scope_team_desc')}
          </p>
          {scope === 'team' && (
            <div className="mt-3">
              <SelectField
                label={t(locale, 'team')}
                name="team_id"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                options={teams.map((t) => ({ value: t.id, label: t.name }))}
              />
            </div>
          )}
        </div>
      </div>

      <NameAndSlugFields
        locale={locale}
        nameLabel={t(locale, 'name')}
        prefix={`${THREAD_HOST}/${
          scope === 'team'
            ? teams.find((tm) => tm.id === teamId)?.slug ?? organiserSlug
            : organiserSlug
        }/`}
        slugHint={t(locale, 'slug_hint_simple')}
      />

      <TextAreaField
        label={t(locale, 'intention')}
        name="intention"
        rows={3}
        hint={t(locale, 'intention_hint')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateField label={t(locale, 'starts_on')} name="starts_on" onValueChange={setStartsOn} />
        <DateField label={t(locale, 'ends_on')} name="ends_on" min={startsOn || null} />
      </div>

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t(locale, 'creating') : t(locale, 'create_thread')}
        </Button>
      </div>
    </form>
  );
}

function ToggleButton({
  Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 text-sm transition-colors ${
        disabled
          ? 'text-ink-muted cursor-not-allowed opacity-50'
          : active
            ? 'bg-surface-sunken text-ink font-medium'
            : 'bg-surface text-ink-subtle hover:text-ink hover:bg-surface-sunken'
      }`}
    >
      <Icon size={15} strokeWidth={1.75} />
      {label}
    </button>
  );
}
