import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { ACTIVITY_TYPES, APP_IDS, appName, type AppId } from '@thefibre/shared';

type Activity = {
  id: string;
  person_id: string;
  app_id: string;
  type: string;
  subject: string;
  occurred_at: string;
  app: { slug: string; name: string } | null;
};

type Person = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ app_id?: string; type?: string; after?: string }>;
}) {
  const { app_id, type, after } = await searchParams;

  // Resolve app_id slug → uuid (the API expects uuid).
  const params = new URLSearchParams();
  params.set('limit', '50');
  if (after) params.set('after', after);
  if (type) params.set('type', type);

  if (app_id) params.set('app_id', app_id);

  let activities: (Activity & { _person?: Person })[] = [];
  let next: string | null = null;
  let error: string | null = null;

  try {
    const data = await apiFetch<{ items: Activity[]; next: string | null }>(
      `/api/v1/activities?${params.toString()}`,
    );
    activities = data.items;
    next = data.next;

    // Hydrate person info (one round trip per unique id — fine at this scale).
    const personIds = Array.from(new Set(activities.map((a) => a.person_id)));
    const people = await Promise.all(
      personIds.map(async (id) => {
        try { return await apiFetch<Person>(`/api/v1/persons/${id}`); } catch { return null; }
      }),
    );
    const personById: Record<string, Person> = {};
    for (const p of people) if (p) personById[p.id] = p;
    activities.forEach((a) => {
      const p = personById[a.person_id];
      if (p) a._person = p;
    });
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header>
        <h1 className="text-2xl font-medium tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-ink-subtle">
          The accumulated record of every meaningful interaction across every app.
        </p>
      </header>

      <form className="mt-6 flex flex-wrap gap-3" action="/activity">
        <Select name="type" defaultValue={type ?? ''} placeholder="All types">
          {ACTIVITY_TYPES.map((t: string) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
        <Select name="app_id" defaultValue={app_id ?? ''} placeholder="All apps">
          {APP_IDS.map((slug: string) => (
            <option key={slug} value={slug}>{appName(slug as AppId) ?? slug}</option>
          ))}
        </Select>
        <button
          type="submit"
          className="rounded-md border border-line bg-surface-raised px-3 py-1.5 text-sm hover:bg-surface-sunken"
        >
          Apply
        </button>
        {(type || app_id) && (
          <Link
            href="/activity"
            className="rounded-md px-3 py-1.5 text-sm text-ink-subtle hover:text-ink"
          >
            Clear
          </Link>
        )}
      </form>

      {error && (
        <div className="mt-6 rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
          Couldn't load activity: {error}
        </div>
      )}

      {!error && activities.length === 0 && (
        <div className="mt-10 rounded-lg border border-line bg-surface-sunken p-6 text-sm text-ink-subtle">
          No activity yet. Events written by apps will appear here.
        </div>
      )}

      {activities.length > 0 && (
        <ol className="mt-8 border-l border-line pl-6 space-y-5">
          {activities.map((a) => {
            const personName = a._person
              ? [a._person.first_name, a._person.last_name].filter(Boolean).join(' ') || a._person.email
              : null;
            return (
              <li key={a.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 w-2 h-2 rounded-full bg-ink" />
                <div className="text-xs uppercase tracking-wider text-ink-muted">
                  {new Date(a.occurred_at).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  {' · '}
                  {a.app ? appName(a.app.slug as AppId) ?? a.app.name : 'Unknown app'}
                  {' · '}
                  <span>{a.type}</span>
                </div>
                <div className="mt-1 text-sm">
                  {a.subject}
                  {personName && a._person && (
                    <>
                      {' · '}
                      <Link href={`/contacts/${a._person.id}`} className="underline underline-offset-2 hover:text-ink-subtle">
                        {personName}
                      </Link>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {next && (
        <div className="mt-8">
          <Link
            href={{ pathname: '/activity', query: { ...(type ? { type } : {}), ...(app_id ? { app_id } : {}), after: next } }}
            className="rounded-md border border-line bg-surface-raised px-4 py-2 text-sm hover:bg-surface-sunken"
          >
            Load older →
          </Link>
        </div>
      )}
    </div>
  );
}

function Select({
  name,
  defaultValue,
  placeholder,
  children,
}: {
  name: string;
  defaultValue: string;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="rounded-md border border-line bg-surface-raised px-3 py-1.5 text-sm focus:border-line-strong focus:outline-none"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}
