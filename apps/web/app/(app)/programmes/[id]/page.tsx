import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader, SectionLabel, EmptyState } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { uiLocale } from '@/lib/locale';
import { t, INTL_LOCALES, type Locale, type UiKey } from '@/lib/i18n-ui';
import { EnrolButton, type PersonOption } from './enrol';

type Programme = {
  id: string;
  title: string;
  format: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  app: { slug: string; name: string } | null;
  created_at: string;
};

type Enrolment = {
  id: string;
  status: string;
  progress_pct: number | null;
  enrolled_at: string | null;
  completed_at: string | null;
  person: { id: string; first_name: string | null; last_name: string | null; email: string | null };
};

const FORMAT_LABEL: Record<string, UiKey> = {
  meeting: 'format_meeting',
  event: 'format_event',
  journey: 'format_journey',
  self_paced: 'format_self_paced',
  blended: 'format_blended',
};

const STATUS_LABEL: Record<string, UiKey> = {
  draft: 'status_draft',
  active: 'consent_active',
  completed: 'status_prog_completed',
  archived: 'status_archived',
  invited: 'status_invited',
  enrolled: 'status_enrolled',
  dropped: 'status_dropped',
};

export default async function ProgrammeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await uiLocale();

  let p: Programme;
  let enrolments: Enrolment[] = [];
  let people: PersonOption[] = [];
  try {
    p = await apiFetch<Programme>(`/api/v1/programs/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  try {
    const data = await apiFetch<{ items: Enrolment[] }>(`/api/v1/programs/${id}/enrolments`);
    enrolments = data.items;
  } catch {
    // Non-fatal — empty list.
  }
  try {
    const data = await apiFetch<{ items: PersonOption[] }>(`/api/v1/persons?limit=100`);
    const enrolledIds = new Set(enrolments.map((e) => e.person.id));
    people = data.items.filter((p) => !enrolledIds.has(p.id));
  } catch {
    // Non-fatal — Enrol dialog will have no options.
  }

  const dates = formatDateRange(p.starts_on, p.ends_on, locale);
  const fmtLabel = FORMAT_LABEL[p.format] ? t(locale, FORMAT_LABEL[p.format]!) : p.format;

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/programmes" label={t(locale, 'nav_programmes')} />
      <PageHeader
        title={p.title}
        description={[fmtLabel, p.app?.name, dates].filter(Boolean).join(' · ')}
      />

      <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
        <Field label={t(locale, 'format')} value={fmtLabel} />
        <Field
          label={t(locale, 'status')}
          value={STATUS_LABEL[p.status] ? t(locale, STATUS_LABEL[p.status]!) : p.status}
        />
        <Field label={t(locale, 'delivered_by')} value={p.app?.name ?? null} />
        <Field label={t(locale, 'starts_label')} value={fmtDate(p.starts_on, locale)} />
        <Field label={t(locale, 'ends_label')} value={fmtDate(p.ends_on, locale)} />
        <Field label={t(locale, 'created')} value={fmtDate(p.created_at, locale)} />
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <SectionLabel>{t(locale, 'enrolments')}</SectionLabel>
          <EnrolButton programmeId={p.id} people={people} locale={locale} />
        </div>
        {enrolments.length === 0 ? (
          <EmptyState>{t(locale, 'no_enrolments_yet')}</EmptyState>
        ) : (
          <ListGroup>
            {enrolments.map((e) => {
              const name =
                [e.person.first_name, e.person.last_name].filter(Boolean).join(' ') ||
                e.person.email ||
                t(locale, 'unnamed');
              return (
                <ListRow
                  key={e.id}
                  href={`/contacts/${e.person.id}`}
                  primary={name}
                  secondary={e.person.email ?? '—'}
                  meta={
                    <span className="text-xs">
                      {STATUS_LABEL[e.status] ? t(locale, STATUS_LABEL[e.status]!) : e.status}
                      {typeof e.progress_pct === 'number' && e.progress_pct > 0 && ` · ${e.progress_pct}%`}
                    </span>
                  }
                />
              );
            })}
          </ListGroup>
        )}
      </section>
    </PageContainer>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1">{value ? value : <span className="text-ink-muted">—</span>}</div>
    </div>
  );
}

function fmtDate(s: string | null, locale: Locale): string | null {
  if (!s) return null;
  return new Date(s).toLocaleDateString(INTL_LOCALES[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateRange(start: string | null, end: string | null, locale: Locale): string | null {
  if (!start && !end) return null;
  if (start && end) return `${fmtDate(start, locale)} – ${fmtDate(end, locale)}`;
  if (start) return `${t(locale, 'from')} ${fmtDate(start, locale)}`;
  if (end) return `${t(locale, 'until')} ${fmtDate(end!, locale)}`;
  return null;
}
