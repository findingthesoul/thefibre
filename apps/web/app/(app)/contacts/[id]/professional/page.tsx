import { apiFetch } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { ProfessionalEdit, type ProfessionalRow } from './edit';

type Props = { params: Promise<{ id: string }> };

const SENIORITY_LABELS: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
  executive: 'Executive',
  board: 'Board',
};

const CAREER_STAGE_LABELS: Record<string, string> = {
  early: 'Early',
  established: 'Established',
  senior: 'Senior',
  transitioning: 'Transitioning',
  portfolio: 'Portfolio',
};

export default async function ProfessionalTab({ params }: Props) {
  const { id } = await params;

  let row: ProfessionalRow | null = null;
  try {
    row = await apiFetch<ProfessionalRow | null>(`/api/v1/persons/${id}/professional`);
  } catch {
    // Non-fatal — leave null.
  }

  const allEmpty =
    !row ||
    (row.current_title === null &&
      row.current_department === null &&
      row.seniority_level === null &&
      row.sector === null &&
      (row.expertise_areas === null || row.expertise_areas.length === 0) &&
      (row.industries_worked_in === null || row.industries_worked_in.length === 0) &&
      row.years_of_experience === null &&
      row.career_stage === null &&
      row.is_independent === null &&
      (row.certifications === null || row.certifications.length === 0) &&
      (row.spoken_at_events === null || row.spoken_at_events.length === 0));

  return (
    <>
      <div className="flex items-center justify-between">
        <SectionLabel>Professional profile</SectionLabel>
        <ProfessionalEdit personId={id} initial={row} />
      </div>

      {allEmpty ? (
        <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
      ) : (
        <section className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
          <Field label="Current title" value={row!.current_title} />
          <Field label="Current department" value={row!.current_department} />
          <Field
            label="Seniority level"
            value={row!.seniority_level ? SENIORITY_LABELS[row!.seniority_level] ?? row!.seniority_level : null}
          />
          <Field label="Sector" value={row!.sector} />
          <Field
            label="Career stage"
            value={row!.career_stage ? CAREER_STAGE_LABELS[row!.career_stage] ?? row!.career_stage : null}
          />
          <Field
            label="Years of experience"
            value={row!.years_of_experience !== null ? String(row!.years_of_experience) : null}
          />
          <Field
            label="Independent"
            value={row!.is_independent === null ? null : row!.is_independent ? 'Yes' : 'No'}
          />
          <Field label="Expertise areas" value={joinList(row!.expertise_areas)} />
          <Field label="Industries worked in" value={joinList(row!.industries_worked_in)} />
          <Field label="Certifications" value={joinList(row!.certifications)} />
          <Field label="Spoken at events" value={joinList(row!.spoken_at_events)} />
        </section>
      )}
    </>
  );
}

function joinList(arr: string[] | null): string | null {
  if (!arr || arr.length === 0) return null;
  return arr.join(', ');
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1">
        {value ? value : <span className="text-ink-muted">—</span>}
      </div>
    </div>
  );
}
