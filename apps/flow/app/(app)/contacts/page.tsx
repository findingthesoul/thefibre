import { Users } from 'lucide-react';

export const metadata = { title: 'Contacts — Fibre Flow' };

export default function ContactsPage() {
  return (
    <div className="px-6 py-8 max-w-5xl">
      <h1 className="text-2xl font-medium tracking-tight">Contacts</h1>
      <p className="mt-1 text-sm text-ink-muted">
        The people Flow has in motion. Identity comes from The Fibre.
      </p>

      <div className="mt-8 rounded-lg border border-line bg-white p-12 text-center">
        <Users size={32} strokeWidth={1.5} className="mx-auto text-ink-muted" />
        <h2 className="mt-4 text-lg font-medium">Nobody in a flow yet</h2>
        <p className="mt-1 text-sm text-ink-subtle max-w-md mx-auto leading-relaxed">
          Once you add contacts to a flow, they appear here with their current
          step and next required action.
        </p>
      </div>
    </div>
  );
}
