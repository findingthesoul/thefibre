'use client';

// The person's own yes to organisers creating Google Meet / Zoom links on
// their connected account, for threads where they are the main facilitator
// (lib/main-facilitator.ts in the API). Using someone's OAuth credential
// needs THEIR consent, so this lives only here, in their own settings.

import { useState, useTransition } from 'react';
import { SwitchField } from '@/components/ui/switch';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { updateAllowOrganiserMeetings } from '../actions';

export function AllowOrganiserMeetings({ locale, initial }: { locale: Locale; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="max-w-2xl">
      <SwitchField
        label={t(locale, 'allow_organiser_meetings')}
        hint={t(locale, 'allow_organiser_meetings_desc')}
        checked={on}
        disabled={pending}
        onChange={(v) => {
          const before = on;
          setOn(v);
          setError(null);
          startTransition(async () => {
            const r = await updateAllowOrganiserMeetings(v);
            if (!r.ok) {
              setOn(before);
              setError(r.error);
            }
          });
        }}
      />
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
