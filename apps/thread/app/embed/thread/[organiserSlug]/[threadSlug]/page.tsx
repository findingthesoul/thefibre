import { notFound } from 'next/navigation';
import { Clock, MapPin, Video, Users, Award } from 'lucide-react';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import type { RegistrationField } from '@/lib/thread-types';
import { EnrolCard } from '@/app/[organiserSlug]/[threadSlug]/enrol-form';

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
  };
};

const ALL_ELEMENTS = ['cover', 'intention', 'agenda', 'price', 'enrol'] as const;
type Element = (typeof ALL_ELEMENTS)[number];

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

function fmtPrice(cents: number | null, currency: string | null): string {
  if (!cents) return 'Free';
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
  const dates = fmtDates(program?.starts_on ?? null, program?.ends_on ?? null);
  const spotsLeft =
    thread.capacity != null ? Math.max(0, thread.capacity - thread.enrolled_count) : null;
  const enrolOnly = elements.size === 1 && elements.has('enrol');

  return (
    <div className={enrolOnly ? 'max-w-md' : 'max-w-2xl'}>
      {elements.has('cover') && thread.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thread.cover_url}
          alt=""
          className="w-full rounded-xl ring-1 ring-line object-cover max-h-56 mb-4"
        />
      )}

      {/* Title is chrome, not an element — every embed keeps its context. */}
      <div className="text-[11px] uppercase tracking-wider text-ink-muted">
        {program?.format === 'journey' ? 'Journey' : 'Event'}
        {dates ? ` · ${dates}` : ''}
      </div>
      <h1 className="mt-1 text-xl font-medium tracking-tight">{program?.title ?? thread.slug}</h1>

      {elements.has('intention') && thread.intention && (
        <p className="mt-2 text-sm text-ink-subtle leading-relaxed">{thread.intention}</p>
      )}

      {(spotsLeft != null || thread.certificate_enabled) && (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-subtle">
          {spotsLeft != null && (
            <span className="inline-flex items-center gap-1.5">
              <Users size={13} strokeWidth={1.75} />
              {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}
            </span>
          )}
          {thread.certificate_enabled && (
            <span className="inline-flex items-center gap-1.5">
              <Award size={13} strokeWidth={1.75} />
              Certificate on completion
            </span>
          )}
        </div>
      )}

      {elements.has('price') && !elements.has('enrol') && (
        <div className="mt-3 text-sm">
          <span className="text-ink-subtle">Price · </span>
          <span className="font-medium">{fmtPrice(thread.price_cents, thread.price_currency)}</span>
        </div>
      )}

      {elements.has('agenda') && thread.agenda.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[11px] uppercase tracking-wider text-ink-muted">Agenda</h2>
          <ul className="mt-2 space-y-2">
            {thread.agenda.map((a) => (
              <li key={a.id} className="rounded-lg border border-line bg-surface-raised px-3.5 py-2.5">
                <div className="text-sm font-medium">{a.title}</div>
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
                      Online
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
            priceCurrency={thread.price_currency}
            registrationFields={thread.registration_fields ?? []}
            enrolmentOpen={thread.enrolment_open && (spotsLeft == null || spotsLeft > 0)}
          />
        </div>
      )}

      <footer className="mt-6 text-[11px] text-ink-muted">
        Powered by <span className="font-medium">The Thread</span> · The Fibre
      </footer>
    </div>
  );
}
