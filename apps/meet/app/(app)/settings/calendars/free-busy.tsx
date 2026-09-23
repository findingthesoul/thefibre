'use client';

// "Most are set to FREE instead of BUSY" (Sjoerd, 2026-09-23). Google's
// availability answer leaves out everything marked Free, so a calendar full
// of self-made blocks reads as an open day. This is the opt-in, per person:
// it decides how MEET reads THIS host's calendars, on every meeting type
// they own, personal and team.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SwitchField } from '@thefibre/shared/ui/switch';
import { ERROR_TEXT } from '@thefibre/shared/ui/recipes';
import { t, type Locale } from '@/lib/i18n-ui';
import { updateHostPrefs } from '../actions';

export function FreeBusyToggle({
  initial,
  locale,
}: {
  initial: boolean;
  locale: Locale;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(next: boolean) {
    setOn(next);
    setError(null);
    startTransition(async () => {
      const r = await updateHostPrefs({ busy_includes_free: next });
      if (r.error) {
        setError(r.error);
        setOn(!next); // the server refused — show what is actually stored
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-6 rounded-lg border border-line bg-surface-raised p-6">
      <SwitchField
        label={t(locale, 'cal_free_busy_label')}
        hint={t(locale, 'cal_free_busy_hint')}
        checked={on}
        disabled={pending}
        onChange={save}
      />
      {error && <div className={`mt-2 ${ERROR_TEXT}`}>{error}</div>}
    </div>
  );
}
