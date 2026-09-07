'use client';

// Per-team availability (Suite parity item 4). A member's weekly hours are
// personal; what they offer THIS team is often narrower. Off by default —
// the row only appears as "custom hours set" once someone sets one.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  WorkingHoursEditor,
  coerceSchedule,
  defaultSchedule,
  type Schedule,
} from '@/components/working-hours-editor';
import { t, type Locale } from '@/lib/i18n-ui';
import { saveTeamMemberHours } from '../actions';

export function TeamHoursButton({
  teamId,
  userId,
  memberName,
  initial,
  locale,
}: {
  teamId: string;
  userId: string;
  memberName: string;
  /** The stored override (raw JSON), or null when they use their own hours. */
  initial: unknown;
  locale: Locale;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'own' | 'custom'>(initial ? 'custom' : 'own');
  const [hours, setHours] = useState<Schedule>(
    initial ? coerceSchedule(initial) : defaultSchedule(),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    start(async () => {
      const r = await saveTeamMemberHours(
        teamId,
        userId,
        mode === 'custom' ? hours : null,
      );
      if (r.error) {
        setError(r.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
      >
        {initial ? t(locale, 'team_hours_set') : t(locale, 'team_hours_edit')}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t(locale, 'team_hours_title')}
        description={`${memberName} — ${t(locale, 'team_hours_desc')}`}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              {t(locale, 'cancel')}
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? t(locale, 'saving') : t(locale, 'save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-2 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="team-hours-mode"
                checked={mode === 'own'}
                onChange={() => setMode('own')}
              />
              {t(locale, 'team_hours_use_own')}
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="team-hours-mode"
                checked={mode === 'custom'}
                onChange={() => setMode('custom')}
              />
              {t(locale, 'team_hours_custom')}
            </label>
          </div>
          {mode === 'custom' && (
            <WorkingHoursEditor value={hours} onChange={setHours} locale={locale} />
          )}
          {error && <div className="text-sm text-red-700">{error}</div>}
        </div>
      </Dialog>
    </>
  );
}
