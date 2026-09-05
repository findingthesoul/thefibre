import { notFound } from 'next/navigation';
import { Clock, MapPin, Video, Users, Award, Languages } from 'lucide-react';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import type { PublicTicket, RegistrationField } from '@/lib/thread-types';
import { t, isLocale, LOCALE_LABELS, type Locale } from '@/lib/i18n';
import { EnrolCard } from '@/app/[organiserSlug]/[threadSlug]/enrol-form';
import { one } from '@/lib/thread-types';

type AgendaItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  image_url?: string | null;
  is_online: boolean;
};

type Program = {
  title: string;
  format: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
};

type PublicThreadDetail = {
  organiser: { slug: string; display_name: string | null; photo_url: string | null };
  thread: {
    id: string;
    slug: string;
    intention: string | null;
    timezone: string;
    language: string;
    facilitation_language?: string | null;
    cover_url: string | null;
    capacity: number | null;
    price_cents: number | null;
    price_currency: string | null;
    registration_fields: RegistrationField[];
    certificate_enabled: boolean;
    program: Program | Program[] | null;
    agenda: AgendaItem[];
    enrolled_count: number;
    enrolment_open: boolean;
    tickets?: PublicTicket[];
  };
};

const ALL_ELEMENTS = ['cover', 'intention', 'agenda', 'price', 'enrol'] as const;
type Element = (typeof ALL_ELEMENTS)[number];

function fmtDates(a: string | null, b: string | null): string | null {
  if (!a && !b) return null;
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(
      new Date(d),
    );
  if (a && b && a !== b) return `${fmt(a)} → ${fmt(b)}`;
  return fmt((a ?? b)!);
}

function fmtSlot(starts: string | null, ends: string | null, tz: string): string | null {
  if (!starts) return null;
  const d = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(new Date(starts));
  if (!ends) return d;
  const end = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  }).format(new Date(ends));
  return `${d} – ${end}`;
}

function fmtPrice(cents: number | null, currency: string | null, locale: Locale): string {
  if (!cents) return t(locale, 'free');
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency ?? 'EUR',
  }).format(cents / 100);
}

