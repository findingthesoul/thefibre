import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { serverSupabase } from '@/lib/supabase/server';

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
};

const APP_NAMES: Record<string, string> = {
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
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

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
    // Non-fatal: render the contact even if activity fetch fails.
  }

  const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ') || person.email || 'Unnamed';
  const location = [person.city, person.region, person.country].filter(Boolean).join(', ');

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <nav className="mb-10 text-sm text-ink-500">
        <Link href="/contacts" className="hover:text-ink-900">← Contacts</Link>
      </nav>

      <header>
        <h1 className="text-3xl font-medium tracking-tight">{fullName}</h1>
        {person.preferred_name && (
          <p className="text-sm text-ink-500 mt-1">Goes by {person.preferred_name}</p>
        )}
      </header>

      <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
        <Field label="Email" value={person.email} />
        <Field label="Phone" value={person.phone} />
        <Field label="LinkedIn" value={person.linkedin_url} link />
        <Field label="Location" value={location || null} />
        <Field label="Language" value={person.preferred_language} />
        <Field label="Pronouns" value={person.pronouns} />
      </section>

      <section className="mt-14">
        <h2 className="text-sm uppercase tracking-wider text-ink-500">Timeline</h2>
        {activities.length === 0 ? (
          <div className="mt-4 rounded-md border border-ink-700/10 bg-paper-100 p-4 text-sm text-ink-500">
            No activity yet. Events written by apps will appear here.
          </div>
        ) : (
          <ol className="mt-4 border-l border-ink-700/15 pl-6 space-y-6">
            {activities.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 w-2 h-2 rounded-full bg-ink-900" />
                <div className="text-xs uppercase tracking-wider text-ink-500">
                  {new Date(a.occurred_at).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {' · '}
                  {APP_NAMES[a.app_id] ?? a.app_id}
                  {' · '}
                  {a.type}
                </div>
                <div className="mt-1 text-sm">{a.subject}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function Field({ label, value, link = false }: { label: string; value: string | null; link?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
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
          <span className="text-ink-500/50">—</span>
        )}
      </div>
    </div>
  );
}
