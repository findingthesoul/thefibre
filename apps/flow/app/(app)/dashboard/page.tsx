import { Workflow, CheckSquare, Users, Star } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export const metadata = { title: 'Fibre Flow' };

type FlowRow = {
  id: string;
  name: string;
  description: string | null;
  lifecycle: string;
  active_run_count: number;
  is_favorite: boolean;
};

const LIFECYCLE_STYLE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800',
  active: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-neutral-200 text-neutral-700',
  archived: 'bg-neutral-100 text-neutral-500',
};

export default async function FlowDashboard() {
  let favorites: FlowRow[] = [];
  try {
    const r = await apiFetch<{ items: FlowRow[] }>('/api/v1/flow/flows?favorite=1');
    favorites = r.items;
  } catch {
    /* non-fatal — dashboard still renders the quick-links */
  }

  return (
    <div className="px-6 py-8 max-w-5xl">
      <h1 className="text-2xl font-medium tracking-tight">Welcome</h1>
      <p className="mt-1 text-sm text-ink-muted">Your favourite flows and quick links.</p>

      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <Star size={16} strokeWidth={1.75} className="fill-amber-400 text-amber-500" />
          <h2 className="text-sm font-medium">Favourite flows</h2>
        </div>
        {favorites.length === 0 ? (
          <div className="rounded-lg border border-line bg-white p-6 text-sm text-ink-subtle">
            No favourites yet. Open <Link href="/flows" className="underline">Flows</Link> and tap the ☆ on the
            ones you use most — they&apos;ll pin here.
          </div>
        ) : (
          <div className="space-y-2">
            {favorites.map((f) => (
              <Link
                key={f.id}
                href={`/flows/${f.id}`}
                className="flex items-center gap-3 rounded-lg border border-line bg-white px-5 py-3.5 hover:border-line-strong transition-colors"
              >
                <Star size={16} className="fill-amber-400 text-amber-500 shrink-0" />
                <span className="font-medium truncate flex-1">{f.name}</span>
                <span
                  className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    LIFECYCLE_STYLE[f.lifecycle] ?? ''
                  }`}
                >
                  {f.lifecycle}
                </span>
                <span className="text-xs text-ink-subtle shrink-0">{f.active_run_count} active</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <DashCard
          href="/flows"
          icon={Workflow}
          title="Flows"
          body="Design and run people-flows. Sales, projects, partnerships — each is a sequence of steps held by gate tasks."
        />
        <DashCard
          href="/tasks"
          icon={CheckSquare}
          title="My tasks"
          body="The actionable layer. Tasks born from flow gates, plus anything you add manually."
        />
        <DashCard
          href="/contacts"
          icon={Users}
          title="Contacts"
          body="The people you have in motion. Their position in each flow, their open tasks, their activity."
        />
      </div>
    </div>
  );
}

function DashCard({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: string;
  icon: typeof Workflow;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-line bg-white p-5 hover:border-line-strong transition-colors"
    >
      <Icon size={20} strokeWidth={1.75} className="text-ink-muted" />
      <div className="mt-3 text-base font-medium">{title}</div>
      <p className="mt-1 text-sm text-ink-subtle leading-relaxed">{body}</p>
    </Link>
  );
}