export default async function EmbedThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ organiserSlug: string; threadSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { organiserSlug, threadSlug } = await params;
  const sp = await searchParams;

  // ?elements=cover,intention,enrol — unknown names are ignored; no valid
  // names (or no param) means "show everything".
  const raw = typeof sp.elements === 'string' ? sp.elements : '';
  const picked = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is Element => (ALL_ELEMENTS as readonly string[]).includes(s));
  const elements = new Set<Element>(picked.length > 0 ? picked : ALL_ELEMENTS);

  let data: PublicThreadDetail;
  try {
    data = await publicFetch(
      `/api/v1/thread/public/organiser/${organiserSlug}/thread/${threadSlug}`,
    );
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }

  const { organiser, thread } = data;
  const program = one(thread.program);
  const organiserName = organiser.display_name ?? organiser.slug;
  // ?lang= (from data-lang) overrides; otherwise the embed speaks the
  // thread's own language — same fallback as the public thread page.
  const rawLang = typeof sp.lang === 'string' ? sp.lang : null;
  const lang: Locale = isLocale(rawLang)
    ? rawLang
    : isLocale(thread.language)
      ? thread.language
      : 'en';
  const dates = fmtDates(program?.starts_on ?? null, program?.ends_on ?? null);
  const spotsLeft =
    thread.capacity != null ? Math.max(0, thread.capacity - thread.enrolled_count) : null;
  const enrolOnly = elements.size === 1 && elements.has('enrol');
  // Informational meta line — only when the thread is run in something other
  // than the page language itself (free text, organiser-entered).
  const facilitationLanguage = thread.facilitation_language?.trim() || null;
  const showFacilitatedIn =
    !!facilitationLanguage &&
    facilitationLanguage.toLowerCase() !== LOCALE_LABELS[lang].toLowerCase();

  return (
    <div className={enrolOnly ? 'max-w-md' : 'max-w-2xl'}>
      {elements.has('cover') && thread.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thread.cover_url}
          alt=""
          className="te-cover w-full rounded-xl ring-1 ring-line object-cover max-h-56 mb-4"
        />
      )}

      {/* Title is chrome, not an element — every embed keeps its context. */}
      <div className="te-kicker text-[11px] uppercase tracking-wider text-ink-muted">
        {program?.format === 'journey' ? t(lang, 'journey') : t(lang, 'event')}
        {dates ? ` · ${dates}` : ''}
      </div>
      <h1 className="te-title mt-1 text-xl font-medium tracking-tight">{program?.title ?? thread.slug}</h1>

      {elements.has('intention') && thread.intention && (
        <p className="te-intention mt-2 text-sm text-ink-subtle leading-relaxed">{thread.intention}</p>
      )}

      {(spotsLeft != null || thread.certificate_enabled || showFacilitatedIn) && (
        <div className="te-meta mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-subtle">
          {spotsLeft != null && (
            <span className="inline-flex items-center gap-1.5">
              <Users size={13} strokeWidth={1.75} />
              {spotsLeft > 0 ? t(lang, 'spots_left', { n: spotsLeft }) : t(lang, 'full')}
            </span>
          )}
          {thread.certificate_enabled && (
            <span className="inline-flex items-center gap-1.5">
              <Award size={13} strokeWidth={1.75} />
              {t(lang, 'certificate_on_completion')}
            </span>
          )}
          {showFacilitatedIn && (
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <Languages size={13} strokeWidth={1.75} />
              {t(lang, 'facilitated_in', { language: facilitationLanguage! })}
            </span>
          )}
        </div>
      )}

      {elements.has('price') && !elements.has('enrol') && (
        <div className="te-price mt-3 text-sm">
          <span className="text-ink-subtle">Price · </span>
          <span className="font-medium">
            {fmtPrice(thread.price_cents, thread.price_currency, lang)}
          </span>
        </div>
      )}

      {elements.has('agenda') && thread.agenda.length > 0 && (
        <section className="mt-6">
          <h2 className="te-label text-[11px] uppercase tracking-wider text-ink-muted">
            {t(lang, 'agenda')}
          </h2>
          <ul className="te-agenda mt-2 space-y-2">
            {thread.agenda.map((a) => (
              <li key={a.id} className="te-agenda-item te-card rounded-lg border border-line bg-surface-raised px-3.5 py-2.5">
                <div className="text-sm font-medium">{a.title}</div>
                {a.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.image_url}
                    alt=""
                    className="te-agenda-image mt-2 w-full max-h-48 rounded-lg ring-1 ring-line object-cover"
                  />
                )}
                {a.description && (
                  <div
                    className="mt-0.5 text-sm text-ink-subtle leading-relaxed [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-5 [&_a]:underline"
                    // Rich text authored by workspace members in the editor.
                    dangerouslySetInnerHTML={{ __html: a.description }}
                  />
                )}
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                  {fmtSlot(a.starts_at, a.ends_at, thread.timezone) && (
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} strokeWidth={1.75} />
                      {fmtSlot(a.starts_at, a.ends_at, thread.timezone)}
                    </span>
                  )}
                  {a.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} strokeWidth={1.75} />
                      {a.location}
                    </span>
                  )}
                  {a.is_online && (
                    <span className="inline-flex items-center gap-1">
                      <Video size={11} strokeWidth={1.75} />
                      {t(lang, 'online')}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {elements.has('enrol') && (
        <div className={enrolOnly ? 'mt-4' : 'mt-6 max-w-md'}>
          <EnrolCard
            organiserSlug={organiser.slug}
            organiserName={organiserName}
            threadSlug={thread.slug}
            priceCents={thread.price_cents}
            tickets={thread.tickets ?? []}
            priceCurrency={thread.price_currency}
            registrationFields={thread.registration_fields ?? []}
            enrolmentOpen={thread.enrolment_open && (spotsLeft == null || spotsLeft > 0)}
            locale={lang}
          />
        </div>
      )}

      <footer className="mt-6 text-[11px] text-ink-muted">
        {t(lang, 'powered_by')} <span className="font-medium">Thread</span> · The Fibre
      </footer>
    </div>
  );
}
