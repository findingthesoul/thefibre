'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import {
  User,
  Users,
  Repeat,
  UsersRound,
  CalendarPlus,
  ListChecks,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';

export type EventTypeOption = {
  value: string;
  labelKey: UiKey;
  subKey: UiKey;
  descKey: UiKey;
  Icon: LucideIcon;
  teamOnly: boolean;
  disabled?: boolean;
  group?: 'event' | 'more';
};

// Single source of truth for event-type presentation. Imported by both
// the global "+ New" menu and the in-editor Event-type picker so they
// stay visually identical (icon, "1 host → N invitees" sub, description).
export const EVENT_TYPES: EventTypeOption[] = [
  {
    value: 'one_on_one',
    labelKey: 'et_one_on_one',
    subKey: 'et_one_on_one_sub',
    descKey: 'et_one_on_one_desc',
    Icon: User,
    teamOnly: false,
  },
  {
    value: 'group',
    labelKey: 'et_group',
    subKey: 'et_group_sub',
    descKey: 'et_group_desc',
    Icon: Users,
    teamOnly: false,
  },
  {
    value: 'round_robin',
    labelKey: 'et_round_robin',
    subKey: 'et_round_robin_sub',
    descKey: 'et_round_robin_desc',
    Icon: Repeat,
    teamOnly: true,
  },
  {
    value: 'collective',
    labelKey: 'et_collective',
    subKey: 'et_collective_sub',
    descKey: 'et_collective_desc',
    Icon: UsersRound,
    teamOnly: true,
  },
  {
    value: 'one_off',
    labelKey: 'et_one_off',
    subKey: 'et_one_off_sub',
    descKey: 'et_one_off_desc',
    Icon: CalendarPlus,
    teamOnly: false,
    group: 'more',
  },
  {
    value: 'poll',
    labelKey: 'et_poll',
    subKey: 'et_poll_sub',
    descKey: 'et_poll_desc',
    Icon: ListChecks,
    teamOnly: false,
    group: 'more',
  },
];

export function EventTypeMenuList({
  onSelect,
  hasTeams,
  variant = 'menu',
  locale,
}: {
  /** Called when an enabled option is picked. */
  onSelect: (value: string) => void;
  /** Whether the caller is a lead of any team — disables team-only rows when false. */
  hasTeams: boolean;
  /** 'menu' for the "+ New" dropdown; 'picker' for the in-editor selector. */
  variant?: 'menu' | 'picker';
  locale: Locale;
}) {
  return (
    <ul className="divide-y divide-line">
      {EVENT_TYPES.map((opt, i) => {
        const isDisabled = opt.disabled;
        const needsTeam = opt.teamOnly && !hasTeams;
        const muted = isDisabled || needsTeam;
        const prev = i > 0 ? EVENT_TYPES[i - 1] : null;
        const isFirstOfMore = opt.group === 'more' && prev?.group !== 'more';
        return (
          <Fragment key={opt.value}>
            {isFirstOfMore && (
              <li className="bg-surface-sunken">
                <div className="px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                  {t(locale, 'more_ways')}
                </div>
              </li>
            )}
            <li>
              <button
                type="button"
                disabled={muted}
                onClick={() => !muted && onSelect(opt.value)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 ${
                  muted
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-surface-sunken'
                }`}
              >
                <opt.Icon
                  className="h-4 w-4 text-ink-subtle mt-0.5 shrink-0"
                  strokeWidth={1.5}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{t(locale, opt.labelKey)}</div>
                  <div className="text-xs text-ink-subtle">{t(locale, opt.subKey)}</div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {needsTeam
                      ? variant === 'picker'
                        ? t(locale, 'needs_team_picker')
                        : t(locale, 'needs_team_menu')
                      : t(locale, opt.descKey)}
                  </div>
                </div>
              </button>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}

/**
 * Controlled rich event-type picker for the meeting-type editor. Shows the
 * currently-selected option as a button (icon + label + sub on a single
 * row) and opens a popover with the full {@link EventTypeMenuList} on
 * click. Mirrors the "+ New" menu so the user sees the same metadata
 * inline that they saw when creating the MT.
 */
export function EventTypePicker({
  value,
  onChange,
  hasTeams,
  locale,
}: {
  value: string;
  onChange: (next: string) => void;
  hasTeams: boolean;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const current = EVENT_TYPES.find((t) => t.value === value) ?? EVENT_TYPES[0];
  const Icon = current.Icon;

  return (
    <div className="space-y-1.5">
      <label className="block text-xs uppercase tracking-wider text-ink-muted">
        {t(locale, 'event_type')}
      </label>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-3 rounded-md border border-line bg-surface-raised px-3 py-2.5 text-left hover:border-ink-muted"
        >
          <Icon className="h-4 w-4 text-ink-subtle shrink-0" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{t(locale, current.labelKey)}</div>
            <div className="text-xs text-ink-subtle">{t(locale, current.subKey)}</div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-ink-muted shrink-0 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
            strokeWidth={1.5}
          />
        </button>
        {open && (
          <div className="absolute left-0 right-0 mt-1 rounded-lg border border-line bg-surface-raised shadow-lg z-30 overflow-hidden">
            <EventTypeMenuList
              hasTeams={hasTeams}
              variant="picker"
              locale={locale}
              onSelect={(v) => {
                onChange(v);
                setOpen(false);
              }}
            />
          </div>
        )}
      </div>
      <p className="text-xs text-ink-muted">{t(locale, current.descKey)}</p>
    </div>
  );
}
