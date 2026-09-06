'use client';

import { useActionState, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import {
  WorkingHoursEditor,
  coerceSchedule,
  type Schedule,
} from '@/components/working-hours-editor';
import { t, type Locale } from '@/lib/i18n-ui';
import { updateHost, type SaveResult } from '../actions';

type Initial = {
  timezone: string;
  working_hours: Record<string, { start: string; end: string }[]> | null;
};

export function AvailabilityForm({
  initial,
  locale,
}: {
  initial: Initial;
  locale: Locale;
}) {
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    updateHost,
    {},
  );
  const [hours, setHours] = useState<Schedule>(coerceSchedule(initial.working_hours));
  const [timezone, setTimezone] = useState(initial.timezone);

  // Full IANA list where the runtime has it (ES2022); otherwise the field
  // falls back to free text, same as the shared profile form.
  const timezones = useMemo(() => {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    try {
      return intl.supportedValuesOf?.('timeZone') ?? [];
    } catch {
      return [];
    }
  }, []);

  return (
    <form action={formAction} className="space-y-6">
      <div className="rounded-lg border border-line bg-surface-raised p-6">
        <div className="text-base font-medium">{t(locale, 'av_card_title')}</div>
        <p className="mt-1 text-sm text-ink-subtle">
          {t(locale, 'av_card_desc')}
        </p>

        <div className="mt-5">
          {timezones.length > 0 ? (
            <div>
              <span className="text-sm text-ink-subtle">{t(locale, 'timezone')}</span>
              <SearchSelect
                className="mt-1"
                value={timezone}
                onChange={setTimezone}
                options={timezones.map((tz) => ({ value: tz, label: tz }))}
                placeholder="Europe/Amsterdam"
                searchPlaceholder={t(locale, 'search_timezones')}
              />
              <input type="hidden" name="timezone" value={timezone} />
            </div>
          ) : (
            <TextField
              label={t(locale, 'timezone')}
              name="timezone"
              defaultValue={initial.timezone}
              placeholder="Europe/Amsterdam"
            />
          )}
        </div>

        <div className="mt-6">
          <WorkingHoursEditor value={hours} onChange={setHours} locale={locale} />
        </div>
        <input
          type="hidden"
          name="working_hours_json"
          value={JSON.stringify(hours)}
        />
      </div>

      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {t(locale, 'saved')}
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t(locale, 'saving') : t(locale, 'save_changes')}
      </Button>
    </form>
  );
}
