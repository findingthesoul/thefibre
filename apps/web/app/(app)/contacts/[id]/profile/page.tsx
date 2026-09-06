import { notFound } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { countryName } from '@/lib/countries';
import { uiLocale } from '@/lib/locale';
import { t, type UiKey } from '@/lib/i18n-ui';
import {
  ProfessionalEdit,
  type ProfessionalRow,
} from '../professional/edit';

type Person = {
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  preferred_language: string | null;
  pronouns: string | null;
};

const SENIORITY_LABELS: Record<string, UiKey> = {
  junior: 'seniority_junior',
  mid: 'seniority_mid',
  senior: 'seniority_senior',
  lead: 'seniority_lead',
  executive: 'seniority_executive',
  board: 'seniority_board',
};

const CAREER_STAGE_LABELS: Record<string, UiKey> = {
  early: 'career_early',
  established: 'career_established',
  senior: 'career_senior',
  transitioning: 'career_transitioning',
  portfolio: 'career_portfolio',
};

export default async function ContactProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await uiLocale();

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

  const addressLine = [person.street, person.postal_code].filter(Boolean).join(', ');
  const location = [person.city, person.region, countryName(person.country)]
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
        <SectionLabel>{t(locale, 'identity')}</SectionLabel>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
          <Field label={t(locale, 'email_label')} value={person.email} />
          <Field label={t(locale, 'phone')} value={person.phone} />
          <Field label="LinkedIn" value={person.linkedin_url} link />
          <Field label={t(locale, 'address_label')} value={addressLine || null} />
          <Field label={t(locale, 'location')} value={location || null} />
          <Field label={t(locale, 'language')} value={person.preferred_language} />
          <Field label={t(locale, 'pronouns')} value={person.pronouns} />
        </div>
      </section>

      <section className="mt-14">
        <div className="flex items-center justify-between">
          <SectionLabel>{t(locale, 'professional')}</SectionLabel>
          <ProfessionalEdit personId={id} initial={professional} locale={locale} />
        </div>

        {profEmpty ? (
          <EmptyState>{t(locale, 'nothing_recorded_yet')}</EmptyState>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
            <Field label={t(locale, 'current_title')} value={professional!.current_title} />
            <Field label={t(locale, 'current_department')} value={professional!.current_department} />
            <Field
              label={t(locale, 'seniority_level')}
              value={
                professional!.seniority_level
                  ? SENIORITY_LABELS[professional!.seniority_level]
                    ? t(locale, SENIORITY_LABELS[professional!.seniority_level]!)
                    : professional!.seniority_level
                  : null
              }
            />
            <Field label={t(locale, 'sector')} value={professional!.sector} />
            <Field
              label={t(locale, 'career_stage')}
              value={
                professional!.career_stage
                  ? CAREER_STAGE_LABELS[professional!.career_stage]
                    ? t(locale, CAREER_STAGE_LABELS[professional!.career_stage]!)
                    : professional!.career_stage
                  : null
              }
            />
            <Field
              label={t(locale, 'years_of_experience')}
              value={
                professional!.years_of_experience !== null
                  ? String(professional!.years_of_experience)
                  : null
              }
            />
            <Field
              label={t(locale, 'independent')}
              value={
                professional!.is_independent === null
                  ? null
                  : professional!.is_independent
                  ? t(locale, 'yes')
                  : t(locale, 'no')
              }
            />
            <Field label={t(locale, 'expertise_areas')} value={joinList(professional!.expertise_areas)} />
            <Field
              label={t(locale, 'industries_worked_in')}
              value={joinList(professional!.industries_worked_in)}
            />
            <Field label={t(locale, 'certifications')} value={joinList(professional!.certifications)} />
            <Field
              label={t(locale, 'spoken_at_events')}
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
