import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { NewOrgForm } from './form';

export default function NewOrgPage() {
  return (
    <div className="mx-auto max-w-md px-8 py-10">
      <nav className="mb-8 text-sm">
        <Link href="/organisations" className="inline-flex items-center gap-1 text-ink-subtle hover:text-ink">
          <ChevronLeft size={14} strokeWidth={1.75} />
          Organisations
        </Link>
      </nav>
      <h1 className="text-2xl font-medium tracking-tight">Add organisation</h1>
      <p className="mt-2 text-sm text-ink-subtle">
        Adds an organisation to your workspace.
      </p>
      <NewOrgForm />
    </div>
  );
}
