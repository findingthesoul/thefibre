import Link from 'next/link';
import {
  User,
  CreditCard,
  SlidersHorizontal,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { PageContainer, PageHeader, SectionLabel } from './page-chrome';

// Settings hub (Sjoerd 2026-07-09: "normal settings belonging to profile...
// now added: pulse settings as an option to it") — Thread's card-link
// pattern. The planner assumptions moved to /settings/planner; Profile and
// Payments are the platform-SPoT pages every Fibre app carries.

export const metadata = { title: 'Settings · Fibre Pulse' };

export default function SettingsPage() {
  return (
    <PageContainer max="4xl">
      <PageHeader title="Settings" description="Your Fibre profile, payments and the planner's assumptions." />

      <section className="mt-10">
        <SectionLabel>Personal</SectionLabel>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            href="/settings/profile"
            Icon={User}
            title="Profile"
            desc="Your Fibre profile — display name, bio and timezone, one face shared by every Fibre app."
          />
        </div>
      </section>

      <section className="mt-10">
        <SectionLabel>Workspace</SectionLabel>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            href="/settings/payments"
            Icon={CreditCard}
            title="Payments"
            desc="Your Stripe account and the workspace's — one connection per person, shared across all Fibre apps."
          />
          <Card
            href="/settings/planner"
            Icon={SlidersHorizontal}
            title="Planner"
            desc="Pulse's assumptions layer — rhythm, invoicing, ledger, reservations, teams, pipeline stages, offerings and history."
          />
        </div>
      </section>
    </PageContainer>
  );
}

function Card({
  href,
  Icon,
  title,
  desc,
}: {
  href: string;
  Icon: LucideIcon;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <div className="flex items-start gap-3.5 rounded-lg border border-line bg-surface-raised p-4 transition-colors hover:border-line-strong">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunken ring-1 ring-line shrink-0">
          <Icon size={17} strokeWidth={1.75} className="text-ink-subtle" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{title}</div>
          <p className="mt-0.5 text-xs text-ink-subtle leading-relaxed">{desc}</p>
        </div>
        <ChevronRight size={16} strokeWidth={1.75} className="text-ink-muted shrink-0 mt-1" />
      </div>
    </Link>
  );
}
