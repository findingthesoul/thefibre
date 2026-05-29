import Link from 'next/link';
import { Users, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export const metadata = { title: 'Contacts — Fibre Flow' };

type Person = { id: string; first_name: string | null; last_name: string | null; email: string | null };
type Run = {
  id: string;
  status: string;
  person: Person | Person[] | null;
  flow: { id: string; name: string } | { id: string; name: string }[] | null;
  step: { key: string; name: string; kind: string } | { key: string; name: string; kind: string }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}
function personName(p: Person | null): string {
  if (!p) return 'Unknown';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown';
}

export default async function ContactsPage() {
  let runs: Run[] = [];
  let loadError: string | null = null;
  try {
    const r = await apiFetch<{ items: Run[] }>('/api/v1/flow/runs?status=active');
    runs = r.items;
  } catch {
    loadError = 'Could not load contacts.';
  }

  return (
    <div className="px-6 py-8 max-w-3xl">
      <h1 className="text-2xl font-medium tracking-tight">Contacts in motion</h1>
      <p className="mt-1 text-sm text-ink-muted">
        People currently moving through a flow. Identity comes from The Fibre.
      </p>

      {loadError && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {!loadError && runs.length === 0 && (
        <div className="mt-8 rounded-lg border border-line bg-white p-12 text-center">
          <Users size={32} strokeWidth={1.5} className="mx-auto text-ink-muted" />
          <h2 className="mt-4 text-lg font-medium">Nobody in a flow yet</h2>
          <p className="mt-1 text-sm text-ink-subtle max-w-md mx-auto">
            Add contacts to a flow from its page, and they&apos;ll appear here with their
            current step.
          </p>
        </div>
      )}

      {runs.length > 0 && (
        <div className="mt-8 space-y-2">
          {runs.map((r) => {
            const person = one(r.person);
            const flow = one(r.flow);
            const step = one(r.step);
            return (
              <Link
                key={r.id}
                href={`/runs/${r.id}`}
                className="flex items-center gap-3 rounded-lg border border-line bg-white px-4 py-3 hover:border-line-strong transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{personName(person)}</div>
                  <div className="text-xs text-ink-muted truncate">{flow?.name}</div>
                </div>
                <div className="text-sm text-ink-subtle shrink-0">{step?.name ?? '—'}</div>
                <ChevronRight size={16} className="text-ink-muted shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
