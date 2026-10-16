'use client';

import { RichText } from '@thefibre/shared/ui/rich-text';

// Public organiser page listing (Sjoerd 2026-07-02): a thread opens either
// its full page or — Luma-style — a popup with info + direct enrolment,
// per the thread's public_interaction setting.
//
// Three shapes since 2026-09-11, one per site theme's needs. The DATA and the
// popup are identical in all three — only the card changes — because the
// thing a theme is allowed to vary is what a visitor sees first, never what
// they can do.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarRange, Route, X } from 'lucide-react';
import { publicFetch } from '@/lib/public-api';
import { richTextPreview } from '@/lib/rich-text-preview';
import type { PublicTicket, RegistrationField } from '@/lib/thread-types';
import { t, isLocale, type Locale } from '@/lib/i18n';
import { EnrolCard } from './[threadSlug]/enrol-form';
import { one } from '@/lib/thread-types';
import { threadDateLine, PAGE_DATES } from '@thefibre/shared/thread-date-line';
import { VatInclNote } from '@thefibre/shared/ui/vat-price';
import { netFromInclusive } from '@thefibre/shared/price-logic';
import { DEFAULT_CARD_DATES, type CardDates } from '@thefibre/shared/thread-dates';

export type PublicThreadListItem = {
  id: string;
  slug: string;
  /** Its own address (additive, 2026-10-16). On a team's page a thread
   *  offered to that team lives at its owner's; absent on an older API. */
  path?: string | null;
  intention: string | null;
  cover_url: string | null;
  price_cents: number | null;
  price_currency: string | null;
  public_interaction?: 'page' | 'popup';
  program:
    | { title: string; format: string; status: string; starts_on: string | null; ends_on: string | null }
    | { title: string; format: string; status: string; starts_on: string | null; ends_on: string | null }[]
    | null;
  /** Thread dates (additive, slice 4): what the card's date line is made of,
   *  and the language and zone it is written in. */
  event_starts_at?: string | null;
  event_ends_at?: string | null;
  key_moment_count?: number;
  signups_close_at?: string | null;
  language?: string;
  timezone?: string;
  /** The seller's home VAT rate, or null (additive, 2026-10-16). */
  vat_home_pct?: number | null;
  /** The shown price includes VAT (its cheapest ticket says so). */
  price_includes_vat?: boolean;
};

type PopupDetail = {
  organiser: { slug: string; display_name: string | null };
  thread: {
    slug: string;
    intention: string | null;
    language: string;
    cover_url: string | null;
    price_cents: number | null;
    price_currency: string | null;
    registration_fields: RegistrationField[];
    program:
      | { title: string; starts_on: string | null; ends_on: string | null }
      | { title: string; starts_on: string | null; ends_on: string | null }[]
      | null;
    enrolment_open: boolean;
    /** Thread dates (additive): when sign-ups close, and the key moments. */
    signups_close_at?: string | null;
    event_starts_at?: string | null;
    event_ends_at?: string | null;
    key_moment_count?: number;
    /** The seller's home VAT rate, or null (additive, 2026-10-16). */
    vat_home_pct?: number | null;
    /** The seller adds VAT on top (additive, 2026-10-15). */
    vat_registered?: boolean;
    timezone?: string;
    tickets?: PublicTicket[];
  };
};

function fmtPrice(cents: number | null, currency: string | null): string {
  if (!cents) return 'Free';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency ?? 'EUR',
  }).format(cents / 100);
}

export type GridVariant =
  /** A stack of wide cards. The original, and what community uses. */
  | 'list'
  /** Image-forward tiles for the festival theme — the cover does the work. */
  | 'poster'
  /** A scannable table-like row, date first. Corporate. */
  | 'row';

