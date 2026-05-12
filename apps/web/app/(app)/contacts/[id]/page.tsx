import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';

type Person = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  pronouns: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  preferred_language: string | null;
  created_at: string;
};

type Activity = {
  id: string;
  type: string;
  subject: string;
  occurred_at: string;
  app_id: string;
  app: { slug: string; name: string } | null;
};

const APP_NAMES: Record<string, string> = {
  'fibre-platform': 'Platform',
  'fibre-suite': 'Fibre Suite',
  'the-thread': 'The Thread',
  'fibre-sales': 'Fibre Sales',
  'fibre-learn': 'Fibre Learn',
};

export default async function ContactDetail({
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

  const fullName =
    [person.first_name, person.last_name].filter(Boolean).join(' ') ||
    person.email ||
    'Unnamed';
  const location = [person.city, person.region, person.country].filter(Boolean).join(', ');

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <nav className="mb-8 text-sm">
        <Link href="/contacts" className="inline-flex items-center gap-1 text-ink-subtle hover:text-ink">
          <ChevronLeft size={14} strokeWidth={1.75} />
          Contacts
        </Link>
      </nav>

      <header>
        <h1 className="text-2xl font-medium tracking-tight">{fullName}</h1>
        {person.preferred_name && (
          <p className="text-sm text-ink-subtle mt-1">Goes by {person.preferred_name}</p>
        )}
      </header>

      <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5 text-sm">
        <Field label="Email" value={person.email} />
        <Field label="Phone" value={person.phone} />
        <Field label="LinkedIn" value={person.linkedin_url} link />
        <Field label="Location" value={location || null} />
        <Field label="Language" value={person.preferred_language} />
        <Field label="Pronouns" value={person.pronouns} />
      </section>

      <section className="mt-14">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">Timeline</div>
        {activities.length === 0 ? (
          <div className="mt-3 rounded-lg border border-line bg-surface-sunken p-5 text-sm text-ink-subtle">
            No activity yet. Events written by apps will appear here.
          </div>
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
                  {a.app ? APP_NAMES[a.app.slug] ?? a.app.name : a.app_id}
                  {' · '}
                  {a.type}
                </div>
                <div className="mt-1 text-sm">{a.subject}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, link = false }: { label: string; value: string | null; link?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-1">
        {value ? (
          link ? (
            <a href={value} className="underline" target="_blank" rel="noreferrer">
              {value.replace(/^https?:\/\//, '')}
            </a>
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
