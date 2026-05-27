import { Workflow, CheckSquare, Users } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'Fibre Flow' };

export default function FlowDashboard() {
  return (
    <div className="px-6 py-8 max-w-5xl">
      <h1 className="text-2xl font-medium tracking-tight">Welcome</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Fibre Flow is empty so far. Create a flow to get started.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
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

      <p className="mt-12 text-xs text-ink-muted">
        Phase B preview. The shell is live; the engine is being assembled. See{' '}
        <code className="font-mono">docs/fibreflow-build-plan.md</code>.
      </p>
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
