'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import { updatePublicPage } from '../actions';
import { MEET_HOST } from '@/lib/public-host';

/**
 * The address and Meet's own fields — and a window onto the profile that
 * fills the page. Ported to the Thread model (2026-09-05, Sjoerd:
 * "Profile page of Fibre is not the same as Meet… supposed to become a
 * component"): name, photo and bio are shown, not editable — they are
 * editable in exactly one place, The Fibre. A read-only echo with a link
 * is honest; a second form is how the two drifted (and how a photo lived
 * on the booking page but not the profile).
 */
export function PublicPageForm({
  host,
  fibreProfileUrl,
  locale,
}: {
  host: {
    slug: string;
    location: string | null;
    display_name: string | null;
    bio: string | null;
    photo_url: string | null;
  };
  fibreProfileUrl: string;
  locale: Locale;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(host.slug);
  const [location, setLocation] = useState(host.location ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!slug.trim()) return setError(t(locale, 'pp_pick_url'));
    start(async () => {
      const r = await updatePublicPage({ slug: slug.trim(), location: location.trim() || null });
      if (!r.ok) return setError(r.error ?? t(locale, 'could_not_save'));
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-8 max-w-xl">
      <label className="block">
        <span className="text-sm text-ink-subtle">
          {t(locale, 'public_url')}<span className="text-red-600"> *</span>
        </span>
        <div className="mt-1 flex">
          <span className="inline-flex items-center rounded-l-md border border-r-0 border-line bg-surface-sunken px-3 text-sm text-ink-muted">
            {MEET_HOST}/
          </span>
          <input
            className="w-full rounded-r-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSaved(false);
            }}
          />
        </div>
        <span className="mt-1 block text-xs text-ink-muted">
          {t(locale, 'pp_url_hint')}
        </span>
      </label>

      <label className="block">
        <span className="text-sm text-ink-subtle">{t(locale, 'location')}</span>
        <input
          className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted"
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            setSaved(false);
          }}
          placeholder="Amsterdam, NL"
        />
        <span className="mt-1 block text-xs text-ink-muted">
          {t(locale, 'pp_location_hint')}
        </span>
      </label>

      <section className="border-t border-line pt-8">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">{t(locale, 'pp_what_it_shows')}</div>
        <div className="mt-3 flex items-start gap-4 rounded-lg border border-line bg-surface-raised p-4">
          {host.photo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={host.photo_url}
              alt=""
              className="h-14 w-14 rounded-full object-cover ring-1 ring-line shrink-0"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-surface-sunken ring-1 ring-line shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium">{host.display_name ?? '—'}</div>
            <p className="mt-1 text-xs text-ink-subtle leading-relaxed">
              {host.bio || t(locale, 'pp_no_bio')}
            </p>
          </div>
        </div>
        <a
          href={fibreProfileUrl}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
        >
          {t(locale, 'pp_edit_in_fibre')}
          <ExternalLink size={12} strokeWidth={1.75} />
        </a>
        <p className="mt-2 text-xs text-ink-muted">
          {t(locale, 'pp_one_profile')}
        </p>
      </section>

      {error && (
        <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t(locale, 'saving') : t(locale, 'save')}
        </Button>
        {saved && <span className="text-sm text-ink-subtle">{t(locale, 'saved')}</span>}
      </div>
    </form>
  );
}
