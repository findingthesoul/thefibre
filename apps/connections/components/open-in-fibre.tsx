'use client';

// "Edit this contact" — the one small control beside a popup's title.
//
// Sjoerd, 2026-09-23, looking at an organisation in the Map: *"the title
// should have a small thing behind it (edit)... so you can edit the contact
// (Organisation or Person)."* A person's popup had one since 2026-09-14; an
// organisation's had nothing, so there was no way from the map to the record.
//
// It is one component rather than two, because it was about to be two: the
// button, the warning before leaving, the remembered "don't ask again" and
// the Fibre URL are the same in both places, and a second copy is how they
// start disagreeing about what the warning says.
//
// ── Why leaving needs a warning at all ─────────────────────────────────────
//
// Sjoerd, 2026-09-13: *"I just want to have a warning... that I am leaving
// connections and going to detailed personal data (with a YES and CANCEL
// button)."* Connect shows where people stand; the record behind them lives
// in The Fibre, on another apex, and the step between the two is worth
// noticing once. Once is the point — the warning remembers being dismissed.

import { useState } from 'react';
import { SquarePen } from 'lucide-react';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import { suppressWarning, warningSuppressed } from '@/lib/leaving-warning';

export function OpenInFibre({
  href,
  locale,
  label,
}: {
  /** The record in The Fibre — a contact or an organisation. */
  href: string;
  locale: Locale;
  /** What the control says. A person and an organisation name themselves. */
  label: string;
}) {
  const [asking, setAsking] = useState(false);
  const [dontAsk, setDontAsk] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (warningSuppressed()) {
            window.location.assign(href);
            return;
          }
          setAsking(true);
        }}
        title={label}
        aria-label={label}
        className="text-ink-muted transition-colors hover:text-ink"
      >
        {/* A pencil, not an arrow: he asked for "edit", and editing is what
            is on the other side. That it happens to be another app is what
            the warning below is for. */}
        <SquarePen size={17} strokeWidth={1.75} />
      </button>

      {asking && (
        <Dialog
          open
          onClose={() => setAsking(false)}
          title={t(locale, 'leave_title')}
          size="sm"
          // The Fibre's dialog bottom bar: Cancel · confirm on the right.
          footer={
            <>
              <Button variant="secondary" onClick={() => setAsking(false)}>
                {t(locale, 'cancel')}
              </Button>
              <Button
                onClick={() => {
                  // Remembered only when they actually go. Ticking the box and
                  // then pressing Cancel is not consent to skip the warning.
                  if (dontAsk) suppressWarning();
                  window.location.assign(href);
                }}
              >
                {t(locale, 'leave_yes')}
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-subtle">{t(locale, 'leave_body')}</p>
          <label className="mt-4 flex items-center gap-2 text-sm text-ink-subtle">
            <input
              type="checkbox"
              checked={dontAsk}
              onChange={(e) => setDontAsk(e.target.checked)}
            />
            {t(locale, 'leave_dont_ask')}
          </label>
        </Dialog>
      )}
    </>
  );
}
