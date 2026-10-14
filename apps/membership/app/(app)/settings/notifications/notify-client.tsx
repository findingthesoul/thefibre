'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SwitchField } from '@thefibre/shared/ui/switch';
import { t, type Locale } from '@/lib/i18n-ui';
import { saveNotifyMembers } from '../actions';

// One switch, saved when flipped — there is nothing else on the page to
// collect into a form, and a Save button under a single toggle is a second
// step for nothing.
export function NotifyClient({ on: initial, locale }: { on: boolean; locale: Locale }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function flip(v: boolean) {
    setOn(v);
    setError(null);
    const r = await saveNotifyMembers(v);
    if (r.error) {
      setOn(!v);
      setError(r.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-5 space-y-3">
      <SwitchField
        label={t(locale, 'notify_members_label')}
        hint={t(locale, 'notify_members_hint')}
        checked={on}
        onChange={flip}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
