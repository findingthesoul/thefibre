'use client';

// Whether a person has a public page at all.
//
// Sjoerd, 2026-10-08, on reading what /{slug} does: it publishes somebody's
// name, bio and photo without them having chosen to have a page. Most of them
// never asked — `routes/app-thread.ts` creates the row, slug and all, the
// first time an external app publishes a thread for their workspace.
//
// Born here rather than in one app: it is rendered by The Fibre's Settings →
// Profile today, and it is owed on The Thread's Settings → Public page, which
// is the screen somebody opens to look at their page. A second copy is how the
// two drift (the profile form itself is in this folder for exactly that
// reason), so it starts shared even while one app renders it.
// The save is injected, because the two apps write it through their own
// server actions.
//
// THREE STATES, and the third is why this component exists:
//
//   true   — they said yes. A switch, and the address.
//   false  — they said no. The same switch, off, and what that means.
//   null   — nobody ever asked, and the page has been public the whole time.
//            Shown with the notice, ONCE in the sense that answering removes
//            it: the first time they open this screen they find out, and the
//            control is right there rather than in a mail they have to act on.

import { useState, useTransition } from 'react';
import { chromeT, useLocale } from './i18n-ui.js';

export type PublicPage = { slug: string; is_published: boolean | null };

/**
 * What the switch shows for a given stored value. Exported because it is the
 * one subtle thing here and it is worth a test — and because a test that
 * restates the rule instead of calling it passes whatever the component does.
 *
 * NULL reads as ON because that is what is TRUE: the page is serving right
 * now. Showing it as off would be a lie told by a checkbox, and the person
 * would leave this screen believing they had no page while strangers read it.
 */
export function publicPageState(is_published: boolean | null): {
  on: boolean;
  notice: boolean;
} {
  return { on: is_published !== false, notice: is_published === null };
}

export function PublicPageSwitch({
  page,
  pageUrl,
  onChange,
}: {
  /** Null when this person has no organiser row — most people. Renders
   *  nothing, because there is no page to decide about. */
  page: PublicPage | null;
  /** The address to show them. A switch about a page they cannot see is a
   *  switch about nothing. */
  pageUrl: (slug: string) => string;
  onChange: (published: boolean) => Promise<{ ok: boolean; error?: string | undefined }>;
}) {
  const locale = useLocale();
  const [published, setPublished] = useState<boolean | null>(page?.is_published ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!page) return null;

  const { on, notice: neverAsked } = publicPageState(published);

  function set(next: boolean) {
    const prev = published;
    setPublished(next);
    setError(null);
    start(async () => {
      const r = await onChange(next);
      if (!r.ok) {
        setPublished(prev);
        setError(r.error ?? 'Could not change your page.');
      }
    });
  }

  return (
    <section className="mt-10 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-medium text-ink">{chromeT(locale, 'public_page_title')}</h2>

      {neverAsked && (
        <p className="mt-2 rounded-xl bg-surface-sunken px-3 py-2 text-xs text-ink-subtle">
          {chromeT(locale, 'public_page_notice')}
        </p>
      )}

      <label className="mt-3 flex items-start gap-3">
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(e) => set(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-line"
        />
        <span className="min-w-0">
          <span className="block text-sm text-ink">{chromeT(locale, 'public_page_switch_on')}</span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            {on ? chromeT(locale, 'public_page_on') : chromeT(locale, 'public_page_off')}
          </span>
        </span>
      </label>

      {on && (
        <p className="mt-3 break-all text-xs text-ink-muted">
          <a
            href={pageUrl(page.slug)}
            rel="noreferrer noopener"
            target="_blank"
            className="underline hover:text-ink"
          >
            {pageUrl(page.slug)}
          </a>
        </p>
      )}

      {/* The fear this sentence answers is the reason people leave a page up
          they do not want: that switching it off will break the links they
          have sent. It does not — the gate is on this page alone. */}
      <p className="mt-3 text-xs text-ink-muted">
        {chromeT(locale, 'public_page_threads_note')}
      </p>

      {error && (
        <p className="mt-3 rounded-xl border border-line bg-surface-sunken px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
