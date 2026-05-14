import { notFound } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import {
  ProfessionalEdit,
  type ProfessionalRow,
} from '../professional/edit';

type Person = {
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  preferred_language: string | null;
  pronouns: string | null;
};

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

export default async function ContactProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let person: Person;
  try {
    person = await apiFetch<Person>(`/api/v1/persons/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  let professional: ProfessionalRow | null = null;
  try {
    professional = await apiFetch<ProfessionalRow | null>(
      `/api/v1/persons/${id}/professional`,
    );
  } catch {
    // Non-fatal.
  }

  const location = [person.city, person.region, person.country]
    .filter(Boolean)
    .join(', ');

  const profEmpty =
    !professional ||
    (professional.current_title === null &&
      professional.current_department === null &&
      professional.seniority_level === null &&
      professional.sector === null &&
      (professional.expertise_areas === null ||
        professional.expertise_areas.length === 0) &&
      (professional.industries_worked_in === null ||
        professional.industries_worked_in.length === 0) &&
      professional.years_of_experience === null &&
      professional.career_stage === null &&
      professional.is_independent === null &&
      (professional.certifications === null ||
        professional.certifications.length === 0) &&
      (professional.spoken_at_events === null ||
        professional.spoken_at_events.length === 0));

  return (
    <>
      <section>
        <SectionLabel>Identity</SectionLabel>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
          <Field label="Email" value={person.email} />
          <Field label="Phone" value={person.phone} />
          <Field label="LinkedIn" value={person.linkedin_url} link />
          <Field label="Location" value={location || null} />
          <Field label="Language" value={person.preferred_language} />
          <Field label="Pronouns" value={person.pronouns} />
        </div>
      </section>

      <section className="mt-14">
        <div className="flex items-center justify-between">
          <SectionLabel>Professional</SectionLabel>
          <ProfessionalEdit personId={id} initial={professional} />
        </div>

        {profEmpty ? (
          <EmptyState>Nothing recorded yet. Click Edit to fill it in.</EmptyState>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field label="Current title" value={professional!.current_title} />
            <Field label="Current department" value={professional!.current_department} />
            <Field
              label="Seniority level"
              value={
                professional!.seniority_level
                  ? SENIORITY_LABELS[professional!.seniority_level] ??
                    professional!.seniority_level
                  : null
              }
            />
            <Field label="Sector" value={professional!.sector} />
            <Field
              label="Career stage"
              value={
                professional!.career_stage
                  ? CAREER_STAGE_LABELS[professional!.career_stage] ??
                    professional!.career_stage
                  : null
              }
            />
            <Field
              label="Years of experience"
              value={
                professional!.years_of_experience !== null
                  ? String(professional!.years_of_experience)
                  : null
              }
            />
            <Field
              label="Independent"
              value={
                professional!.is_independent === null
                  ? null
                  : professional!.is_independent
                  ? 'Yes'
                  : 'No'
              }
            />
            <Field label="Expertise areas" value={joinList(professional!.expertise_areas)} />
            <Field
              label="Industries worked in"
              value={joinList(professional!.industries_worked_in)}
            />
            <Field label="Certifications" value={joinList(professional!.certifications)} />
            <Field
              label="Spoken at events"
              value={joinList(professional!.spoken_at_events)}
            />
          </div>
        )}
      </section>
    </>
  );
}

function joinList(arr: string[] | null): string | null {
  if (!arr || arr.length === 0) return null;
  return arr.join(', ');
}

function Field({
  label,
  value,
  link = false,
}: {
  label: string;
  value: string | null;
  link?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1">
        {value ? (
          link ? (
            <Link
              href={value.startsWith('http') ? value : `https://${value}`}
              className="underline"
              target="_blank"
            >
              {value.replace(/^https?:\/\//, '')}
            </Link>
          ) : (
            value
          )
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </div>
    </div>
  );
}
