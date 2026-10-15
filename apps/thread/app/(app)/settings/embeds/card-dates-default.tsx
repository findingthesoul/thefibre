'use client';

// What every thread card shows by default (thread dates part 3, Sjoerd
// 2026-10-16) — the workspace's choice; each embed may override it with
// data-dates / data-sessions / data-signup-by (the generator below writes
// those). Saved to thread_settings.card_dates through PATCH /settings.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@thefibre/shared';
import type { CardDates, CardRange } from '@thefibre/shared/thread-dates';
import { t } from '@/lib/i18n-ui';
import { SectionLabel } from '@/components/ui/page';
import { SelectField } from '@/components/ui/field';
import { SwitchField } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { updateWorkspaceSettings } from '../actions';

export function CardDatesDefault({ locale, initial }: { locale: Locale; initial: CardDates }) {
  const router = useRouter();
  const [value, setValue] = useState<CardDates>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (p: Partial<CardDates>) => {
    setValue((v) => ({ ...v, ...p }));
    setSaved(false);
  };

  return (
    <section>
      <SectionLabel>{t(locale, 'card_dates_settings_title')}</SectionLabel>
      <p className="mt-1.5 text-xs text-ink-subtle">{t(locale, 'card_dates_settings_hint')}</p>
      <div className="mt-3 max-w-md space-y-3">
        <SelectField
          label={t(locale, 'embed_card_dates')}
          value={value.range}
          onChange={(e) => set({ range: e.target.value as CardRange })}
          options={[
            { value: 'event', label: t(locale, 'embed_cd_event') },
            { value: 'thread', label: t(locale, 'embed_cd_thread') },
            { value: 'start_thread', label: t(locale, 'embed_cd_start_thread') },
            { value: 'start_event', label: t(locale, 'embed_cd_start_event') },
          ]}
        />
        <SwitchField label={t(locale, 'embed_cd_sessions')} checked={value.sessions} onChange={(v) => set({ sessions: v })} />
        <SwitchField label={t(locale, 'embed_cd_signup_by')} checked={value.signup_by} onChange={(v) => set({ signup_by: v })} />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await updateWorkspaceSettings({ card_dates: value });
                if (!r.ok) return setError(r.error);
                setSaved(true);
                router.refresh();
              })
            }
          >
            {pending ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
          {saved && <span className="text-xs text-ink-subtle">{t(locale, 'saved')}</span>}
          {error && <span className="text-xs text-red-700">{error}</span>}
        </div>
      </div>
    </section>
  );
}
