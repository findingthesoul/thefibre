import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { NewPersonForm } from './form';

export default function NewPersonPage() {
  return (
    <div className="mx-auto max-w-md px-8 py-10">
      <nav className="mb-8 text-sm">
        <Link href="/contacts" className="inline-flex items-center gap-1 text-ink-subtle hover:text-ink">
          <ChevronLeft size={14} strokeWidth={1.75} />
          Contacts
        </Link>
      </nav>
      <h1 className="text-2xl font-medium tracking-tight">Add person</h1>
      <p className="mt-2 text-sm text-ink-subtle">
        Adds a contact to your workspace. Identity is platform-owned — every
        app sees the same record.
      </p>
      <NewPersonForm />
    </div>
  );
}
