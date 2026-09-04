import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import { fetchCatalog, PublicApiError } from '@/lib/public-api';

// Success page — the Stripe Checkout success_url lands here.

export default async function JoinedPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  let workspaceName: string;
  try {
    const catalog = await fetchCatalog(workspaceSlug);
    workspaceName = catalog.workspace.name;
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="min-h-screen bg-surface-sunken">
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
          <Check size={24} strokeWidth={2} className="text-emerald-700 dark:text-emerald-400" />
        </div>
        <h1 className="mt-6 text-2xl font-medium tracking-tight">
          Welcome to {workspaceName}!
        </h1>
        <p className="mt-3 text-base text-ink-subtle leading-relaxed">
          Your membership is active — a confirmation is on its way to your inbox.
        </p>
        <p className="mt-8 text-sm">
          <Link
            href="/my"
            className="text-ink-subtle hover:text-ink underline underline-offset-2"
          >
            View your membership
          </Link>
          <span className="mx-2 text-ink-muted">·</span>
          <Link
            href={`/${encodeURIComponent(workspaceSlug)}`}
            className="text-ink-subtle hover:text-ink underline underline-offset-2"
          >
            Back to {workspaceName}
          </Link>
        </p>
        <footer className="mt-16 text-xs text-ink-muted">
          Powered by <span className="font-medium">Membership</span> · The Fibre
        </footer>
      </main>
    </div>
  );
}
