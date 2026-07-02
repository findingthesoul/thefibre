'use client';

// Public organiser page listing (Sjoerd 2026-07-02): a thread opens either
// its full page or — Luma-style — a popup with info + direct enrolment,
// per the thread's public_interaction setting.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarRange, Route, X } from 'lucide-react';
import { publicFetch } from '@/lib/public-api';
import type { RegistrationField } from '@/lib/thread-types';
import { t, isLocale, type Locale } from '@/lib/i18n';
import { EnrolCard } from './[threadSlug]/enrol-form';

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
  };
};

function one<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

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

export function ThreadsGrid({
  organiserSlug,
  threads,
}: {
  organiserSlug: string;
  threads: PublicThreadListItem[];
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

  return (
    <>
      <ul className="mt-3 space-y-3">
        {threads.map((th) => {
          const p = one(th.program);
          const Icon = p?.format === 'journey' ? Route : CalendarRange;
          const dates = fmtDates(p?.starts_on ?? null, p?.ends_on ?? null);
          const inner = (
            <>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-surface-sunken ring-1 ring-line shrink-0">
                <Icon size={18} strokeWidth={1.75} className="text-ink-subtle" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium">{p?.title ?? th.slug}</div>
                {th.intention && (
                  <p className="mt-1 text-sm text-ink-subtle line-clamp-2 leading-relaxed">
                    {th.intention}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
                  {dates && <span>{dates}</span>}
                  <span>{fmtPrice(th.price_cents, th.price_currency)}</span>
                </div>
              </div>
            </>
          );
          const cls =
            'w-full flex items-start gap-4 rounded-xl border border-line bg-surface-raised p-5 hover:border-line-strong transition-colors text-left';
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
        {th.intention && (
          <p className="mt-2 text-sm text-ink-subtle leading-relaxed">{th.intention}</p>
        )}
        <div className="mt-4">
          <EnrolCard
            organiserSlug={detail.organiser.slug}
            organiserName={detail.organiser.display_name ?? detail.organiser.slug}
            threadSlug={th.slug}
            priceCents={th.price_cents}
            priceCurrency={th.price_currency}
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
