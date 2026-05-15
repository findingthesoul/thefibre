'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  User,
  Users,
  Repeat,
  UsersRound,
  Plus,
  type LucideIcon,
} from 'lucide-react';

type Team = { id: string; name: string; my_role: 'lead' | 'member' };

type EventTypeOption = {
  value: string;
  label: string;
  sub: string;
  desc: string;
  Icon: LucideIcon;
  teamOnly: boolean;
  disabled?: boolean;
};

const EVENT_TYPES: EventTypeOption[] = [
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
    disabled: true,
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
];

export function NewMeetingTypeMenu({ teams }: { teams: Team[] }) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const leadTeams = teams.filter((t) => t.my_role === 'lead');

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPicking(null);
      }
    }
    if (open) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function hrefFor(eventType: string, teamId?: string): string {
    const qs = new URLSearchParams();
    qs.set('event_type', eventType);
    if (teamId) qs.set('team', teamId);
    return `/meeting-types/new?${qs.toString()}`;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink text-surface-raised px-4 py-2 text-sm font-medium hover:bg-ink/90"
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} /> New
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[360px] rounded-lg border border-line bg-surface-raised shadow-lg z-30 overflow-hidden">
          <div className="px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-ink-muted bg-surface-sunken">
            Event type
          </div>
          <ul className="divide-y divide-line">
            {EVENT_TYPES.map((opt) => {
              const isDisabled = opt.disabled;
              const needsTeam = opt.teamOnly && leadTeams.length === 0;
              const muted = isDisabled || needsTeam;
              const onSelect = () => {
                if (muted) return;
                if (opt.teamOnly) setPicking(opt.value);
                else {
                  setOpen(false);
                  window.location.href = hrefFor(opt.value);
                }
              };
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    disabled={muted}
                    onClick={onSelect}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 ${
                      muted
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-surface-sunken'
                    }`}
                  >
                    <opt.Icon className="h-4 w-4 text-ink-subtle mt-0.5 shrink-0" strokeWidth={1.5} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs text-ink-subtle">{opt.sub}</div>
                      <div className="text-xs text-ink-muted mt-0.5">
                        {needsTeam
                          ? 'Lives inside a team — create one first.'
                          : opt.desc}
                      </div>
                    </div>
                  </button>
                  {picking === opt.value && opt.teamOnly && (
                    <div className="bg-surface-sunken px-4 py-2 border-t border-line">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-1">
                        For which team?
                      </div>
                      <ul className="space-y-0.5">
                        {leadTeams.map((t) => (
                          <li key={t.id}>
                            <Link
                              href={hrefFor(opt.value, t.id)}
                              className="block px-2 py-1.5 rounded text-sm hover:bg-surface-raised"
                            >
                              {t.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
