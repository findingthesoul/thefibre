'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { EventTypeMenuList } from '@/components/event-type-picker';
import { t, type Locale } from '@/lib/i18n-ui';

type Team = { id: string; name: string; my_role: 'lead' | 'member' };

export function NewMeetingTypeMenu({ teams, locale }: { teams: Team[]; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const leadTeams = teams.filter((t) => t.my_role === 'lead');

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink text-surface-raised px-4 py-2 text-sm font-medium hover:bg-ink/90"
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} /> {t(locale, 'new')}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[360px] rounded-lg border border-line bg-surface-raised shadow-lg z-30 overflow-hidden">
          <div className="px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-ink-muted bg-surface-sunken">
            {t(locale, 'event_type')}
          </div>
          <EventTypeMenuList
            hasTeams={leadTeams.length > 0}
            variant="menu"
            locale={locale}
            onSelect={(value) => {
              setOpen(false);
              const qs = new URLSearchParams({ event_type: value });
              window.location.href = `/meeting-types/new?${qs.toString()}`;
            }}
          />
        </div>
      )}
    </div>
  );
}
