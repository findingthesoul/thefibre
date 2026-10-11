'use client';

// Whether a person appears on their ORGANISATION's public page.
//
// A SECOND, different question from `PublicPageSwitch` next door, and the
// reason it is a second component rather than a second checkbox inside that
// one: the two answers have opposite defaults, and putting them in one widget
// invites exactly the mistake the opposite defaults exist to prevent.
//
//   "Do I have a page of my own?"      NULL is grandfathered as YES —
//                                      the page is already serving.
//   "Do I appear on my employer's?"    NULL means NO — this listing has
//                                      never existed and nobody is on it.
//
// So there is no notice here, and no third state on screen. There is nothing
// to confess: an unanswered question means not listed, which is what an
// unticked box already says.
//
// Shared from birth for the same reason as its sibling — The Fibre's
// Settings → Profile and The Thread's Settings → Public page both owe it, and
// two copies of a consent control is how the two drift.

import { useState, useTransition } from 'react';
import { chromeT, useLocale } from './i18n-ui.js';

export type OrgListing = {
  /** Null when this person has no organiser row — most people. Renders
   *  nothing, because there is no organisation page to appear on. */
  listed: boolean | null;
};

export function OrgListingSwitch({
  listing,
  onChange,
}: {
  listing: OrgListing | null;
  onChange: (listed: boolean) => Promise<{ ok: boolean; error?: string | undefined }>;
}) {
  const locale = useLocale();
  const [listed, setListed] = useState<boolean | null>(listing?.listed ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!listing) return null;

  // NULL reads as OFF, because that is what is TRUE: nobody who has not been
  // asked is on the page. The inverse of publicPageState, on purpose.
  const on = listed === true;

  function set(next: boolean) {
    const prev = listed;
    setListed(next);
    setError(null);
    start(async () => {
      const r = await onChange(next);
      if (!r.ok) {
        setListed(prev);
        setError(r.error ?? 'Could not change your listing.');
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-medium text-ink">{chromeT(locale, 'org_listing_title')}</h2>

      <label className="mt-3 flex items-start gap-3">
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(e) => set(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-line"
        />
        <span className="min-w-0">
          <span className="block text-sm text-ink">{chromeT(locale, 'org_listing_switch_on')}</span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            {on ? chromeT(locale, 'org_listing_on') : chromeT(locale, 'org_listing_off')}
          </span>
        </span>
      </label>

      {/* Says that the two switches are independent, because the obvious
          guess is that one implies the other. */}
      <p className="mt-3 text-xs text-ink-muted">{chromeT(locale, 'org_listing_note')}</p>

      {error && (
        <p className="mt-3 rounded-xl border border-line bg-surface-sunken px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
