import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { PageContainer, Breadcrumb, PageHeader, SectionLabel, EmptyState } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
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

const FORMAT_LABEL: Record<string, string> = {
  meeting: 'Meeting',
  event: 'Event',
  journey: 'Journey',
  self_paced: 'Self-paced',
  blended: 'Blended',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
  invited: 'Invited',
  enrolled: 'Enrolled',
  dropped: 'Dropped',
};

export default async function ProgrammeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  const dates = formatDateRange(p.starts_on, p.ends_on);

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/programmes" label="Programmes" />
      <PageHeader
        title={p.title}
        description={[FORMAT_LABEL[p.format] ?? p.format, p.app?.name, dates].filter(Boolean).join(' · ')}
      />

      <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
        <Field label="Format" value={FORMAT_LABEL[p.format] ?? p.format} />
        <Field label="Status" value={STATUS_LABEL[p.status] ?? p.status} />
        <Field label="Delivered by" value={p.app?.name ?? null} />
        <Field label="Starts" value={fmtDate(p.starts_on)} />
        <Field label="Ends" value={fmtDate(p.ends_on)} />
        <Field label="Created" value={fmtDate(p.created_at)} />
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <SectionLabel>Enrolments</SectionLabel>
          <EnrolButton programmeId={p.id} people={people} />
        </div>
        {enrolments.length === 0 ? (
          <EmptyState>
            No enrolments yet. Click Enrol person to add the first one.
          </EmptyState>
        ) : (
          <ListGroup>
            {enrolments.map((e) => {
              const name =
                [e.person.first_name, e.person.last_name].filter(Boolean).join(' ') ||
                e.person.email ||
                'Unnamed';
              return (
                <ListRow
                  key={e.id}
                  href={`/contacts/${e.person.id}`}
                  primary={name}
                  secondary={e.person.email ?? '—'}
                  meta={
                    <span className="text-xs">
                      {STATUS_LABEL[e.status] ?? e.status}
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

function fmtDate(s: string | null): string | null {
  if (!s) return null;
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`;
  if (start) return `from ${fmtDate(start)}`;
  if (end) return `until ${fmtDate(end!)}`;
  return null;
}
