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

export type EventTypeOption = {
  value: string;
  label: string;
  sub: string;
  desc: string;
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
    label: 'One-on-one',
    sub: '1 host → 1 invitee',
    desc: 'Coffee chats, intro calls, 1:1 reviews.',
    Icon: User,
    teamOnly: false,
  },
  {
    value: 'group',
    label: 'Group',
    sub: '1 host → multiple invitees',
    desc: 'Webinars, office hours, classes.',
    Icon: Users,
    teamOnly: false,
  },
  {
    value: 'round_robin',
    label: 'Round-robin',
    sub: 'Rotating hosts → 1 invitee',
    desc: 'Distribute bookings across a team.',
    Icon: Repeat,
    teamOnly: true,
  },
  {
    value: 'collective',
    label: 'Collective',
    sub: 'Multiple hosts → 1 invitee',
    desc: 'Panel interviews, group sales calls.',
    Icon: UsersRound,
    teamOnly: true,
  },
  {
    value: 'one_off',
    label: 'One-off meeting',
    sub: 'A single time, outside your schedule',
    desc: 'Offer a single time outside your normal schedule.',
    Icon: CalendarPlus,
    teamOnly: false,
    group: 'more',
  },
  {
    value: 'poll',
    label: 'Meeting poll',
    sub: 'Invitees vote on a time',
    desc: 'Let invitees vote on a time to meet.',
    Icon: ListChecks,
    teamOnly: false,
    group: 'more',
  },
];

export function EventTypeMenuList({
  onSelect,
  hasTeams,
  variant = 'menu',
}: {
  /** Called when an enabled option is picked. */
  onSelect: (value: string) => void;
  /** Whether the caller is a lead of any team — disables team-only rows when false. */
  hasTeams: boolean;
  /** 'menu' for the "+ New" dropdown; 'picker' for the in-editor selector. */
  variant?: 'menu' | 'picker';
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
                  More ways to meet
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
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-ink-subtle">{opt.sub}</div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {needsTeam
                      ? variant === 'picker'
                        ? 'Switch to Team scope to use this.'
                        : 'Lives inside a team — create one first.'
                      : opt.desc}
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
}: {
  value: string;
  onChange: (next: string) => void;
  hasTeams: boolean;
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
        Event type
      </label>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-3 rounded-md border border-line bg-surface-raised px-3 py-2.5 text-left hover:border-ink-muted"
        >
          <Icon className="h-4 w-4 text-ink-subtle shrink-0" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{current.label}</div>
            <div className="text-xs text-ink-subtle">{current.sub}</div>
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
              onSelect={(v) => {
                onChange(v);
                setOpen(false);
              }}
            />
          </div>
        )}
      </div>
      <p className="text-xs text-ink-muted">{current.desc}</p>
    </div>
  );
}
