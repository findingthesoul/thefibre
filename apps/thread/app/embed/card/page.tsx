// One thread as a compact card — cover, title, date, price, one button.
// The thread-level counterpart of /embed/list: what a festival site drops on
// its own page when it wants a single event, not the whole catalogue.
// Query params (not path segments) so embed.js builds it with the same
// query() helper as the list.

import { CalendarRange, Route } from 'lucide-react';
import { publicFetch } from '@/lib/public-api';
import { t, isLocale, type Locale } from '@/lib/i18n';
import { ViewButton } from '../list/view-button';
import { EnrolCard } from '@/app/[organiserSlug]/[threadSlug]/enrol-form';
import type { PublicTicket, RegistrationField } from '@/lib/thread-types';

type PublicThreadPayload = {
  organiser: { slug: string };
  thread: {
    slug: string;
    intention: string | null;
    language: string;
    cover_url: string | null;
    price_cents: number | null;
    price_currency: string | null;
    public_interaction?: 'page' | 'popup';
    program: { title: string; format: string; starts_on: string | null; ends_on: string | null } | null;
    enrolment_open: boolean;
    capacity: number | null;
    enrolled_count: number;
    registration_fields: RegistrationField[];
    tickets?: PublicTicket[];
  };
};

function fmtDates(a: string | null, b: string | null): string | null {
  if (!a && !b) return null;
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(
      new Date(d),
    );
  if (a && b && a !== b) return `${fmt(a)} → ${fmt(b)}`;
  return fmt((a ?? b)!);
}

function fmtPrice(cents: number | null, currency: string | null, locale: Locale): string {
  if (!cents) return t(locale, 'free');
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency ?? 'EUR',
  }).format(cents / 100);
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export default async function EmbedCardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const organiser = str(sp.organiser);
  const threadSlug = str(sp.thread);
  const popup = str(sp.popup) === '1';
  // ?form=1 (data-form) — the enrolment form sits IN the card, no click at
  // all. The third shape Sjoerd asked for, next to "card with a button" and
  // the full thread embed.
  const withForm = str(sp.form) === '1';
  const rawLang = str(sp.lang);

  if (!organiser || !threadSlug) {
    return (
      <p className="text-sm text-ink-subtle">
        Missing <code>data-organiser</code> or <code>data-thread</code>.
      </p>
    );
  }

  let data: PublicThreadPayload;
  try {
    data = await publicFetch<PublicThreadPayload>(
      `/api/v1/thread/public/organiser/${organiser}/thread/${threadSlug}`,
    );
  } catch {
    return <p className="text-sm text-ink-subtle">This event is not available right now.</p>;
  }

  const { thread } = data;
  const program = Array.isArray(thread.program) ? thread.program[0] : thread.program;
  const lang: Locale = isLocale(rawLang)
    ? rawLang
    : isLocale(thread.language)
      ? thread.language
      : 'en';
  const spotsLeft =
    thread.capacity != null ? Math.max(0, thread.capacity - thread.enrolled_count) : null;
  const dates = fmtDates(program?.starts_on ?? null, program?.ends_on ?? null);
  const Icon = program?.format === 'journey' ? Route : CalendarRange;
  const publicUrl = `/${organiser}/${thread.slug}`;

  return (
    <div className="te-card overflow-hidden rounded-xl border border-line bg-surface-raised">
      {thread.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thread.cover_url} alt="" className="te-cover h-36 w-full object-cover" />
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {!thread.cover_url && (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken ring-1 ring-line">
              <Icon size={16} strokeWidth={1.75} className="text-ink-subtle" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="te-title text-base font-medium">{program?.title ?? thread.slug}</div>
            {thread.intention && (
              <p className="te-intention mt-1 line-clamp-2 text-sm leading-relaxed text-ink-subtle">
                {thread.intention}
              </p>
            )}
            <div className="te-meta mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
              {dates && <span>{dates}</span>}
              <span>{fmtPrice(thread.price_cents, thread.price_currency, lang)}</span>
            </div>
          </div>
        </div>
        {withForm ? (
          <div className="mt-4">
            <EnrolCard
              organiserSlug={organiser}
              organiserName={data.organiser.slug}
              threadSlug={thread.slug}
              priceCents={thread.price_cents}
              priceCurrency={thread.price_currency}
              tickets={thread.tickets ?? []}
              registrationFields={thread.registration_fields ?? []}
              enrolmentOpen={thread.enrolment_open && (spotsLeft == null || spotsLeft > 0)}
              locale={lang}
            />
          </div>
        ) : (
          <div className="mt-3">
            <ViewButton
              url={publicUrl}
              // ALWAYS the popup, never a link out (Sjoerd 2026-08-31). The
              // card is already the information; sending someone to a full
              // page to repeat it — and off the site they were reading — is
              // the opposite of what a card is for. public_interaction picks
              // how a LISTING opens a thread; a card has made that choice.
              popup={popup}
              organiser={organiser}
              thread={thread.slug}
              lang={lang}
              label={t(lang, 'view_and_enrol')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