export function ThreadsGrid({
  organiserSlug,
  threads,
  variant = 'list',
  cardDates = DEFAULT_CARD_DATES,
}: {
  organiserSlug: string;
  threads: PublicThreadListItem[];
  variant?: GridVariant;
  /** The workspace's card choice (thread_settings.card_dates), from the page
   *  payload. These are cards, so they read their dates the way the embeds do. */
  cardDates?: CardDates;
}) {
  const [popupSlug, setPopupSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<PopupDetail | null>(null);

  useEffect(() => {
    if (!popupSlug) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void publicFetch<PopupDetail>(
      `/api/v1/thread/public/organiser/${organiserSlug}/thread/${popupSlug}`,
    ).then((d) => {
      if (!cancelled) setDetail(d);
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPopupSlug(null);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      document.removeEventListener('keydown', onKey);
    };
  }, [popupSlug, organiserSlug]);

  const listClass =
    variant === 'poster'
      ? 'mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'
      : variant === 'row'
        ? 'mt-6 border-t border-line'
        : 'mt-3 space-y-3';

  return (
    <>
      <ul className={listClass}>
        {threads.map((th) => {
          const p = one(th.program);
          const Icon = p?.format === 'journey' ? Route : CalendarRange;
          const dates = threadDateLine(
            { ...th, starts_on: p?.starts_on ?? null, ends_on: p?.ends_on ?? null },
            cardDates,
            th,
          );
          const title = p?.title ?? th.slug;
          const price = fmtPrice(th.price_cents, th.price_currency);
          // "€363 incl. 21% VAT", small, under the price — the seller's home
          // rate from the payload (Sjoerd, 2026-10-16). Nothing when the
          // seller is not VAT-registered or the thread is free.
          const vatNote = (
            <VatInclNote
              // A NET only (vat-price.tsx): an incl. price is turned back into
              // its net by the rule the charge uses, never VAT on top of VAT.
              netCents={
                th.price_includes_vat && th.vat_home_pct
                  ? netFromInclusive(th.price_cents ?? 0, th.vat_home_pct)
                  : (th.price_cents ?? 0)
              }
              ratePct={th.vat_home_pct}
              currency={th.price_currency ?? 'EUR'}
              locale={th.language}
              className="mt-0.5"
            />
          );

          const inner =
            variant === 'poster' ? (
              <>
                <span className="block aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-sunken ring-1 ring-line">
                  {th.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={th.cover_url}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <Icon size={28} strokeWidth={1.25} className="text-ink-muted" />
                    </span>
                  )}
                </span>
                <span className="mt-4 block text-lg font-medium leading-snug text-balance">
                  {title}
                </span>
                <span className="mt-1.5 block text-xs text-ink-muted">
                  {dates ? `${dates} · ${price}` : price}
                </span>
                {vatNote}
              </>
            ) : variant === 'row' ? (
              <>
                <span className="w-40 shrink-0 text-sm text-ink-subtle tabular-nums">
                  {dates ?? '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium truncate">{title}</span>
                  {/* No `block` on the clamp below. `line-clamp-1` works by
                      setting display:-webkit-box, and `block` sets
                      display:block — one of them wins and it was never the
                      clamp. The row variant therefore printed intentions at
                      full length from the day it shipped; a short one merely
                      looked clamped because it already fitted. Found on the
                      corporate theme with a 200-word intention, which ran to
                      twenty lines inside a single table row. */}
                  {th.intention && (
                    <span className="mt-0.5 text-sm text-ink-muted line-clamp-1">
                      {richTextPreview(th.intention)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right text-sm text-ink-subtle tabular-nums">
                  {price}
                  {vatNote}
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-surface-sunken ring-1 ring-line shrink-0">
                  <Icon size={18} strokeWidth={1.75} className="text-ink-subtle" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-medium">{title}</div>
                  {th.intention && (
                    <p className="mt-1 text-sm text-ink-subtle line-clamp-2 leading-relaxed">
                      {richTextPreview(th.intention)}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
                    {dates && <span>{dates}</span>}
                    <span>{price}</span>
                  </div>
                  {vatNote}
                </div>
              </>
            );

          const cls =
            variant === 'poster'
              ? 'group block w-full text-left'
              : variant === 'row'
                ? 'flex w-full items-center gap-6 border-b border-line px-1 py-5 text-left hover:bg-surface-sunken/60 transition-colors'
                : 'w-full flex items-start gap-4 rounded-xl border border-line bg-surface-raised p-5 hover:border-line-strong transition-colors text-left';
          // Its OWN address. A thread offered to this team (multi-team) lives
          // at its owner's, and the popup looks a thread up under THIS page's
          // slug — so an offered thread is a plain link to where it lives.
          const here = `/${organiserSlug}/${th.slug}`;
          const href = th.path ?? here;
          return (
            <li key={th.id}>
              {th.public_interaction === 'popup' && href === here ? (
                <button type="button" onClick={() => setPopupSlug(th.slug)} className={cls}>
                  {inner}
                </button>
              ) : (
                <Link href={href} className={cls}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {/* Luma-style enrolment popup */}
      {popupSlug && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPopupSlug(null);
          }}
        >
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl bg-surface-raised border border-line shadow-xl">
            {!detail ? (
              <div className="p-8 text-sm text-ink-subtle">…</div>
            ) : (
              <PopupBody detail={detail} onClose={() => setPopupSlug(null)} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PopupBody({ detail, onClose }: { detail: PopupDetail; onClose: () => void }) {
  const th = detail.thread;
  const p = one(th.program);
  const lang: Locale = isLocale(th.language) ? (th.language as Locale) : 'en';
  // The popup is the thread's page in a frame, so it reads like the page.
  const dates = threadDateLine(
    { ...th, starts_on: p?.starts_on ?? null, ends_on: p?.ends_on ?? null },
    PAGE_DATES,
    th,
  );

  return (
    <div>
      {th.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={th.cover_url} alt="" className="w-full h-36 object-cover rounded-t-xl" />
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium tracking-tight">{p?.title}</h2>
            {dates && <div className="mt-0.5 text-xs text-ink-muted">{dates}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-muted hover:text-ink shrink-0"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        {/* Same as the thread page: a plain textarea's line breaks survive.
            The CARD version above keeps its line-clamp and no pre-line — a
            two-line clamp plus hard breaks wastes the preview. */}
        {th.intention && (
          <RichText
            html={th.intention}
            className="mt-2 text-sm text-ink-subtle leading-relaxed whitespace-pre-line"
          />
        )}
        <div className="mt-4">
          <EnrolCard
            vatHomePct={th.vat_home_pct ?? null}
            organiserSlug={detail.organiser.slug}
            organiserName={detail.organiser.display_name ?? detail.organiser.slug}
            threadSlug={th.slug}
            priceCents={th.price_cents}
            priceCurrency={th.price_currency}
            tickets={th.tickets ?? []}
            registrationFields={th.registration_fields ?? []}
            enrolmentOpen={th.enrolment_open}
            signupsCloseAt={th.signups_close_at ?? null}
            vatRegistered={th.vat_registered === true}
            timeZone={th.timezone ?? 'Europe/Amsterdam'}
            locale={lang}
          />
        </div>
        <div className="mt-3 text-center">
          <Link
            href={`/${detail.organiser.slug}/${th.slug}`}
            className="text-xs text-ink-muted hover:text-ink underline underline-offset-2"
          >
            {t(lang, 'view_and_enrol')} →
          </Link>
        </div>
      </div>
    </div>
  );
}
