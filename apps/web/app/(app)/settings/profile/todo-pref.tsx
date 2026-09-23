'use client';

// The To do panel's on/off (Sjoerd, 2026-09-23 — asked where it should live,
// he said "profile settings").
//
// Per PERSON, not per workspace and not a plan gate: your own list is nobody
// else's business. The durable copy is identity_profile.todo_enabled, which
// is why this is not a cookie like the LauncherPref above it — switching it
// off on a laptop has to switch it off on a phone.
//
// Save-on-change with an optimistic revert, the LanguagePicker pattern. The
// chrome that draws the button is server-rendered from /auth/me, so a save
// must router.refresh() for the button to appear or go (the v0.3.11 gotcha:
// revalidatePath alone does not refresh the client route).

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SwitchField } from '@thefibre/shared/ui/switch';
import { saveTodoEnabled } from '../actions';
import { t, type Locale } from '@/lib/i18n-ui';

export function TodoPref({ initial, locale }: { initial: boolean; locale: Locale }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onChange(next: boolean) {
    const previous = on;
    setOn(next);
    setError(null);
    startTransition(async () => {
      const r = await saveTodoEnabled(next);
      if (!r.ok) {
        setOn(previous);
        setError(r.error ?? t(locale, 'could_not_save'));
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="mt-12 border-t border-line pt-8">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">
        {t(locale, 'todo')}
      </div>
      <div className="mt-3 max-w-md">
        <SwitchField
          label={t(locale, 'todo_enabled_label')}
          hint={t(locale, 'todo_enabled_help')}
          checked={on}
          onChange={onChange}
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    </section>
  );
}
