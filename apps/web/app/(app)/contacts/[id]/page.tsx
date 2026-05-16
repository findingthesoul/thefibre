import { notFound } from 'next/navigation';
import Link from 'next/link';
import { appName, type AppId } from '@thefibre/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { countryName } from '@/lib/countries';

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

type Activity = {
  id: string;
  type: string;
  subject: string;
  occurred_at: string;
  app_id: string;
  app: { slug: string; name: string } | null;
};

export default async function ContactOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let person: Person;
  let activities: Activity[] = [];
  try {
    person = await apiFetch<Person>(`/api/v1/persons/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  try {
    const data = await apiFetch<{ items: Activity[] }>(
      `/api/v1/activities?person_id=${id}&limit=100`,
    );
    activities = data.items;
  } catch {
    // Non-fatal.
  }

  const addressLine = [person.street, person.postal_code].filter(Boolean).join(', ');
  const location = [person.city, person.region, countryName(person.country)].filter(Boolean).join(', ');

  return (
    <>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
        <Field label="Email" value={person.email} />
        <Field label="Phone" value={person.phone} />
        <Field label="LinkedIn" value={person.linkedin_url} link />
        <Field label="Address" value={addressLine || null} />
        <Field label="Location" value={location || null} />
        <Field label="Language" value={person.preferred_language} />
        <Field label="Pronouns" value={person.pronouns} />
      </section>

      <section className="mt-14">
        <SectionLabel>Timeline</SectionLabel>
        {activities.length === 0 ? (
          <EmptyState>No activity yet. Events written by apps will appear here.</EmptyState>
        ) : (
          <ol className="mt-4 border-l border-line pl-6 space-y-6">
            {activities.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 w-2 h-2 rounded-full bg-ink" />
                <div className="text-xs uppercase tracking-wider text-ink-muted">
                  {new Date(a.occurred_at).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {' · '}
                  {a.app ? appName(a.app.slug as AppId) ?? a.app.name : a.app_id}
                  {' · '}
                  {a.type}
                </div>
                <div className="mt-1 text-sm">{a.subject}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function Field({ label, value, link = false }: { label: string; value: string | null; link?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1">
        {value ? (
          link ? (
            <Link href={value.startsWith('http') ? value : `https://${value}`} className="underline" target="_blank">
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
