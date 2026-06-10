import { Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ContactsList, type Run } from './contacts-list';

export const metadata = { title: 'Contacts — Fibre Flow' };

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
        <div className="mt-8 rounded-2xl bg-white ring-1 ring-black/5 shadow-sm p-12 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <Users size={22} strokeWidth={1.5} className="text-indigo-600" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Nobody in a flow yet</h2>
          <p className="mt-1 text-sm text-ink-subtle max-w-md mx-auto">
            Add contacts to a flow from its page, and they&apos;ll appear here with their
            current step.
          </p>
        </div>
      )}

      {runs.length > 0 && <ContactsList runs={runs} />}
    </div>
  );
}
