import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Clock, MapPin, Video, Users, Award } from 'lucide-react';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import type { RegistrationField } from '@/lib/thread-types';
import { EnrolCard } from './enrol-form';
import { t, type Locale } from '@/lib/i18n';

type AgendaItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  is_online: boolean;
};

type PublicThreadDetail = {
  organiser: { slug: string; display_name: string | null; photo_url: string | null };
  thread: {
    id: string;
    slug: string;
    intention: string | null;
    timezone: string;
    language: Locale;
    cover_url: string | null;
    capacity: number | null;
    price_cents: number | null;
    price_currency: string | null;
    registration_fields: RegistrationField[];
    certificate_enabled: boolean;
    program:
      | { title: string; format: string; status: string; starts_on: string | null; ends_on: string | null }
      | { title: string; format: string; status: string; starts_on: string | null; ends_on: string | null }[]
      | null;
    agenda: AgendaItem[];
    enrolled_count: number;
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

export default async function PublicThreadPage({
  params,
}: {
  params: Promise<{ organiserSlug: string; threadSlug: string }>;
}) {
  const { organiserSlug, threadSlug } = await params;

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
  const lang = thread.language ?? 'en';
  const dates = fmtDates(program?.starts_on ?? null, program?.ends_on ?? null);
  const spotsLeft =
    thread.capacity != null ? Math.max(0, thread.capacity - thread.enrolled_count) : null;

  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="mx-auto max-w-4xl px-6 py-16">
        <nav className="text-sm">
          <Link href={`/${organiser.slug}`} className="text-ink-subtle hover:text-ink">
            ← {organiserName}
          </Link>
        </nav>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-10 items-start">
          {/* Left: the thread */}
          <div>
            {thread.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thread.cover_url}
                alt=""
                className="w-full rounded-xl ring-1 ring-line object-cover max-h-64 mb-6"
              />
            )}
            <div className="text-[11px] uppercase tracking-wider text-ink-muted">
              {program?.format === 'journey' ? t(lang, 'journey') : t(lang, 'event')}
              {dates ? ` · ${dates}` : ''}
            </div>
            <h1 className="mt-2 text-3xl font-medium tracking-tight">{program?.title}</h1>
            {thread.intention && (
              <p className="mt-3 text-base text-ink-subtle leading-relaxed">{thread.intention}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ink-subtle">
              {spotsLeft != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Users size={14} strokeWidth={1.75} />
                  {spotsLeft > 0 ? t(lang, 'spots_left', { n: spotsLeft }) : t(lang, 'full')}
                </span>
              )}
              {thread.certificate_enabled && (
                <span className="inline-flex items-center gap-1.5">
                  <Award size={14} strokeWidth={1.75} />
                  {t(lang, 'certificate_on_completion')}
                </span>
              )}
            </div>

            {thread.agenda.length > 0 && (
              <section className="mt-10">
                <h2 className="text-[11px] uppercase tracking-wider text-ink-muted">{t(lang, 'agenda')}</h2>
                <ul className="mt-3 space-y-2">
                  {thread.agenda.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-lg border border-line bg-surface-raised px-4 py-3"
                    >
                      <div className="text-sm font-medium">{a.title}</div>
                      {a.description && (
                        <div
                          className="mt-0.5 text-sm text-ink-subtle leading-relaxed [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-5 [&_a]:underline"
                          // Rich text authored by workspace members in the editor.
                          dangerouslySetInnerHTML={{ __html: a.description }}
                        />
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
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
          </div>

          {/* Right: enrolment card */}
          <EnrolCard
            organiserSlug={organiser.slug}
            organiserName={organiserName}
            threadSlug={thread.slug}
            priceCents={thread.price_cents}
            priceCurrency={thread.price_currency}
            registrationFields={thread.registration_fields ?? []}
            enrolmentOpen={thread.enrolment_open && (spotsLeft == null || spotsLeft > 0)}
            locale={lang}
          />
        </div>

        <footer className="mt-16 text-xs text-ink-muted">
          {t(lang, 'powered_by')} <span className="font-medium">The Thread</span> · The Fibre
        </footer>
      </main>
    </div>
  );
}
