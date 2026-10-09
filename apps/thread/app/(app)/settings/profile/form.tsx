'use client';

import { useState, useTransition } from 'react';
import { bioToHtml } from '@thefibre/shared';
import { RichText } from '@thefibre/shared/ui/rich-text';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import type { Locale } from '@thefibre/shared';
import type { OrganiserRow } from '@/lib/thread-types';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n-ui';
import { updateOrganiser } from '../actions';
import { THREAD_HOST, THREAD_ORIGIN } from '@/lib/public-host';

/**
 * The address, and a window onto the profile that fills the page.
 *
 * The name, photo and bio are shown here because this is where you look at
 * your public page — and they are not editable here, because they are editable
 * in exactly one place. A read-only echo with a link is honest; a second form
 * is how the two drifted.
 */
export function PublicPageForm({
  locale,
  organiser,
  fibreProfileUrl,
}: {
  locale: Locale;
  organiser: OrganiserRow;
  fibreProfileUrl: string;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(organiser.slug);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!slug.trim()) return setError(t(locale, 'pick_public_url'));
    start(async () => {
      const r = await updateOrganiser({ slug: slug.trim() });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  }

  // Sjoerd, 2026-10-04: *"Where can I find a link to my profile page (there
  // should be a visit page button)"*. The screen showed the address and a
  // preview of what the page contains, and no way to go and look at it.
  //
  // Linked to the SAVED slug, and only while the field still matches it: an
  // address being typed is not a page yet, and a link that 404s because you
  // were mid-edit teaches people not to trust the link.
  const savedSlug = organiser.slug?.trim() ?? '';
  const unsavedEdit = slug.trim() !== savedSlug;
  const visitHref = `${THREAD_ORIGIN}/${savedSlug}`;
  // Switched OFF is the same kind of state as mid-edit: there is an address,
  // and following it right now reaches the 404 the switch asks for. So it
  // gets the same treatment the unsaved edit already had — the link is
  // withdrawn and replaced by the reason. Offering a link the server refuses
  // is how somebody concludes the switch did not take.
  const pageIsOff = organiser.is_published === false;
  const VisitLink = ({ className = '' }: { className?: string }) =>
    !savedSlug ? null : pageIsOff ? (
      <span className={`text-xs text-ink-muted ${className}`}>
        {t(locale, 'visit_page_when_off')}
      </span>
    ) : unsavedEdit ? (
      <span className={`text-xs text-ink-muted ${className}`}>
        {t(locale, 'visit_page_after_save')}
      </span>
    ) : (
      <a
        href={visitHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 text-xs text-ink-subtle hover:text-ink underline underline-offset-2 ${className}`}
      >
        {t(locale, 'visit_page')}
        <ExternalLink size={12} strokeWidth={1.75} />
      </a>
    );

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-8 max-w-xl">
      <label className="block">
        <span className="text-sm text-ink-subtle">
          {t(locale, 'public_url')}
          <span className="text-red-600"> *</span>
        </span>
        <div className="mt-1 flex">
          <span className="inline-flex items-center rounded-l-md border border-r-0 border-line bg-surface-sunken px-3 text-sm text-ink-muted">
            {THREAD_HOST}/
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
        <span className="mt-1 flex items-center justify-between gap-3">
          <span className="text-xs text-ink-muted">{t(locale, 'public_url_hint')}</span>
          <VisitLink className="shrink-0" />
        </span>
      </label>

      <section className="border-t border-line pt-8">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">
          {t(locale, 'what_it_shows')}
        </div>
        <div className="mt-3 flex items-start gap-4 rounded-lg border border-line bg-surface-raised p-4">
          {organiser.photo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={organiser.photo_url}
              alt=""
              className="h-14 w-14 rounded-full object-cover ring-1 ring-line shrink-0"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-surface-sunken ring-1 ring-line shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium">{organiser.display_name ?? '—'}</div>
            <p className="mt-1 text-xs text-ink-subtle leading-relaxed">
              {bioToHtml(organiser.bio) ? (
                <RichText
                  html={bioToHtml(organiser.bio)!}
                  className="[&_p]:mb-2 [&_p:last-child]:mb-0"
                />
              ) : (
                t(locale, 'no_bio_yet')
              )}
            </p>
          </div>
        </div>
        {/* Stacked, because both of these are inline-level and sat on one
            line with nothing between them — "Visit your page⧉Edit your
            profile in The Fibre". Fixed at this call site rather than in
            VisitLink: its other use is inside a flex row, where a block
            would break the layout. */}
        <div className="mt-3 flex flex-col items-start gap-2">
          <VisitLink />
          <a
            href={fibreProfileUrl}
            className="inline-flex items-center gap-1.5 text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
          >
            {t(locale, 'edit_profile_in_fibre')}
            <ExternalLink size={12} strokeWidth={1.75} />
          </a>
        </div>
        <p className="mt-2 text-xs text-ink-muted">{t(locale, 'one_profile_note')}</p>
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
