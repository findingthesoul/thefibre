// The participant's personal page — email-based visitor identity for the
// whole Fibre environment (Sjoerd 2026-07-02). The signed link in their
// inbox IS the credential: no account, no password. Lists everything
// they're enrolled in, across threads.

import { CalendarRange, Route, ExternalLink } from 'lucide-react';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import { t, type Locale, isLocale } from '@/lib/i18n';

type PortalItem = {
  thread_id: string;
  title: string;
  format: string;
  thread_status: string;
  starts_on: string | null;
  ends_on: string | null;
  intention: string | null;
  cover_url: string | null;
  language: string;
  enrolment_status: string;
  url: string;
  enrolled_at: string;
};

type PortalPayload = {
  person: { first_name: string | null; last_name: string | null; email: string | null };
  items: PortalItem[];
};

const STATUS_STYLES: Record<string, string> = {
  invited: 'bg-surface-sunken text-ink-subtle ring-line',
  enrolled: 'bg-sky-50 text-sky-700 ring-sky-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  dropped: 'bg-surface-sunken text-ink-muted ring-line',
};

function fmtDates(a: string | null, b: string | null, locale: string): string | null {
  if (!a && !b) return null;
  const fmt = (d: string) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(d));
  if (a && b && a !== b) return `${fmt(a)} → ${fmt(b)}`;
  return fmt((a ?? b)!);
}

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let data: PortalPayload | null = null;
  let expired = false;
  try {
    data = await publicFetch<PortalPayload>(`/api/v1/thread/public/portal/${token}`);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 410) expired = true;
    else if (e instanceof PublicApiError && e.status === 404) expired = true;
    else throw e;
  }

  // Render in the language of the most recent enrolment.
  const lang: Locale = isLocale(data?.items[0]?.language) ? (data!.items[0]!.language as Locale) : 'en';

  if (expired || !data) {
    return (
      <Shell>
        <h1 className="text-2xl font-medium tracking-tight">{t(lang, 'portal_title')}</h1>
        <p className="mt-4 text-sm text-ink-subtle">{t(lang, 'portal_expired')}</p>
      </Shell>
    );
  }

  const firstName = data.person.first_name ?? data.person.email ?? '';

  return (
    <Shell>
      <h1 className="text-2xl font-medium tracking-tight">{t(lang, 'portal_title')}</h1>
      <p className="mt-1 text-sm text-ink-subtle">
        {t(lang, 'portal_hello', { name: firstName })}
      </p>

      {data.items.length === 0 && (
        <p className="mt-8 text-sm text-ink-subtle">{t(lang, 'portal_none')}</p>
      )}

      <ul className="mt-8 space-y-3">
        {data.items.map((it) => {
          const Icon = it.format === 'journey' ? Route : CalendarRange;
          const dates = fmtDates(it.starts_on, it.ends_on, it.language);
          return (
            <li key={it.thread_id}>
              <a
                href={it.url}
                className="flex items-start gap-4 rounded-xl border border-line bg-surface-raised p-5 hover:border-line-strong transition-colors"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-surface-sunken ring-1 ring-line shrink-0">
                  <Icon size={18} strokeWidth={1.75} className="text-ink-subtle" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium truncate">{it.title}</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ring-1 capitalize shrink-0 ${
                        STATUS_STYLES[it.enrolment_status] ?? STATUS_STYLES.enrolled
                      }`}
                    >
                      {it.enrolment_status}
                    </span>
                  </div>
                  {dates && <div className="mt-1 text-xs text-ink-muted">{dates}</div>}
                  {it.intention && (
                    <p className="mt-1.5 text-sm text-ink-subtle line-clamp-2 leading-relaxed">
                      {it.intention}
                    </p>
                  )}
                </div>
                <ExternalLink size={15} strokeWidth={1.75} className="text-ink-muted shrink-0 mt-1" />
              </a>
            </li>
          );
        })}
      </ul>

      <footer className="mt-16 text-xs text-ink-muted">
        {t(lang, 'powered_by')} <span className="font-medium">The Thread</span> · The Fibre
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="mx-auto max-w-2xl px-6 py-16">{children}</main>
    </div>
  );
}
