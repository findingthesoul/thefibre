import { ExternalLink } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import {
  PageContainer,
  PageHeader,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/page';

type ContactItem = {
  person: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
  threads: { id: string; title: string; status: string }[];
  last_enrolled_at: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function ContactsPage() {
  let items: ContactItem[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: ContactItem[] }>('/api/v1/thread/contacts');
    items = r.items;
  } catch (e) {
    error = e instanceof ApiError ? `API ${e.status}` : 'unknown error';
  }

  return (
    <PageContainer>
      <PageHeader
        title="Contacts"
        description="The people The Thread knows — everyone who has enrolled in one of your threads."
      />

      {error && <ErrorBanner>Couldn&apos;t load contacts: {error}</ErrorBanner>}

      {!error && items.length === 0 && (
        <EmptyState>Contacts appear when people enrol in your threads.</EmptyState>
      )}

      {items.length > 0 && (
        <ul className="mt-6 divide-y divide-line border border-line rounded-lg bg-surface-raised">
          {items.map((it) => {
            const name =
              [it.person.first_name, it.person.last_name].filter(Boolean).join(' ') ||
              it.person.email ||
              'Unknown';
            return (
              <li key={it.person.id} className="flex items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <a
                    href={`https://thefibre.app/contacts/${it.person.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium hover:underline underline-offset-2"
                  >
                    <span className="truncate">{name}</span>
                    <ExternalLink size={12} strokeWidth={1.75} className="shrink-0 text-ink-muted" />
                  </a>
                  <div className="text-xs text-ink-subtle mt-0.5 truncate">
                    {it.person.email}
                  </div>
                  {it.threads.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {it.threads.map((t) => (
                        <span
                          key={t.id}
                          className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-line bg-surface-sunken text-ink-subtle"
                        >
                          {t.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {it.last_enrolled_at && (
                  <span className="text-xs text-ink-muted shrink-0">
                    {formatDate(it.last_enrolled_at)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
