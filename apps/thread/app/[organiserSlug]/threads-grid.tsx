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

export type PublicThreadListItem = {
  id: string;
  slug: string;
  intention: string | null;
  cover_url: string | null;
  price_cents: number | null;
  price_currency: string | null;
  public_interaction?: 'page' | 'popup';
  program:
    | { title: string; format: string; status: string; starts_on: string | null; ends_on: string | null }
    | { title: string; format: string; status: string; starts_on: string | null; ends_on: string | null }[]
    | null;
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
    tickets?: PublicTicket[];
  };
};

function fmtDates(a: string | null, b: string | null): string | null {
  if (!a && !b) return null;
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(d),
    );
  if (a && b && a !== b) return `${fmt(a)} → ${fmt(b)}`;
  return fmt((a ?? b)!);
}

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
}: {
  organiserSlug: string;
  threads: PublicThreadListItem[];
  variant?: GridVariant;
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
          const dates = fmtDates(p?.starts_on ?? null, p?.ends_on ?? null);
          const title = p?.title ?? th.slug;
          const price = fmtPrice(th.price_cents, th.price_currency);

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
              </>
            ) : variant === 'row' ? (
              <>
                <span className="w-40 shrink-0 text-sm text-ink-subtle tabular-nums">
                  {dates ?? '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium truncate">{title}</span>
                  {th.intention && (
                    <span className="mt-0.5 block text-sm text-ink-muted line-clamp-1">
                      {richTextPreview(th.intention)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm text-ink-subtle tabular-nums">{price}</span>
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
                </div>
              </>
            );

          const cls =
            variant === 'poster'
              ? 'group block w-full text-left'
              : variant === 'row'
                ? 'flex w-full items-center gap-6 border-b border-line px-1 py-5 text-left hover:bg-surface-sunken/60 transition-colors'
                : 'w-full flex items-start gap-4 rounded-xl border border-line bg-surface-raised p-5 hover:border-line-strong transition-colors text-left';
          return (
            <li key={th.id}>
              {th.public_interaction === 'popup' ? (
                <button type="button" onClick={() => setPopupSlug(th.slug)} className={cls}>
                  {inner}
                </button>
              ) : (
                <Link href={`/${organiserSlug}/${th.slug}`} className={cls}>
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
  const dates = fmtDates(p?.starts_on ?? null, p?.ends_on ?? null);

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
            organiserSlug={detail.organiser.slug}
            organiserName={detail.organiser.display_name ?? detail.organiser.slug}
            threadSlug={th.slug}
            priceCents={th.price_cents}
            priceCurrency={th.price_currency}
            tickets={th.tickets ?? []}
            registrationFields={th.registration_fields ?? []}
            enrolmentOpen={th.enrolment_open}
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
