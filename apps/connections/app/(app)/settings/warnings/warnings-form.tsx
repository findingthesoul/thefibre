'use client';

// The switch for a warning somebody turned off.
//
// Client-side because the answer lives in localStorage — per device, which the
// text says out loud rather than leaving somebody to discover that their phone
// still asks. See lib/leaving-warning.ts for why it is not a preference
// cookie.

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n-ui';
import { resetWarning, warningSuppressed } from '@/lib/leaving-warning';

export function WarningsForm({ locale }: { locale: Locale }) {
  // Read after mount: localStorage does not exist while this renders on the
  // server, and reading it in useState would make the two renders disagree.
  const [suppressed, setSuppressed] = useState<boolean | null>(null);
  const [reset, setReset] = useState(false);
  useEffect(() => setSuppressed(warningSuppressed()), []);

  if (suppressed === null) return null;

  return (
    <div className="mt-6 max-w-2xl rounded-md border border-line bg-surface-raised px-4 py-4">
      <h2 className="text-sm font-medium">{t(locale, 'leave_title')}</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {suppressed ? t(locale, 'warnings_off') : t(locale, 'warnings_on')}
      </p>

      {suppressed && (
        <button
          type="button"
          onClick={() => {
            resetWarning();
            setSuppressed(false);
            setReset(true);
            setTimeout(() => setReset(false), 2500);
          }}
          className="mt-3 inline-flex h-8 items-center rounded-md border border-line bg-surface px-3 text-sm hover:bg-surface-sunken"
        >
          {t(locale, 'warnings_turn_back_on')}
        </button>
      )}

      {reset && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted">
          <Check size={13} /> {t(locale, 'saved')}
        </p>
      )}
    </div>
  );
}
