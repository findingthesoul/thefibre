import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';

type MeetingType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  conferencing_provider: string;
  is_active: boolean;
};

type Host = { slug: string };

export default async function MeetingTypesPage() {
  let items: MeetingType[] = [];
  let host: Host | null = null;
  let error: string | null = null;

  try {
    const [data, h] = await Promise.all([
      apiFetch<{ items: MeetingType[] }>('/api/v1/meet/meeting-types'),
      apiFetch<Host>('/api/v1/meet/me'),
    ]);
    items = data.items;
    host = h;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight">Meeting types</h1>
          <p className="mt-1 text-sm text-ink-subtle">
            What you offer to be booked for.
          </p>
        </div>
        <Link
          href="/meeting-types/new"
          className="rounded-md bg-ink text-ink-inverse px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          New meeting type
        </Link>
      </div>

      {error && (
        <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Couldn&apos;t load: {error}
        </div>
      )}

      {!error && items.length === 0 && (
        <div className="mt-12 rounded-lg border border-line bg-surface-sunken p-8 text-center">
          <p className="text-sm text-ink-subtle">
            No meeting types yet. Create your first one.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-10 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
          {items.map((mt) => (
            <li key={mt.id}>
              <Link
                href={`/meeting-types/${mt.id}`}
                className="block px-5 py-4 hover:bg-surface-sunken"
              >
                <div className="flex items-baseline justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3">
                      <span className="font-medium">{mt.name}</span>
                      {!mt.is_active && (
                        <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                          Hidden
                        </span>
                      )}
                    </div>
                    {mt.description && (
                      <p className="text-sm text-ink-subtle mt-1 truncate">
                        {mt.description}
                      </p>
                    )}
                    {host && (
                      <div className="text-xs text-ink-muted mt-1 font-mono">
                        meet.thefibre.app/{host.slug}/{mt.slug}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-ink-subtle whitespace-nowrap">
                    {mt.duration_minutes} min
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
