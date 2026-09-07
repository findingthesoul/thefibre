// The public thread page, shared between its two addresses
// (docs/brief-workspace-urls.md):
//
//   /{owner}/{thread}                 the canonical form (personal · team · workspace)
//   /{workspace}/{organiser}/{thread} the deeper address for workspace-scoped threads
//
// Both routes call fetchPublicThread + <PublicThreadView>; the page bodies
// stay thin so the render never forks.

import Link from 'next/link';
import { Clock, MapPin, Video, Users, Award, Languages } from 'lucide-react';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import { serverSupabase } from '@/lib/supabase/server';
import type { PublicTicket, RegistrationField } from '@/lib/thread-types';
import { EnrolCard } from './enrol-form';
import { t, LOCALE_LABELS, type Locale } from '@/lib/i18n';
import { one } from '@/lib/thread-types';

const PUBLIC_HOST = process.env.NEXT_PUBLIC_THREAD_URL ?? 'https://app.thethread.app';

type AgendaItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  starts_at: string | null;
  ends_at: string | null;
  daily_schedule: { date: string; start: string; end: string }[] | null;
  location: string | null;
  image_url?: string | null;
  is_online: boolean;
};

export type PublicThreadDetail = {
  organiser: { slug: string; display_name: string | null; photo_url: string | null };
  thread: {
    id: string;
    slug: string;
    intention: string | null;
    timezone: string;
    language: Locale;
    facilitation_language?: string | null;
    /** Additive (docs/brief-workspace-urls.md): 'workspace' when the thread
     *  publishes under the workspace slug. Optional — older payloads omit it. */
    public_scope?: 'personal' | 'team' | 'workspace' | null;
    /** The creating organiser's slug — the deeper address validates against it. */
    organiser_slug?: string | null;
    /** The slug the thread's canonical public URL lives under. */
    canonical_owner_slug?: string | null;
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
    is_preview?: boolean;
    participants?: string[];
    share_participants_public?: boolean;
    tickets?: PublicTicket[];
  };
};

/** Fetch a public thread under any owner slug (organiser, team or workspace —
 *  the API resolver is owner-agnostic). Forwards the signed-in session token
 *  when one exists so workspace members can preview drafts. Null on 404. */
export async function fetchPublicThread(
  ownerSlug: string,
  threadSlug: string,
): Promise<PublicThreadDetail | null> {
  const supabase = await serverSupabase();
  const { data: auth } = await supabase.auth.getSession();
  const authHeaders: Record<string, string> = auth.session
    ? { Authorization: `Bearer ${auth.session.access_token}` }
    : {};
  try {
    return await publicFetch<PublicThreadDetail>(
      `/api/v1/thread/public/organiser/${ownerSlug}/thread/${threadSlug}`,
      { headers: authHeaders },
    );
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) return null;
    throw e;
  }
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

function fmtDay(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T00:00:00`));
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

export function PublicThreadView({
  data,
  paidNotice,
}: {
  data: PublicThreadDetail;
  paidNotice: 'success' | 'cancelled' | null;
}) {
  const { organiser, thread } = data;
  const program = one(thread.program);
  const organiserName = organiser.display_name ?? organiser.slug;
  const lang = thread.language ?? 'en';
  const dates = fmtDates(program?.starts_on ?? null, program?.ends_on ?? null);
  const spotsLeft =
    thread.capacity != null ? Math.max(0, thread.capacity - thread.enrolled_count) : null;
  // Informational meta line — only when the thread is run in something other
  // than the page language itself (free text, organiser-entered).
  const facilitationLanguage = thread.facilitation_language?.trim() || null;
  const showFacilitatedIn =
    !!facilitationLanguage &&
    facilitationLanguage.toLowerCase() !== LOCALE_LABELS[lang].toLowerCase();
  // The one true address (D2): old organiser/team addresses and the deeper
  // /{workspace}/{organiser}/{thread} form stay resolvable, but the canonical
  // link always names /{canonical_owner_slug}/{thread}. React hoists the
  // <link> into <head>.
  const canonicalHref = thread.canonical_owner_slug
    ? `${PUBLIC_HOST}/${thread.canonical_owner_slug}/${thread.slug}`
    : null;

  return (
    <div className="min-h-screen bg-surface-sunken">
      {canonicalHref && <link rel="canonical" href={canonicalHref} />}
      <main className="mx-auto max-w-4xl px-6 py-16">
        {thread.is_preview && (
          <div className="mb-8 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <span className="font-medium">Draft preview.</span> This is how the page will look
            once published — right now only members of your workspace can see it, and
            enrolment stays closed.
          </div>
        )}
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
              {showFacilitatedIn && (
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <Languages size={14} strokeWidth={1.75} />
                  {t(lang, 'facilitated_in', { language: facilitationLanguage! })}
                </span>
              )}
            </div>

            {(thread.participants?.length ?? 0) > 0 && (
              <section className="mt-8">
                <h2 className="text-[11px] uppercase tracking-wider text-ink-muted">
                  {t(lang, 'whos_coming')}
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {thread.participants!.map((name, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 rounded-full ring-1 ring-line bg-surface-raised text-ink-subtle"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </section>
            )}

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
                      {a.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.image_url}
                          alt=""
                          className="mt-2 w-full max-h-48 rounded-lg ring-1 ring-line object-cover"
                        />
                      )}
                      {a.description && (
                        <div
                          className="mt-0.5 text-sm text-ink-subtle leading-relaxed [&_ul]:list-disc [&_ol]:list-decimal [&_ul,&_ol]:pl-5 [&_a]:underline"
                          // Rich text authored by workspace members in the editor.
                          dangerouslySetInnerHTML={{ __html: a.description }}
                        />
                      )}
                      {a.daily_schedule && a.daily_schedule.length > 0 && (
                        <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-ink-muted tabular-nums">
                          {a.daily_schedule.map((d) => (
                            <span key={d.date} className="inline-flex items-center gap-1">
                              <Clock size={11} strokeWidth={1.75} />
                              {fmtDay(d.date)} · {d.start}–{d.end}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                        {!a.daily_schedule?.length &&
                          fmtSlot(a.starts_at, a.ends_at, thread.timezone) && (
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
            tickets={thread.tickets ?? []}
            registrationFields={thread.registration_fields ?? []}
            enrolmentOpen={thread.enrolment_open && (spotsLeft == null || spotsLeft > 0)}
            locale={lang}
            sharesParticipants={
              !!thread.share_participants_public || false
            }
            paymentMethods={
              ((thread as { payment_methods?: ('stripe' | 'invoice')[] | null })
                .payment_methods ?? ['stripe'])
            }
            initialNotice={paidNotice}
          />
        </div>

        <footer className="mt-16 text-xs text-ink-muted">
          {t(lang, 'powered_by')} <span className="font-medium">Thread</span> · The Fibre
        </footer>
      </main>
    </div>
  );
}
